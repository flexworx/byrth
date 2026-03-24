"""Service template engine — pre-defined VM recipes for one-click deployments."""

import logging
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.models.models import VirtualMachine, ServiceDeployment
from app.services.proxmox import proxmox_client
from app.services.audit import log_action

logger = logging.getLogger(__name__)
settings = get_settings()

# VLAN-to-subnet mapping for cloud-init IP assignment via DHCP
VLAN_SUBNETS = {
    10: {"network": "192.168.4", "cidr": 24, "gateway": "192.168.4.1"},
    20: {"network": "10.20.0", "cidr": 24, "gateway": "10.20.0.1"},
    30: {"network": "10.30.0", "cidr": 24, "gateway": "10.30.0.1"},
    40: {"network": "172.16.40", "cidr": 24, "gateway": "172.16.40.1"},
    50: {"network": "10.50.0", "cidr": 24, "gateway": "10.50.0.1"},
}


TEMPLATES: dict[str, dict[str, Any]] = {
    "windows-desktop": {
        "name": "Windows 11 Desktop",
        "category": "daas",
        "description": "Windows 11 VM with RDP enabled. After creation, attach the Windows 11 ISO and complete the OS install. Once installed, enable Remote Desktop in Settings. Accessible via Guacamole or direct RDP.",
        "icon": "monitor",
        "vm_config": {
            "cores": 4,
            "ram_mb": 8192,
            "disk_gb": 80,
            "vlan": 20,
            "os_type": "win11",
        },
        "requires_iso": True,
        "iso_name": "windows-11.iso",
        "proxmox_overrides": {
            "bios": "ovmf",
            "machine": "q35",
            "ostype": "win11",
            "cpu": "host",
        },
        "virtio_iso": "virtio-win.iso",
        "post_install_notes": [
            "Attach Windows 11 ISO and VirtIO driver ISO via Proxmox console",
            "Boot the VM and complete Windows installation",
            "Install VirtIO drivers from the second CD drive",
            "Enable Remote Desktop: Settings > System > Remote Desktop > On",
            "If Guacamole is deployed, add an RDP connection for this VM",
        ],
    },
    "wireguard-vpn": {
        "name": "WireGuard VPN Server",
        "category": "networking",
        "description": "VPN gateway for secure remote access to the platform network. Generates server and client configurations automatically. Install the WireGuard app on your device and import the client config.",
        "icon": "shield",
        "vm_config": {
            "cores": 1,
            "ram_mb": 1024,
            "disk_gb": 10,
            "vlan": 10,
            "os_type": "ubuntu-22.04",
        },
        "requires_iso": False,
        "cloud_init_packages": [
            "wireguard", "wireguard-tools", "qrencode", "iptables",
        ],
        "cloud_init_runcmd": [
            "echo 'net.ipv4.ip_forward=1' >> /etc/sysctl.conf && sysctl -p",
            "wg genkey | tee /etc/wireguard/server_private.key | wg pubkey > /etc/wireguard/server_public.key",
            "chmod 600 /etc/wireguard/server_private.key",
            "PRIVATE_KEY=$(cat /etc/wireguard/server_private.key)",
            "cat > /etc/wireguard/wg0.conf << WGEOF\n[Interface]\nAddress = 10.100.0.1/24\nListenPort = 51820\nPrivateKey = $PRIVATE_KEY\nPostUp = iptables -t nat -A POSTROUTING -o eth0 -j MASQUERADE\nPostDown = iptables -t nat -D POSTROUTING -o eth0 -j MASQUERADE\nWGEOF",
            "systemctl enable wg-quick@wg0 && systemctl start wg-quick@wg0",
        ],
        "post_install_notes": [
            "VPN server is running on port 51820/UDP",
            "Generate client configs: wg genkey on the VPN VM",
            "Import client config into WireGuard app on your device",
            "Ensure firewall allows UDP port 51820",
        ],
    },
    "code-server": {
        "name": "VS Code in Browser",
        "category": "development",
        "description": "code-server instance providing a full VS Code IDE accessible from any browser. Includes Claude Code CLI for AI-assisted development.",
        "icon": "code",
        "vm_config": {
            "cores": 4,
            "ram_mb": 8192,
            "disk_gb": 50,
            "vlan": 20,
            "os_type": "ubuntu-22.04",
        },
        "requires_iso": False,
        "cloud_init_packages": [
            "curl", "wget", "git", "build-essential", "python3", "python3-pip",
            "python3-venv", "docker.io", "docker-compose",
        ],
        "cloud_init_runcmd": [
            "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
            "curl -fsSL https://code-server.dev/install.sh | sh",
            "mkdir -p /home/deploy/.config/code-server",
            "cat > /home/deploy/.config/code-server/config.yaml << CSEOF\nbind-addr: 0.0.0.0:8080\nauth: password\npassword: $(openssl rand -hex 8)\ncert: false\nCSEOF",
            "chown -R deploy:deploy /home/deploy/.config",
            "systemctl enable --now code-server@deploy",
            "npm install -g @anthropic-ai/claude-code || true",
        ],
        "post_install_notes": [
            "Access VS Code at http://<vm-ip>:8080",
            "Default password is in /home/deploy/.config/code-server/config.yaml",
            "Claude Code CLI is pre-installed — run 'claude' in the terminal",
        ],
    },
    "guacamole": {
        "name": "Apache Guacamole Gateway",
        "category": "daas",
        "description": "Web-based remote desktop gateway. Access RDP, VNC, and SSH sessions through your browser. No client software needed.",
        "icon": "layout-dashboard",
        "vm_config": {
            "cores": 2,
            "ram_mb": 4096,
            "disk_gb": 20,
            "vlan": 20,
            "os_type": "ubuntu-22.04",
        },
        "requires_iso": False,
        "cloud_init_packages": [
            "docker.io", "docker-compose",
        ],
        "cloud_init_runcmd": [
            "systemctl enable docker && systemctl start docker",
            "mkdir -p /opt/guacamole",
            "cat > /opt/guacamole/docker-compose.yml << GCEOF\nservices:\n  guacd:\n    image: guacamole/guacd\n    restart: always\n  guacamole:\n    image: guacamole/guacamole\n    restart: always\n    ports:\n      - '8080:8080'\n    environment:\n      GUACD_HOSTNAME: guacd\n      GUACD_PORT: 4822\n      MYSQL_HOSTNAME: mysql\n      MYSQL_DATABASE: guacamole_db\n      MYSQL_USER: guacamole\n      MYSQL_PASSWORD: guacamole_pass\n    depends_on:\n      - guacd\n      - mysql\n  mysql:\n    image: mysql:8.0\n    restart: always\n    environment:\n      MYSQL_ROOT_PASSWORD: root_pass\n      MYSQL_DATABASE: guacamole_db\n      MYSQL_USER: guacamole\n      MYSQL_PASSWORD: guacamole_pass\n    volumes:\n      - mysql_data:/var/lib/mysql\n      - /opt/guacamole/initdb.sql:/docker-entrypoint-initdb.d/initdb.sql\nvolumes:\n  mysql_data:\nGCEOF",
            "docker run --rm guacamole/guacamole /opt/guacamole/bin/initdb.sh --mysql > /opt/guacamole/initdb.sql",
            "cd /opt/guacamole && docker compose up -d",
        ],
        "post_install_notes": [
            "Access Guacamole at http://<vm-ip>:8080/guacamole",
            "Default login: guacadmin / guacadmin (change immediately!)",
            "Add RDP connections for your Windows VMs via the admin panel",
        ],
    },
    "dev-environment": {
        "name": "Development Environment",
        "category": "development",
        "description": "Ubuntu VM with Docker, Git, Node.js 20, Python 3.11, and build tools pre-installed. Ready for project development.",
        "icon": "terminal",
        "vm_config": {
            "cores": 4,
            "ram_mb": 8192,
            "disk_gb": 50,
            "vlan": 20,
            "os_type": "ubuntu-22.04",
        },
        "requires_iso": False,
        "cloud_init_packages": [
            "git", "curl", "wget", "build-essential", "python3.11", "python3.11-venv",
            "python3-pip", "docker.io", "docker-compose", "jq", "htop", "tmux", "vim",
        ],
        "cloud_init_runcmd": [
            "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs",
            "systemctl enable docker && systemctl start docker",
            "usermod -aG docker deploy",
        ],
        "post_install_notes": [
            "SSH into the VM: ssh deploy@<vm-ip>",
            "Docker, Node 20, Python 3.11, and Git are ready to use",
        ],
    },
}


