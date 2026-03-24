#!/bin/bash
# =============================================================================
# ROOSK — Phase 1: Proxmox Setup
# Run on Proxmox server after fresh install
#
# Usage:
#   scp 01-setup-proxmox.sh root@192.168.4.58:/root/
#   ssh root@192.168.4.58 "bash /root/01-setup-proxmox.sh"
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${CYAN}[ROOSK]${NC} $1"; }
ok()  { echo -e "${GREEN}  OK${NC} $1"; }
warn(){ echo -e "${YELLOW}  WARN${NC} $1"; }
err() { echo -e "${RED}  FAIL${NC} $1"; exit 1; }

echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}  ROOSK — Phase 1: Proxmox Setup${NC}"
echo -e "${CYAN}  Dell PowerEdge R7625${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

# Must be root
[ "$(id -u)" -eq 0 ] || err "Must run as root"

# Must be Proxmox
command -v pvesh &>/dev/null || err "Not a Proxmox host"

# ─── 1. APT Repos ────────────────────────────────────────────────
log "Step 1/7: Configuring APT repositories..."
rm -f /etc/apt/sources.list.d/pve-enterprise.list 2>/dev/null || true

cat > /etc/apt/sources.list.d/pve-no-subscription.list <<EOF
deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription
EOF

apt-get update -y
DEBIAN_FRONTEND=noninteractive apt-get dist-upgrade -y
ok "APT repos configured and packages updated"

# ─── 2. Install Packages ─────────────────────────────────────────
log "Step 2/7: Installing required packages..."
DEBIAN_FRONTEND=noninteractive apt-get install -y \
    sudo curl wget git htop tmux vim jq unzip \
    python3 python3-pip python3-venv \
    docker.io docker-compose \
    fail2ban \
    libguestfs-tools cloud-init
ok "Packages installed"

# Enable Docker
systemctl enable docker
systemctl start docker
ok "Docker enabled"

# ─── 3. ZFS Storage Pool ─────────────────────────────────────────
log "Step 3/7: Checking ZFS storage..."

# Find NVMe disks (exclude the BOSS boot drive)
BOOT_DISK=$(mount | grep "on / " | awk '{print $1}' | sed 's/[0-9]*$//' | sed 's/p[0-9]*$//')
NVME_DISKS=()
for disk in /dev/nvme*n1; do
    [ -e "$disk" ] || continue
    # Skip boot disk
    if [[ "$disk" == "$BOOT_DISK"* ]] || [[ "$BOOT_DISK" == "$disk"* ]]; then
        continue
    fi
    NVME_DISKS+=("$disk")
done

if [ ${#NVME_DISKS[@]} -ge 3 ]; then
    if ! zpool list nexgen-pool &>/dev/null; then
        log "Creating ZFS RAIDZ1 from ${NVME_DISKS[*]}..."
        zpool create -f nexgen-pool raidz1 "${NVME_DISKS[@]}"
        zfs set compression=lz4 nexgen-pool
        zfs set atime=off nexgen-pool
        zfs create nexgen-pool/vms
        zfs create nexgen-pool/backups
        zfs create nexgen-pool/isos
        ok "ZFS pool created: nexgen-pool (RAIDZ1, ~7.5TB usable)"
    else
        ok "ZFS pool nexgen-pool already exists"
    fi

    # Register with Proxmox
    pvesm add zfspool nexgen-vms -pool nexgen-pool/vms -content images,rootdir 2>/dev/null || true
    pvesm add dir nexgen-backup -path /nexgen-pool/backups -content backup 2>/dev/null || true
    ok "ZFS storage registered in Proxmox"
elif [ ${#NVME_DISKS[@]} -ge 1 ]; then
    warn "Found ${#NVME_DISKS[@]} data NVMe disk(s) (need 3 for RAIDZ1). Using local storage for now."
else
    warn "No extra NVMe disks found. Using local storage."
fi

# ─── 4. Proxmox API Token ────────────────────────────────────────
log "Step 4/7: Creating Proxmox API token..."
TOKEN_FILE="/root/.proxmox-token"

if [ ! -f "$TOKEN_FILE" ]; then
    pveum user add platform@pve --comment "Roosk Platform Service Account" 2>/dev/null || true
    pveum aclmod / -user platform@pve -role PVEAdmin 2>/dev/null || true
    TOKEN_OUTPUT=$(pveum user token add platform@pve platform-token --privsep 0 2>&1 || echo "exists")
    if [ "$TOKEN_OUTPUT" != "exists" ]; then
        PROXMOX_TOKEN=$(echo "$TOKEN_OUTPUT" | grep "value" | awk '{print $NF}')
        echo "$PROXMOX_TOKEN" > "$TOKEN_FILE"
        chmod 600 "$TOKEN_FILE"
        ok "API token created and saved to $TOKEN_FILE"
    else
        ok "API token already exists"
    fi
else
    ok "API token file already exists"
fi

# ─── 5. Download Ubuntu Cloud Image ──────────────────────────────
log "Step 5/7: Downloading Ubuntu cloud image..."
CLOUD_IMG="/var/lib/vz/template/qcow2/ubuntu-22.04-cloud.img"
mkdir -p "$(dirname "$CLOUD_IMG")"

if [ ! -f "$CLOUD_IMG" ]; then
    wget -q --show-progress -O "$CLOUD_IMG" \
        "https://cloud-images.ubuntu.com/jammy/current/jammy-server-cloudimg-amd64.img"
    ok "Ubuntu 22.04 cloud image downloaded"
else
    ok "Cloud image already exists"
fi

# ─── 6. Generate SSH Key ─────────────────────────────────────────
log "Step 6/7: Generating SSH key..."
SSH_KEY="/root/.ssh/id_ed25519_roosk"
if [ ! -f "$SSH_KEY" ]; then
    ssh-keygen -t ed25519 -f "$SSH_KEY" -N "" -C "roosk-deploy"
    ok "SSH key generated: $SSH_KEY"
else
    ok "SSH key already exists"
fi

# ─── 7. IP Forwarding ────────────────────────────────────────────
log "Step 7/7: Enabling IP forwarding..."
echo "net.ipv4.ip_forward=1" > /etc/sysctl.d/99-roosk-forward.conf
sysctl -w net.ipv4.ip_forward=1 >/dev/null
ok "IP forwarding enabled"

# ─── Done ─────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  Phase 1 Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "  Proxmox is configured and ready."
echo ""
echo "  Next: Run Phase 2 to deploy Roosk:"
echo "    bash /root/02-deploy-roosk.sh"
echo ""
echo "  Or copy it from your laptop first:"
echo "    scp 02-deploy-roosk.sh root@192.168.4.58:/root/"
echo ""
