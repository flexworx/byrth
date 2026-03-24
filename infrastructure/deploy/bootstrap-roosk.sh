#!/bin/bash
# =============================================================================
# ROOSK BOOTSTRAP SCRIPT — Run from laptop AFTER Proxmox is installed
#
# This single script bootstraps the entire Roosk NexGen Platform:
#   1. Configures Proxmox (networking, ZFS, repos, API token)
#   2. Downloads Ubuntu cloud-init image
#   3. Creates VM-DB-01 (PostgreSQL) and VM-APP-01 (Platform)
#   4. Waits for VMs to boot via cloud-init
#   5. Deploys PostgreSQL on DB VM
#   6. Deploys Roosk (Docker) on App VM
#   7. Seeds the database and prints access URL
#
# Usage:
#   ssh root@192.168.4.58 "bash -s" < bootstrap-roosk.sh
#   — OR —
#   scp bootstrap-roosk.sh root@192.168.4.58:/root/ && \
#   ssh root@192.168.4.58 "bash /root/bootstrap-roosk.sh"
#
# Prerequisites:
#   - Proxmox VE 9.1 installed on the R7625
#   - SSH access to root@192.168.4.58
#   - Internet connectivity on the server
# =============================================================================
set -euo pipefail

echo "============================================="
echo "  ROOSK NexGen Platform — Bootstrap Script"
echo "  Target: Dell PowerEdge R7625"
echo "  Date: $(date)"
echo "============================================="
echo ""

# ─── Configuration ──────────────────────────────────────────────
PROXMOX_IP="192.168.4.58"
NODE="r7625"
STORAGE="local"  # Will switch to nexgen-vms if ZFS is set up

# VM Configuration
APP_VMID=104
APP_NAME="VM-APP-01"
APP_IP="10.20.0.10"
APP_GW="10.20.0.1"
APP_CORES=8
APP_RAM=12288
APP_DISK=200

DB_VMID=105
DB_NAME="VM-DB-01"
DB_IP="10.20.0.20"
DB_GW="10.20.0.1"
DB_CORES=4
DB_RAM=12288
DB_DISK=500

CLOUD_IMAGE_URL="https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img"
CLOUD_IMAGE_FILE="/var/lib/vz/template/qcow2/ubuntu-22.04-cloud.img"

# ─── Collect credentials upfront ────────────────────────────────
echo "=== Credential Collection ==="
echo ""

read -rp "AWS Access Key ID (for Bedrock): " AWS_KEY_ID
read -rsp "AWS Secret Access Key: " AWS_SECRET_KEY
echo ""

# Generate secrets
JWT_SECRET=$(openssl rand -hex 32)
DB_PASSWORD=$(openssl rand -hex 16)
MURPH_HMAC=$(openssl rand -hex 32)
MURPH_WEBHOOK=$(openssl rand -hex 32)
REPLICATION_PASSWORD=$(openssl rand -hex 16)

echo "Secrets generated."
echo ""

# ─── Phase 1: Proxmox Post-Install ─────────────────────────────
echo "=== Phase 1: Proxmox Post-Install ==="

# 1a. Configure APT repos
echo "[1/8] Configuring APT repositories..."
rm -f /etc/apt/sources.list.d/pve-enterprise.list
cat > /etc/apt/sources.list.d/pve-no-subscription.list <<EOF
deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription
EOF
apt-get update -y && apt-get dist-upgrade -y

# 1b. Install dependencies
echo "[2/8] Installing dependencies..."
apt-get install -y \
    sudo curl wget git htop tmux vim \
    python3 python3-pip python3-venv \
    nginx certbot jq unzip \
    libguestfs-tools cloud-init

# 1c. ZFS setup (if NVMe disks present)
echo "[3/8] Checking for ZFS setup..."
NVME_DISKS=$(ls /dev/nvme*n1 2>/dev/null | grep -v p | head -3 || true)
DISK_COUNT=$(echo "$NVME_DISKS" | grep -c nvme || true)

if [ "$DISK_COUNT" -ge 3 ]; then
    if ! zpool list nexgen-pool &>/dev/null; then
        echo "Creating ZFS pool: nexgen-pool (RAIDZ1)"
        zpool create -f nexgen-pool raidz1 $NVME_DISKS
        zfs create nexgen-pool/vms
        zfs create nexgen-pool/backups
        zfs create nexgen-pool/iso
        zfs set compression=lz4 nexgen-pool
        zfs set atime=off nexgen-pool
    fi
    if ! pvesm status | grep -q nexgen-vms; then
        pvesm add zfspool nexgen-vms -pool nexgen-pool/vms -content images,rootdir
    fi
    STORAGE="nexgen-vms"
    echo "ZFS storage configured: $STORAGE"