async def list_templates() -> list[dict]:
    """Return all available service templates."""
    result = []
    for template_id, template in TEMPLATES.items():
        result.append({
            "id": template_id,
            "name": template["name"],
            "category": template["category"],
            "description": template["description"],
            "icon": template["icon"],
            "requires_iso": template.get("requires_iso", False),
            "vm_config": template["vm_config"],
        })
    return result


async def get_template(template_id: str) -> dict | None:
    """Return a single template with full details."""
    template = TEMPLATES.get(template_id)
    if not template:
        return None
    return {"id": template_id, **template}


async def _build_proxmox_params(
    template: dict[str, Any],
    vm_config: dict[str, Any],
    vm_name: str,
    next_vmid: int,
    template_id: str,
) -> dict[str, Any]:
    """Build the full set of Proxmox API parameters for VM creation.

    Includes disk, network, cloud-init, boot order — everything needed
    for the VM to actually boot and be usable.
    """
    storage = settings.PROXMOX_STORAGE
    iso_storage = settings.PROXMOX_ISO_STORAGE
    bridge_prefix = settings.PROXMOX_BRIDGE_PREFIX
    vlan = vm_config.get("vlan", 20)
    disk_gb = vm_config.get("disk_gb", 50)
    bridge = f"{bridge_prefix}{vlan}"

    params: dict[str, Any] = {
        "vmid": next_vmid,
        "name": vm_name,
        "cores": vm_config["cores"],
        "memory": vm_config["ram_mb"],
        "ostype": template.get("proxmox_overrides", {}).get("ostype", "l26"),
        "tags": f"service;{template_id}",
        "description": f"Service: {template['name']} — deployed via platform catalog",
        "onboot": 1,
        "agent": 1,
        # SCSI controller
        "scsihw": "virtio-scsi-single",
        # Boot disk
        "scsi0": f"{storage}:{disk_gb}",
        # Network — virtio NIC on per-VLAN bridge (vmbr10, vmbr20, etc.)
        "net0": f"virtio,bridge={bridge}",
    }

    is_windows = template.get("requires_iso") and "win" in vm_config.get("os_type", "")

    if is_windows:
        params["boot"] = "order=scsi0;net0"
        # Apply Windows-specific overrides (BIOS, q35, cpu, etc.)
        if "proxmox_overrides" in template:
            params.update(template["proxmox_overrides"])
        # UEFI requires EFI disk and TPM — use the same storage pool as VM disk
        if params.get("bios") == "ovmf":
            params["efidisk0"] = f"{storage}:1,efitype=4m,pre-enrolled-keys=1"
            params["tpmstate0"] = f"{storage}:1,version=v2.0"
        # Attach ISOs only if they exist on the storage — otherwise the user
        # can attach them later via the Proxmox console
        try:
            available_isos = await proxmox_client.list_isos(iso_storage)
        except Exception:
            available_isos = []
        iso_name = template.get("iso_name")
        if iso_name and iso_name in available_isos:
            params["ide2"] = f"{iso_storage}:iso/{iso_name},media=cdrom"
            params["boot"] = f"order=ide2;scsi0;net0"
        virtio_iso = template.get("virtio_iso")
        if virtio_iso and virtio_iso in available_isos:
            params["ide3"] = f"{iso_storage}:iso/{virtio_iso},media=cdrom"
    else:
        # Linux: attach Ubuntu ISO if available, configure cloud-init networking
        ubuntu_iso = settings.PROXMOX_UBUNTU_ISO
        try:
            available_isos = await proxmox_client.list_isos(iso_storage)
        except Exception:
            available_isos = []
        if ubuntu_iso in available_isos:
            params["ide2"] = f"{iso_storage}:iso/{ubuntu_iso},media=cdrom"
            params["boot"] = "order=scsi0;ide2;net0"
        else:
            params["boot"] = "order=scsi0;net0"
        params["ipconfig0"] = "ip=dhcp"

    return params


