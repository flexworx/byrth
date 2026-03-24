#!/bin/bash
# =============================================================================
# Proxmox VE Post-Install Configuration Script
# Dell PowerEdge R7625 — NexGen Platform
# Run this AFTER Proxmox VE 9.1 ISO installation completes
# =============================================================================
set -euo pipefail

echo "=== NexGen Proxmox Post-Install Script ==="
echo "Target: Dell PowerEdge R7625"
echo "Date: $(date)"

# 1. Remove enterprise repo (no subscription), add no-subscription repo
echo "[1/10] Configuring APT repositories..."
rm -f /etc/apt/sources.list.d/pve-enterprise.list
cat > /etc/apt/sources.list.d/pve-no-subscription.list <<EOF
deb http://download.proxmox.com/debian/pve bookworm pve-no-subscription
EOF
apt-get update -y
apt-get dist-upgrade -y

# 2. Install required packages
echo "[2/10] Installing dependencies..."
apt-get install -y \
    sudo curl wget git htop iotop tmux vim \
    zfsutils-linux \
    python3 python3-pip python3-venv \
    nginx certbot \
    open-iscsi nfs-common \
    jq unzip

# 3. Configure ZFS RAIDZ1 (3x NVMe)
echo "[3/10] Setting up ZFS RAIDZ1..."
NVME_DISKS=$(ls /dev/nvme*n1 2>/dev/null | grep -v p | head -3)
DISK_COUNT=$(echo "$NVME_DISKS" | wc -l)

if [ "$DISK_COUNT" -ge 3 ]; then
    # Only create pool if it doesn't exist
    if ! zpool list nexgen-pool &>/dev/null; then
        echo "Creating ZFS pool: nexgen-pool (RAIDZ1)"
        zpool create -f nexgen-pool raidz1 $NVME_DISKS

        # Create datasets
        zfs create nexgen-pool/vms
        zfs create nexgen-pool/backups
        zfs create nexgen-pool/iso
        zfs create nexgen-pool/templates

        # Set compression and properties
        zfs set compression=lz4 nexgen-pool
        zfs set atime=off nexgen-pool
        zfs set recordsize=128k nexgen-pool/vms
        zfs set recordsize=1M nexgen-pool/backups

        echo "ZFS pool created successfully"
    else
        echo "ZFS pool nexgen-pool already exists, skipping"
    fi
else
    echo "WARNING: Found $DISK_COUNT NVMe disks (need 3). Skipping ZFS setup."
    echo "Configure manually after verifying disk layout."
fi

# 4. Add ZFS storage to Proxmox
echo "[4/10] Configuring Proxmox storage..."
if ! pvesm status | grep -q nexgen-vms; then
    pvesm add zfspool nexgen-vms -pool nexgen-pool/vms -content images,rootdir
    pvesm add dir nexgen-backups -path /nexgen-pool/backups -content backup,snippets
    pvesm add dir nexgen-iso -path /nexgen-pool/iso -content iso,vztmpl
    echo "Proxmox storage configured"
else
    echo "Storage already configured, skipping"
fi

# 5. Configure VLAN-aware networking
echo "[5/10] Setting up VLAN networking..."
cat > /etc/network/interfaces <<'NETEOF'
auto lo
iface lo inet loopback

# Physical NIC
auto eno1
iface eno1 inet manual

# Main bridge (VLAN-aware)
auto vmbr0
iface vmbr0 inet static
    address 192.168.4.58/24
    gateway 192.168.4.1
    bridge-ports eno1
    bridge-stp off
    bridge-fd 0
    bridge-vlan-aware yes
    bridge-vids 10-50

# VLAN 10 — Management
auto vmbr0.10
iface vmbr0.10 inet static
    address 192.168.4.58/24

# VLAN 20 — Control Plane
auto vmbr0.20
iface vmbr0.20 inet static
    address 10.20.0.1/24

# VLAN 30 — Tenant
auto vmbr0.30
iface vmbr0.30 inet static
    address 10.30.0.1/24

# VLAN 40 — DMZ
auto vmbr0.40
iface vmbr0.40 inet static
    address 172.16.40.1/24

# VLAN 50 — Storage
auto vmbr0.50
iface vmbr0.50 inet static
    address 10.50.0.1/24
NETEOF

echo "Network configuration written. Restart networking after review."

# 6. Create Proxmox API token for platform
echo "[6/10] Creating API token..."
if ! pveum user list | grep -q "platform@pve"; then
    pveum user add platform@pve
    pveum aclmod / -user platform@pve -role PVEAdmin
    TOKEN_OUTPUT=$(pveum user token add platform@pve platform-token --privsep 0 2>&1)
    TOKEN_VALUE=$(echo "$TOKEN_OUTPUT" | grep "value" | awk '{print $NF}')
    echo "API Token created. Save this value securely:"
    echo "Token ID: platform@pve!platform-token"
    echo "Token Value: $TOKEN_VALUE"
    echo "$TOKEN_VALUE" > /root/.proxmox-token
    chmod 600 /root/.proxmox-token
else
    echo "Platform user already exists, skipping"
fi

# 7. Download ISO templates
echo "[7/10] Downloading ISO templates..."
ISO_DIR="/nexgen-pool/iso/template/iso"
mkdir -p "$ISO_DIR"

if [ ! -f "$ISO_DIR/ubuntu-22.04.iso" ]; then
    echo "Downloading Ubuntu 22.04 LTS..."
    wget -q -O "$ISO_DIR/ubuntu-22.04.iso" \
        "https://releases.ubuntu.com/22.04.5/ubuntu-22.04.5-live-server-amd64.iso" || \
        echo "Ubuntu ISO download failed — download manually"
fi

# 8. Enable Proxmox backup scheduler
echo "[8/10] Configuring backup schedule..."
cat > /etc/pve/jobs.cfg <<'JOBEOF'
vzdump: daily-backup
    enabled 1
    schedule daily
    storage nexgen-backups
    mode snapshot
    compress zstd
    mailnotification always
    mailto admin@flexworx.io
    all 1
JOBEOF
echo "Daily backup job configured"

# 9. Security hardening
echo "[9/10] Applying security hardening..."
# SSH hardening
sed -i 's/#PermitRootLogin yes/PermitRootLogin prohibit-password/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config

# Firewall
pve-firewall enable 2>/dev/null || true

# Fail2ban
apt-get install -y fail2ban
systemctl enable fail2ban
systemctl start fail2ban

echo "Security hardening applied"

# 10. Clone the NexGen platform repo
echo "[10/10] Setting up NexGen platform..."
if [ ! -d "/opt/nexgen" ]; then
    mkdir -p /opt/nexgen
    echo "Platform directory created at /opt/nexgen"
    echo "Clone the Roosk repo here after Gitea is set up"
fi

echo ""
echo "=== Post-install complete ==="
echo "Next steps:"
echo "  1. Review /etc/network/interfaces and reboot"
echo "  2. Verify ZFS pool: zpool status nexgen-pool"
echo "  3. Run 02-create-vms.sh to provision all VMs"
echo "  4. Run 03-install-gitea.sh for Gitea"
echo ""