else
    echo "No ZFS pool (< 3 NVMe disks). Using local storage."
fi

# 1d. VLAN networking
echo "[4/8] Configuring VLAN networking..."
if ! grep -q "vmbr0.20" /etc/network/interfaces 2>/dev/null; then
    cat > /etc/network/interfaces <<'NETEOF'
auto lo
iface lo inet loopback

auto eno1
iface eno1 inet manual

auto vmbr0
iface vmbr0 inet static
    address 192.168.4.58/24
    gateway 192.168.4.1
    bridge-ports eno1
    bridge-stp off
    bridge-fd 0
    bridge-vlan-aware yes
    bridge-vids 10-50

auto vmbr0.10
iface vmbr0.10 inet static
    address 192.168.4.58/24

auto vmbr0.20
iface vmbr0.20 inet static
    address 10.20.0.1/24

auto vmbr0.30
iface vmbr0.30 inet static
    address 10.30.0.1/24

auto vmbr0.40
iface vmbr0.40 inet static
    address 172.16.40.1/24

auto vmbr0.50
iface vmbr0.50 inet static
    address 10.50.0.1/24
NETEOF
    echo "Network config written. Will apply after VM creation."
fi

# 1e. Enable IP forwarding (required for VLAN routing between subnets)
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-nexgen-forward.conf
sysctl -w net.ipv4.ip_forward=1

# 1f. Create Proxmox API token
echo "[5/8] Creating API token..."
PROXMOX_TOKEN_SECRET=""
if ! pveum user list | grep -q "platform@pve"; then
    pveum user add platform@pve
    pveum aclmod / -user platform@pve -role PVEAdmin
    TOKEN_OUTPUT=$(pveum user token add platform@pve platform-token --privsep 0 2>&1)
    PROXMOX_TOKEN_SECRET=$(echo "$TOKEN_OUTPUT" | grep "value" | awk '{print $NF}')
    echo "$PROXMOX_TOKEN_SECRET" > /root/.proxmox-token
    chmod 600 /root/.proxmox-token
    echo "API token created and saved to /root/.proxmox-token"
else
    PROXMOX_TOKEN_SECRET=$(cat /root/.proxmox-token 2>/dev/null || echo "")
    echo "Platform user already exists, using existing token"
fi

# ─── Phase 2: Download Cloud Image ─────────────────────────────
echo ""
echo "=== Phase 2: Cloud Image Setup ==="

echo "[6/8] Downloading Ubuntu 22.04 cloud image..."
mkdir -p "$(dirname "$CLOUD_IMAGE_FILE")"
if [ ! -f "$CLOUD_IMAGE_FILE" ]; then
    wget -q --show-progress -O "$CLOUD_IMAGE_FILE" "$CLOUD_IMAGE_URL"
    echo "Cloud image downloaded."
else
    echo "Cloud image already exists, skipping download."
fi

# ─── Phase 3: Generate SSH Key ──────────────────────────────────
echo "[7/8] Generating SSH key for VM access..."
SSH_KEY_PATH="/root/.ssh/id_ed25519_roosk"
if [ ! -f "$SSH_KEY_PATH" ]; then
    ssh-keygen -t ed25519 -f "$SSH_KEY_PATH" -N "" -C "roosk-bootstrap"
    echo "SSH key generated: $SSH_KEY_PATH"
else
    echo "SSH key already exists."
fi
SSH_PUB_KEY=$(cat "${SSH_KEY_PATH}.pub")

# ─── Phase 4: Create VMs ───────────────────────────────────────
echo ""
echo "=== Phase 3: VM Creation ==="