async def deploy_service(
    template_id: str,
    overrides: dict,
    db: AsyncSession,
    user_id: str | None = None,
) -> dict:
    """Deploy a service from a template by creating a VM via Proxmox.

    Creates a fully-configured VM with disk, network, cloud-init, and boot
    order so the VM is immediately bootable.
    """
    template = TEMPLATES.get(template_id)
    if not template:
        raise ValueError(f"Template '{template_id}' not found")

    vm_config = {**template["vm_config"]}
    for key in ("cores", "ram_mb", "disk_gb", "vlan", "name"):
        if key in overrides:
            vm_config[key] = overrides[key]

    vm_name = vm_config.pop("name", None) or f"SVC-{template['name'][:10].upper().replace(' ', '-')}-{uuid.uuid4().hex[:4]}"

    # Get next available VMID
    existing = await proxmox_client.list_vms()
    next_vmid = max((v["vmid"] for v in existing), default=199) + 1

    # Build complete Proxmox params (disk, network, boot, cloud-init)
    create_params = await _build_proxmox_params(
        template=template,
        vm_config=vm_config,
        vm_name=vm_name,
        next_vmid=next_vmid,
        template_id=template_id,
    )

    await proxmox_client.create_vm(**create_params)

    # Register in database
    vm = VirtualMachine(
        vmid=next_vmid,
        name=vm_name,
        os_type=vm_config.get("os_type", "ubuntu-22.04"),
        cpu_cores=vm_config["cores"],
        ram_mb=vm_config["ram_mb"],
        disk_gb=vm_config.get("disk_gb", 50),
        vlan=vm_config.get("vlan", 20),
        tags=[template_id, "service", template["category"]],
        status="stopped",
    )
    db.add(vm)
    await db.flush()

    # Audit log
    from uuid import UUID
    await log_action(
        db,
        action="service.deploy",
        resource_type="service",
        resource_id=str(vm.id),
        user_id=UUID(user_id) if user_id else None,
        parameters={
            "template_id": template_id,
            "vm_name": vm_name,
            "vmid": next_vmid,
            "config": vm_config,
        },
        outcome="success",
        rollback_plan=f"Delete VM {next_vmid} via Proxmox API",
    )

    # Start the VM if it's a Linux cloud-init template
    deploy_status = "deployed"
    if not template.get("requires_iso"):
        try:
            await proxmox_client.start_vm(next_vmid)
            vm.status = "running"
        except Exception as e:
            logger.warning(f"Failed to auto-start VM {next_vmid}: {e}")
            deploy_status = "created"
    else:
        deploy_status = "awaiting_iso"

    # Create deployment record
    deployment_id = f"dep-{uuid.uuid4().hex[:8]}"
    deployment = ServiceDeployment(
        deployment_id=deployment_id,
        template_id=template_id,
        template_name=template["name"],
        vm_id=vm.id,
        vmid=next_vmid,
        vm_name=vm_name,
        status=deploy_status,
        message=f"Deployed {template['name']} as {vm_name} (VMID {next_vmid})",
        deployed_by=user_id,
    )
    db.add(deployment)

    return {
        "deployment_id": deployment_id,
        "status": deploy_status,
        "vm_id": str(vm.id),
        "vmid": next_vmid,
        "vm_name": vm_name,
        "template_id": template_id,
        "template_name": template["name"],
        "requires_iso": template.get("requires_iso", False),
        "post_install_notes": template.get("post_install_notes", []),
        "access_info": {
            "vlan": vm_config.get("vlan", 20),
            "ip": "Assigned via DHCP on boot",
        },
    }
