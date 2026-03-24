#!/bin/bash
# =============================================================================
#  ROOSK.AI — EZ DEPLOY
#  One script to rule them all.
#
#  Run this from your Proxmox shell after fresh install:
#    curl -sL http://YOUR_PC_IP:9999/00-ez-deploy.sh | bash
#    — OR —
#    scp this file to Proxmox and run: bash /root/00-ez-deploy.sh
#
#  What it does:
#    Phase 1: Configure Proxmox (ZFS, VLANs, API token, security)
#    Phase 2: Create the first VM (VM-APP-01) and deploy the platform
#    Phase 3: You access https://roosk.ai from your browser
#    Phase 4: Remaining VMs are created from the dashboard
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG="/root/roosk-deploy.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${CYAN}[ROOSK]${NC} $1" | tee -a "$LOG"; }
ok()  { echo -e "${GREEN}  ✓${NC} $1" | tee -a "$LOG"; }
warn(){ echo -e "${YELLOW}  ⚠${NC} $1" | tee -a "$LOG"; }
err() { echo -e "${RED}  ✗${NC} $1" | tee -a "$LOG"; exit 1; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║         ROOSK.AI — NexGen Platform Deployer         ║${NC}"
echo -e "${CYAN}║         Dell PowerEdge R7625 · Proxmox VE           ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── PREFLIGHT CHECKS ───────────────────────────────────────────────────
log "Running preflight checks..."

# Must be root
[ "$(id -u)" -eq 0 ] || err "Must run as root"

# Must be Proxmox
command -v pvesh &>/dev/null || err "This doesn't look like a Proxmox host"

# Check disks for ZFS
DISKS=($(lsblk -d -n -o NAME,TYPE | awk '$2=="disk" && $1!="sda" {print "/dev/"$1}'))
log "Found ${#DISKS[@]} data disks: ${DISKS[*]:-none}"

ok "Preflight passed"
echo ""

# ─── PHASE 1: PROXMOX POST-INSTALL ──────────────────────────────────────
log "═══ PHASE 1: Proxmox Configuration ═══"

# 1a. APT repos
log "Configuring APT repositories..."
rm -f /etc/apt/sources.list.d/pve-enterprise.list
cat > /etc/apt/sources.list.d/pve-no-subscription.list <<EOF
deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription
EOF
apt-get update -y >> "$LOG" 2>&1
apt-get dist-upgrade -y >> "$LOG" 2>&1
ok "APT repos configured"

# 1b. Install dependencies
log "Installing packages..."
apt-get install -y sudo curl wget git htop tmux vim \
    zfsutils-linux python3 python3-pip python3-venv \
    nginx certbot open-iscsi nfs-common jq unzip >> "$LOG" 2>&1
ok "Packages installed"

# 1c. ZFS pool (if 3+ data disks found)
if [ ${#DISKS[@]} -ge 3 ]; then
    if ! zpool list nexgen-pool &>/dev/null; then
        log "Creating ZFS RAIDZ1 pool from ${DISKS[*]}..."
        zpool create -f nexgen-pool raidz1 "${DISKS[@]}"
        zfs set compression=lz4 nexgen-pool
        zfs set atime=off nexgen-pool
        zfs create nexgen-pool/vms
        zfs create nexgen-pool/isos
        zfs create nexgen-pool/backups
        ok "ZFS pool created: nexgen-pool (RAIDZ1)"
    else
        ok "ZFS pool nexgen-pool already exists"
    fi

    # Register with Proxmox
    pvesm add zfspool nexgen-vms -pool nexgen-pool/vms -content images,rootdir 2>/dev/null || true
    pvesm add dir nexgen-iso -path /nexgen-pool/isos -content iso,vztmpl 2>/dev/null || true
    pvesm add dir nexgen-backup -path /nexgen-pool/backups -content backup 2>/dev/null || true
else
    warn "Less than 3 data disks — skipping ZFS RAIDZ1 (using local-lvm)"
fi

# 1d. VLAN network bridges
log "Configuring VLANs..."
IFACES_FILE="/etc/network/interfaces"

configure_vlan() {
    local BRIDGE=$1 VLAN=$2 SUBNET=$3 GW_IP=$4 COMMENT=$5
    if grep -q "$BRIDGE" "$IFACES_FILE" 2>/dev/null; then
        ok "$BRIDGE already configured"
        return
    fi
    cat >> "$IFACES_FILE" <<EOF

# $COMMENT
auto ${BRIDGE}
iface ${BRIDGE} inet static
    address ${GW_IP}
    netmask 255.255.255.0
    bridge-ports none
    bridge-stp off
    bridge-fd 0
    bridge-vlan-aware yes
    bridge-vids ${VLAN}
EOF
    ok "Created $BRIDGE (VLAN $VLAN — $COMMENT)"
}

configure_vlan vmbr10 10 10.10.0.0/24 10.10.0.1 "Management"
configure_vlan vmbr20 20 10.20.0.0/24 10.20.0.1 "Control Plane"
configure_vlan vmbr30 30 10.30.0.0/24 10.30.0.1 "Tenant"
configure_vlan vmbr40 40 10.40.0.0/24 10.40.0.1 "DMZ"
configure_vlan vmbr50 50 10.50.0.0/24 10.50.0.1 "Storage"

# 1e. API token
log "Creating API token..."
TOKEN_FILE="/root/.proxmox-token"
if [ ! -f "$TOKEN_FILE" ]; then
    pveum user add platform@pve --comment "NexGen Platform Service Account" 2>/dev/null || true
    pveum aclmod / -user platform@pve -role PVEAdmin 2>/dev/null || true
    TOKEN_OUTPUT=$(pveum user token add platform@pve platform-token --privsep 0 2>/dev/null || echo "exists")
    if [ "$TOKEN_OUTPUT" != "exists" ]; then
        echo "$TOKEN_OUTPUT" > "$TOKEN_FILE"
        chmod 600 "$TOKEN_FILE"
        ok "API token created → $TOKEN_FILE"
    else
        ok "API token already exists"
    fi
else
    ok "API token file exists"
fi

# 1f. Download Ubuntu ISO
log "Checking for Ubuntu ISO..."
ISO_PATH="/var/lib/vz/template/iso/ubuntu-22.04.iso"
if [ ! -f "$ISO_PATH" ]; then
    log "Downloading Ubuntu 22.04 Server ISO (this takes a few minutes)..."
    wget -q -O "$ISO_PATH" \
        "https://releases.ubuntu.com/22.04/ubuntu-22.04.5-live-server-amd64.iso" || \
        warn "ISO download failed — download manually to $ISO_PATH"
else
    ok "Ubuntu ISO already present"
fi

# 1g. SSH hardening
log "Hardening SSH..."
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd 2>/dev/null || true
ok "SSH hardened (key-only access)"

echo ""
ok "PHASE 1 COMPLETE — Proxmox is configured"
echo ""

# ─── PHASE 2: CREATE VM-APP-01 & DEPLOY PLATFORM ─────────────────────────
log "═══ PHASE 2: Deploy Platform VM ═══"

VMID=110
VM_NAME="VM-APP-01"
CORES=4
RAM_MB=8192
DISK_GB=60
STORAGE="${STORAGE:-local-lvm}"

# Determine storage
if pvesm status | grep -q "nexgen-vms"; then
    STORAGE="nexgen-vms"
fi

# Check if VM-APP-01 already exists
if qm status $VMID &>/dev/null; then
    ok "VM-APP-01 (VMID $VMID) already exists"
else
    log "Creating VM-APP-01..."
    qm create $VMID \
        --name "$VM_NAME" \
        --cores $CORES \
        --memory $RAM_MB \
        --net0 "virtio,bridge=vmbr20,tag=20" \
        --scsihw virtio-scsi-pci \
        --scsi0 "${STORAGE}:${DISK_GB}" \
        --ide2 "local:iso/ubuntu-22.04.iso,media=cdrom" \
        --boot "order=ide2;scsi0" \
        --ostype l26 \
        --agent 1 \
        --tags "app,nexgen,phase1" \
        --description "NexGen Platform — FastAPI + Next.js"
    ok "VM-APP-01 created (VMID $VMID, ${CORES}C/${RAM_MB}MB/${DISK_GB}GB)"
fi

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║              PHASE 1 & 2 COMPLETE                   ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║  NEXT STEPS:                                         ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║  1. Open Proxmox UI: https://SERVER_IP:8006          ║${NC}"
echo -e "${CYAN}║  2. Start VM-APP-01 → Install Ubuntu 22.04           ║${NC}"
echo -e "${CYAN}║  3. Once Ubuntu is installed, SSH into VM-APP-01:    ║${NC}"
echo -e "${CYAN}║       ssh user@10.20.0.10                            ║${NC}"
echo -e "${CYAN}║  4. Run the platform deploy script:                  ║${NC}"
echo -e "${CYAN}║       bash /root/deploy-platform.sh                  ║${NC}"
echo -e "${CYAN}║  5. Access: http://10.20.0.10:3000                   ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║  DNS: Point roosk.ai → server's public IP            ║${NC}"
echo -e "${CYAN}║  SSL: Run scripts/init-ssl.sh after DNS propagates   ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# ─── Generate VM-APP-01 deploy script ────────────────────────────────────
log "Generating deploy script for VM-APP-01..."
cat > /root/deploy-platform.sh <<'DEPLOY_EOF'
#!/bin/bash
# =============================================================================
# Roosk.ai Platform Deploy — Run this INSIDE VM-APP-01 after Ubuntu install
# =============================================================================
set -euo pipefail

echo "=== Roosk.AI Platform Deployment ==="

PLATFORM_DIR="/opt/roosk"
DB_PASS="$(openssl rand -hex 16)"
JWT_SECRET="$(openssl rand -hex 32)"

# 1. System packages
echo "[1/8] Installing system packages..."
apt-get update -y
apt-get install -y python3.11 python3.11-venv python3-pip \
    postgresql postgresql-contrib \
    nginx certbot python3-certbot-nginx \
    git curl jq

# 2. Node.js 20
echo "[2/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 3. PostgreSQL
echo "[3/8] Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE USER roosk WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE roosk_platform OWNER roosk;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE roosk_platform TO roosk;" 2>/dev/null || true
echo "  ✓ Database: roosk_platform / user: roosk"

# 4. Clone repo
echo "[4/8] Cloning repository..."
mkdir -p "$PLATFORM_DIR"
if [ -d "$PLATFORM_DIR/.git" ]; then
    cd "$PLATFORM_DIR" && git pull
else
    # Try Gitea first, fallback to GitHub
    git clone https://github.com/YOUR_USER/roosk.git "$PLATFORM_DIR" 2>/dev/null || \
    git clone http://10.20.0.30:3000/admin/roosk.git "$PLATFORM_DIR" 2>/dev/null || \
    echo "  ⚠ Clone failed — copy files manually to $PLATFORM_DIR"
fi
cd "$PLATFORM_DIR"

# 5. Backend setup
echo "[5/8] Setting up FastAPI backend..."
cd "$PLATFORM_DIR/api-server"
python3.11 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
pip install email-validator bcrypt==4.2.1

cat > .env <<ENV
DATABASE_URL=postgresql+asyncpg://roosk:${DB_PASS}@localhost:5432/roosk_platform
JWT_SECRET_KEY=${JWT_SECRET}
DEBUG=false
CORS_ORIGINS=["https://roosk.ai","http://localhost:3000"]
PROXMOX_URL=https://10.10.0.1:8006
PROXMOX_TOKEN_ID=platform@pve!platform-token
PROXMOX_TOKEN_SECRET=PASTE_TOKEN_HERE
PROMETHEUS_ENABLED=true
ENV
echo "  ✓ Backend configured — edit .env to add PROXMOX_TOKEN_SECRET"

# 6. Frontend setup
echo "[6/8] Building Next.js frontend..."
cd "$PLATFORM_DIR"
npm ci
npm run build

# 7. Systemd services
echo "[7/8] Creating systemd services..."

cat > /etc/systemd/system/roosk-api.service <<SVC
[Unit]
Description=Roosk.AI FastAPI Backend
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${PLATFORM_DIR}/api-server
Environment=PATH=${PLATFORM_DIR}/api-server/venv/bin:/usr/bin
ExecStart=${PLATFORM_DIR}/api-server/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

cat > /etc/systemd/system/roosk-web.service <<SVC
[Unit]
Description=Roosk.AI Next.js Frontend
After=network.target roosk-api.service

[Service]
Type=simple
User=root
WorkingDirectory=${PLATFORM_DIR}
ExecStart=/usr/bin/node ${PLATFORM_DIR}/.next/standalone/server.js
Environment=PORT=3000
Environment=API_URL=http://127.0.0.1:8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
systemctl enable roosk-api roosk-web
systemctl start roosk-api roosk-web
echo "  ✓ Services started"

# 8. Nginx reverse proxy
echo "[8/8] Configuring Nginx..."
cat > /etc/nginx/sites-available/roosk <<'NGINX'
server {
    listen 80;
    server_name roosk.ai www.roosk.ai _;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # API
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /api/notifications/ws {
        proxy_pass http://127.0.0.1:8000/api/notifications/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Health
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }

    # API docs
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/roosk /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
echo "  ✓ Nginx configured"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          ROOSK.AI IS LIVE                            ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║                                                      ║"
echo "║  Dashboard: http://$(hostname -I | awk '{print $1}')                    ║"
echo "║  API Docs:  http://$(hostname -I | awk '{print $1}')/docs               ║"
echo "║  Login:     admin@flexworx.io / nexgen2026           ║"
echo "║                                                      ║"
echo "║  For SSL:                                            ║"
echo "║    certbot --nginx -d roosk.ai -d www.roosk.ai       ║"
echo "║                                                      ║"
echo "║  Services:                                           ║"
echo "║    systemctl status roosk-api roosk-web               ║"
echo "║                                                      ║"
echo "╚══════════════════════════════════════════════════════╝"
DEPLOY_EOF

chmod +x /root/deploy-platform.sh
ok "Deploy script saved → /root/deploy-platform.sh"

log "Full log saved → $LOG"
echo ""
echo -e "${GREEN}Done. Follow the NEXT STEPS above.${NC}"