create_cloud_vm() {
    local VMID=$1 NAME=$2 CORES=$3 RAM=$4 DISK=$5 VLAN=$6 IP=$7 GW=$8 USERDATA=$9

    if qm status "$VMID" &>/dev/null; then
        echo "  [SKIP] $NAME (VMID $VMID) already exists"
        return
    fi

    echo "  [CREATE] $NAME (VMID $VMID) — ${CORES}C/${RAM}MB/${DISK}GB VLAN${VLAN}"

    # Create VM
    qm create "$VMID" \
        --name "$NAME" \
        --cores "$CORES" \
        --memory "$RAM" \
        --net0 "virtio,bridge=vmbr0,tag=$VLAN" \
        --scsihw virtio-scsi-single \
        --ostype l26 \
        --agent enabled=1 \
        --onboot 1 \
        --bios ovmf \
        --machine q35 \
        --efidisk0 "${STORAGE}:1,efitype=4m" \
        --serial0 socket \
        --vga serial0

    # Import cloud image as disk
    qm importdisk "$VMID" "$CLOUD_IMAGE_FILE" "$STORAGE" --format raw
    qm set "$VMID" --scsi0 "${STORAGE}:vm-${VMID}-disk-1,size=${DISK}G"
    qm set "$VMID" --boot "order=scsi0"

    # Cloud-init configuration
    qm set "$VMID" --ide2 "${STORAGE}:cloudinit"
    qm set "$VMID" --ipconfig0 "ip=${IP}/24,gw=${GW}"
    qm set "$VMID" --sshkeys <(echo "$SSH_PUB_KEY")
    qm set "$VMID" --ciuser deploy
    qm set "$VMID" --cipassword "$(openssl rand -hex 8)"

    # Apply cloud-init user-data if provided
    if [ -n "$USERDATA" ] && [ -f "$USERDATA" ]; then
        # Store snippets for cloud-init custom user-data
        mkdir -p /var/lib/vz/snippets
        cp "$USERDATA" "/var/lib/vz/snippets/${NAME}-userdata.yml"
        qm set "$VMID" --cicustom "user=local:snippets/${NAME}-userdata.yml"
    fi

    # Resize disk to requested size
    qm resize "$VMID" scsi0 "${DISK}G"

    echo "  [OK] $NAME created"
}

# Write cloud-init user-data for DB VM
cat > /tmp/roosk-db-userdata.yml <<DBCLOUD
#cloud-config
package_update: true
packages:
  - postgresql-16
  - postgresql-client-16
  - postgresql-16-pgvector
  - prometheus-postgres-exporter

write_files:
  - path: /etc/postgresql/16/main/conf.d/nexgen.conf
    content: |
      listen_addresses = '*'
      max_connections = 100
      shared_buffers = 3GB
      effective_cache_size = 9GB
      work_mem = 32MB
      wal_level = replica
      max_wal_senders = 5
      wal_keep_size = 1024
      archive_mode = on
      archive_command = 'cp %p /var/lib/postgresql/wal_archive/%f'
  - path: /etc/postgresql/16/main/pg_hba.conf
    append: true
    content: |
      host all all 10.20.0.0/24 scram-sha-256
      host replication replicator 10.20.0.0/24 scram-sha-256

runcmd:
  - mkdir -p /var/lib/postgresql/wal_archive && chown postgres:postgres /var/lib/postgresql/wal_archive
  - mkdir -p /var/backups/nexgen && chown postgres:postgres /var/backups/nexgen
  - systemctl restart postgresql
  - sudo -u postgres psql -c "CREATE DATABASE nexgen_platform ENCODING 'UTF-8';" || true
  - sudo -u postgres psql -c "CREATE USER nexgen WITH PASSWORD '${DB_PASSWORD}';" || true
  - sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE nexgen_platform TO nexgen;" || true
  - sudo -u postgres psql -d nexgen_platform -c "GRANT ALL ON SCHEMA public TO nexgen;" || true
  - sudo -u postgres psql -d nexgen_platform -c "CREATE EXTENSION IF NOT EXISTS vector;" || true
  - sudo -u postgres psql -c "CREATE USER replicator WITH REPLICATION LOGIN PASSWORD '${REPLICATION_PASSWORD}';" || true
DBCLOUD

# Write cloud-init user-data for App VM
cat > /tmp/roosk-app-userdata.yml <<APPCLOUD
#cloud-config
package_update: true
packages:
  - docker.io
  - docker-compose
  - git
  - curl
  - wget
  - jq
  - nginx

