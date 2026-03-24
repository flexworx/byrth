#!/bin/bash
# =============================================================================
# VM Provisioning Script — Creates all 10 NexGen VMs on Proxmox
# Per Addendum v1.1 inventory (VM-LLM-01 deferred)
# =============================================================================
set -euo pipefail

echo "=== NexGen VM Provisioning ==="
NODE="r7625"
STORAGE="nexgen-vms"
ISO_STORAGE="nexgen-iso"
UBUNTU_ISO="ubuntu-22.04.iso"

# Read API token
if [ -f /root/.proxmox-token ]; then
    echo "Using stored API token"
fi

create_vm() {
    local VMID=$1
    local NAME=$2
    local CORES=$3
    local RAM_MB=$4
    local DISK_GB=$5
    local VLAN=$6
    local IP=$7
    local TAGS=$8

    if qm status "$VMID" &>/dev/null; then
        echo "  [SKIP] VMID $VMID ($NAME) already exists"
        return
    fi

    echo "  [CREATE] $NAME (VMID $VMID) — ${CORES}C/${RAM_MB}MB/${DISK_GB}GB VLAN${VLAN}"

    qm create "$VMID" \
        --name "$NAME" \
        --cores "$CORES" \
        --memory "$RAM_MB" \
        --net0 "virtio,bridge=vmbr0,tag=$VLAN" \
        --scsihw virtio-scsi-single \
        --scsi0 "${STORAGE}:${DISK_GB},format=raw" \
        --ide2 "${ISO_STORAGE}:iso/${UBUNTU_ISO},media=cdrom" \
        --boot "order=scsi0;ide2;net0" \
        --ostype l26 \
        --agent enabled=1 \
        --tags "$TAGS" \
        --onboot 1 \
        --description "NexGen Platform VM — $NAME"

    # Set cloud-init IP if applicable
    if [ "$IP" != "dhcp" ]; then
        qm set "$VMID" --ipconfig0 "ip=${IP},gw=$(echo "$IP" | sed 's/\.[0-9]*\//.1\//' | cut -d'/' -f1)"
    fi
}

echo ""
echo "--- Provisioning VMs ---"
echo ""

# VMID  NAME           CORES  RAM     DISK  VLAN  IP                TAGS
create_vm 100 "VM-FW-01"     2  4096    32   0    "dhcp"            "firewall;opnsense"
create_vm 101 "VM-IAM-01"    4  8192   100  10    "192.168.4.20/24" "keycloak;iam"
create_vm 102 "VM-SEC-01"    2  6144   100  10    "192.168.4.30/24" "vault;secrets"
create_vm 103 "VM-SIEM-01"   4 10240   300  10    "192.168.4.40/24" "wazuh;siem"
create_vm 104 "VM-APP-01"    8 12288   200  20    "10.20.0.10/24"    "platform;api"
create_vm 105 "VM-DB-01"     4 12288   500  20    "10.20.0.20/24"    "postgresql;primary"
create_vm 106 "VM-DB-02"     4  8192   500  20    "10.20.0.21/24"    "postgresql;replica"
create_vm 107 "VM-MON-01"    4  8192   200  10    "192.168.4.50/24" "prometheus;grafana"
create_vm 108 "VM-GIT-01"    2  6144   200  20    "10.20.0.30/24"    "gitea;git"
create_vm 109 "VM-PROXY-01"  2  4096    50  40    "172.16.40.10/24"  "nginx;proxy"

echo ""
echo "=== VM Provisioning Complete ==="
echo ""
echo "Total RAM allocated: 78 GB / 128 GB available"
echo "Total Disk allocated: 2,182 GB"
echo ""
echo "Next steps:"
echo "  1. Install OS on each VM (start with VM-FW-01 for OPNsense)"
echo "  2. Run 03-install-gitea.sh on VM-GIT-01"
echo "  3. Run Ansible playbooks for service configuration"
echo ""
echo "To start all VMs: for i in \$(seq 100 109); do qm start \$i; done"
echo "To check status:  qm list"
echo ""