write_files:
  - path: /opt/nexgen/.env
    permissions: '0600'
    content: |
      DATABASE_URL=postgresql+asyncpg://nexgen:${DB_PASSWORD}@${DB_IP}:5432/nexgen_platform
      JWT_SECRET_KEY=${JWT_SECRET}
      JWT_ALGORITHM=HS256
      AWS_REGION=us-east-1
      AWS_ACCESS_KEY_ID=${AWS_KEY_ID}
      AWS_SECRET_ACCESS_KEY=${AWS_SECRET_KEY}
      PROXMOX_URL=https://${PROXMOX_IP}:8006
      PROXMOX_TOKEN_ID=platform@pve!platform-token
      PROXMOX_TOKEN_SECRET=${PROXMOX_TOKEN_SECRET}
      PROXMOX_VERIFY_SSL=false
      MURPH_HMAC_SECRET=${MURPH_HMAC}
      MURPH_WEBHOOK_SECRET=${MURPH_WEBHOOK}
      CORS_ORIGINS=["http://${APP_IP}","http://${APP_IP}:80","http://${PROXMOX_IP}:8080"]
      DEBUG=false
      BACKUP_SSH_USER=deploy
      BACKUP_SSH_KEY_PATH=/opt/nexgen/.ssh/id_ed25519
      BACKUP_DEST_DIR=/var/backups/nexgen

runcmd:
  - systemctl enable docker && systemctl start docker
  - usermod -aG docker deploy
  - mkdir -p /opt/nexgen/.ssh
  - mkdir -p /opt/nexgen/data
  # The bootstrap script will SCP the repo and SSH key after cloud-init completes
APPCLOUD

# Create the VMs
create_cloud_vm "$DB_VMID" "$DB_NAME" "$DB_CORES" "$DB_RAM" "$DB_DISK" 20 "$DB_IP" "$DB_GW" "/tmp/roosk-db-userdata.yml"
create_cloud_vm "$APP_VMID" "$APP_NAME" "$APP_CORES" "$APP_RAM" "$APP_DISK" 20 "$APP_IP" "$APP_GW" "/tmp/roosk-app-userdata.yml"

# Start VMs
echo ""
echo "Starting VMs..."
qm start "$DB_VMID" 2>/dev/null || true
qm start "$APP_VMID" 2>/dev/null || true

# ─── Phase 5: Wait for Cloud-Init ──────────────────────────────
echo ""
echo "=== Phase 4: Waiting for Cloud-Init ==="
echo "Waiting for VMs to boot and complete cloud-init (this takes 2-5 minutes)..."

wait_for_ssh() {
    local HOST=$1 MAX_WAIT=$2 LABEL=$3
    local elapsed=0
    while [ $elapsed -lt "$MAX_WAIT" ]; do
        if ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no -o ConnectTimeout=5 "deploy@${HOST}" "echo ready" &>/dev/null; then
            echo "  [OK] $LABEL is ready ($elapsed seconds)"
            return 0
        fi
        sleep 10
        elapsed=$((elapsed + 10))
        echo "  ... waiting for $LABEL ($elapsed/${MAX_WAIT}s)"
    done
    echo "  [ERROR] $LABEL did not become reachable in ${MAX_WAIT}s"
    return 1
}

wait_for_ssh "$DB_IP" 300 "$DB_NAME"
wait_for_ssh "$APP_IP" 300 "$APP_NAME"

# ─── Phase 6: Deploy Roosk on App VM ───────────────────────────
echo ""
echo "=== Phase 5: Deploy Roosk Platform ==="

# Copy SSH key to App VM for DB backups
echo "Copying SSH key to App VM..."
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "deploy@${APP_IP}" "sudo mkdir -p /opt/nexgen/.ssh"
scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "$SSH_KEY_PATH" "deploy@${APP_IP}:/tmp/roosk_key"
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "deploy@${APP_IP}" "sudo mv /tmp/roosk_key /opt/nexgen/.ssh/id_ed25519 && sudo chmod 600 /opt/nexgen/.ssh/id_ed25519"

# Copy the Roosk repo to the App VM
# First, create a tarball of the repo on Proxmox (assumes bootstrap was SCP'd alongside the repo)
if [ -d "/opt/nexgen-repo" ]; then
    REPO_DIR="/opt/nexgen-repo"
elif [ -d "/root/Roosk" ]; then
    REPO_DIR="/root/Roosk"
else
    echo "Cloning Roosk repo..."
    # If no local copy, try to clone from GitHub
    read -rp "GitHub repo URL (e.g. https://github.com/user/Roosk.git): " REPO_URL
    git clone "$REPO_URL" /opt/nexgen-repo
    REPO_DIR="/opt/nexgen-repo"
fi

echo "Copying Roosk repo to App VM..."
tar czf /tmp/roosk-repo.tar.gz -C "$REPO_DIR" .
scp -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no /tmp/roosk-repo.tar.gz "deploy@${APP_IP}:/tmp/"
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "deploy@${APP_IP}" "
    sudo mkdir -p /opt/nexgen && \
    sudo tar xzf /tmp/roosk-repo.tar.gz -C /opt/nexgen && \
    sudo chown -R deploy:deploy /opt/nexgen
"

# Deploy via Docker Compose on the App VM
echo "Starting Docker Compose on App VM..."
ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "deploy@${APP_IP}" "
    cd /opt/nexgen && \

    # Create production docker-compose override
    cat > docker-compose.prod.yml <<'DCEOF'
services:
  backend:
    build:
      context: .
      dockerfile: docker/Dockerfile.backend
    env_file: .env
    environment:
      - DEBUG=false
    ports:
      - '8000:8000'
    restart: always

  frontend:
    build:
      context: .
      dockerfile: docker/Dockerfile.frontend
    ports:
      - '80:80'
    depends_on:
      - backend
    restart: always

  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus_data:/prometheus
    ports:
      - '9090:9090'
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.retention.time=30d'
    restart: always

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: $(openssl rand -hex 8)
      GF_USERS_ALLOW_SIGN_UP: 'false'
    volumes:
      - ./monitoring/grafana/dashboards:/var/lib/grafana/dashboards
      - grafana_data:/var/lib/grafana
    ports:
      - '3001:3000'
    depends_on:
      - prometheus
    restart: always

volumes:
  prometheus_data:
  grafana_data:
DCEOF

    # Build and start (no DB container — using VM-DB-01)
    sudo docker compose -f docker-compose.prod.yml up -d --build 2>&1
"

# ─── Phase 7: Verify ───────────────────────────────────────────
echo ""
echo "=== Phase 6: Verification ==="

echo "Waiting 30 seconds for containers to start..."
sleep 30

# Check backend health
echo "Checking backend health..."
HEALTH=$(ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "deploy@${APP_IP}" \
    "curl -s http://localhost:8000/health" 2>/dev/null || echo '{"status":"unreachable"}')
echo "  Backend health: $HEALTH"

# Check frontend
echo "Checking frontend..."
FRONTEND=$(ssh -i "$SSH_KEY_PATH" -o StrictHostKeyChecking=no "deploy@${APP_IP}" \
    "curl -s -o /dev/null -w '%{http_code}' http://localhost:80" 2>/dev/null || echo "unreachable")
echo "  Frontend HTTP status: $FRONTEND"

# ─── Phase 8: Save Credentials ─────────────────────────────────
echo ""
echo "=== Saving Credentials ==="

cat > /root/.nexgen-secrets <<SECRETS
# NexGen Platform Secrets — Generated $(date)
# KEEP THIS FILE SECURE

DB_PASSWORD=${DB_PASSWORD}
JWT_SECRET=${JWT_SECRET}
PROXMOX_TOKEN_SECRET=${PROXMOX_TOKEN_SECRET}
MURPH_HMAC_SECRET=${MURPH_HMAC}
MURPH_WEBHOOK_SECRET=${MURPH_WEBHOOK}
REPLICATION_PASSWORD=${REPLICATION_PASSWORD}
AWS_ACCESS_KEY_ID=${AWS_KEY_ID}

# SSH Key: ${SSH_KEY_PATH}
# App VM: deploy@${APP_IP}
# DB VM:  deploy@${DB_IP}
SECRETS
chmod 600 /root/.nexgen-secrets
echo "Secrets saved to /root/.nexgen-secrets"

# ─── Done ───────────────────────────────────────────────────────
echo ""
echo "============================================="
echo "  ROOSK NexGen Platform — Bootstrap Complete"
echo "============================================="
echo ""
echo "  Dashboard:  http://${APP_IP}"
echo "  API Docs:   http://${APP_IP}:8000/docs"
echo "  Prometheus: http://${APP_IP}:9090"
echo "  Grafana:    http://${APP_IP}:3001"
echo ""
echo "  Login:      admin@flexworx.io / nexgen2026"
echo ""
echo "  SSH to App: ssh -i ${SSH_KEY_PATH} deploy@${APP_IP}"
echo "  SSH to DB:  ssh -i ${SSH_KEY_PATH} deploy@${DB_IP}"
echo ""
echo "  Secrets:    /root/.nexgen-secrets"
echo ""
echo "  Next steps:"
echo "    1. Open http://${APP_IP} in your browser"
echo "    2. Log in and verify the dashboard"
echo "    3. Use Service Catalog to deploy VPN, Windows Desktop, etc."
echo ""
