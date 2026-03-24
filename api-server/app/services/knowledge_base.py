"""Comprehensive domain knowledge base for the Roosk NexGen Platform AI assistant.

Covers all platforms, tools, and services running on the Dell PowerEdge R7625:
Proxmox VE, Docker, WireGuard, PostgreSQL, Nginx, systemd, networking, Guacamole,
Windows DaaS, code-server, and the Roosk platform API itself.

Each section is independently selectable so the AI only gets relevant context
per query (~2000 tokens max injected), keeping costs and latency down.
"""

import re
from typing import Callable

# Each section: (section_name, keywords, content)
KNOWLEDGE_SECTIONS: list[tuple[str, list[str], str]] = [
    (
        "proxmox",
        ["proxmox", "pve", "qm", "pct", "pvesh", "hypervisor", "vm", "virtual machine",
         "cluster", "node", "vzdump", "backup", "template", "clone", "snapshot", "ha",
         "lxc", "container", "qemu", "kvm", "r7625"],
        """## Proxmox VE 9.1 — Hypervisor
Server: Dell PowerEdge R7625 (node name: r7625)
CPUs: 2x AMD EPYC 9354 (64 cores / 128 threads total)
RAM: 128GB DDR5 ECC
Storage: ZFS RAIDZ1 pool "nexgen-pool" on 3x 3.84TB NVMe

CLI commands:
- qm list — list all VMs
- qm start/stop/reset/shutdown <vmid> — VM power control
- qm clone <source> <newid> --name <name> --full — full clone
- qm snapshot <vmid> <snapname> — create snapshot
- qm delsnapshot <vmid> <snapname> — delete snapshot
- qm set <vmid> --cores <n> --memory <mb> — resize VM
- qm unlock <vmid> — unlock a stuck VM
- qm create <vmid> --name <name> --cores <n> --memory <mb> — create VM
- qm destroy <vmid> — delete VM permanently
- pct list — list LXC containers
- pct start/stop <vmid> — container power control
- pvesh get /nodes/r7625/qemu — list VMs via API
- pvesm status — storage pool status
- zpool status nexgen-pool — ZFS pool health
- vzdump <vmid> --mode snapshot --compress zstd --storage local — backup VM

Troubleshooting:
- Locked VM: qm unlock <vmid>
- Storage full: zpool list, check with pvesm status
- Network bridge issues: check /etc/network/interfaces for vmbr0 config
- HA not working: pvecm status, check quorum
- Cloud-init not running: check /var/log/cloud-init.log inside VM
""",
    ),
    (
        "docker",
        ["docker", "compose", "container", "image", "dockerfile", "registry",
         "volume", "network", "port", "swarm", "stack"],
        """## Docker & Docker Compose
Platform deployment runs as Docker Compose on VM-APP-01 (10.20.0.10).

Commands:
- docker ps — list running containers
- docker ps -a — list all containers (including stopped)
- docker logs <container> — view container logs
- docker logs -f <container> — follow logs live
- docker exec -it <container> bash — shell into container
- docker stats — live resource usage
- docker compose up -d — start all services
- docker compose down — stop all services
- docker compose logs -f — follow all service logs
- docker compose restart <service> — restart one service
- docker compose pull — pull latest images
- docker system prune -af — clean up unused images/containers
- docker network ls — list networks
- docker volume ls — list volumes

Roosk stack services (docker-compose.yml):
- roosk-backend: FastAPI app on port 8000
- roosk-frontend: React app served by Nginx on port 80/443
- roosk-db: PostgreSQL 16 (or external VM-DB-01)

Troubleshooting:
- Container won't start: docker logs <container>, check ports
- Out of disk: docker system prune -af
- Network issues: docker network inspect bridge
- Compose version: docker compose version (v2 plugin required)
""",
    ),
    (
        "wireguard",
        ["wireguard", "vpn", "wg", "tunnel", "peer", "client", "remote access",
         "51820", "wg0", "wireguard-vpn", "wg-quick"],
        """## WireGuard VPN
Deployed via service template "wireguard-vpn" on VLAN 10.

Server config: /etc/wireguard/wg0.conf
Server IP: 10.100.0.1/24
Listen port: 51820/UDP
Interface: wg0

Commands:
- wg show — show active tunnels and peers
- wg-quick up wg0 — bring up VPN interface
- wg-quick down wg0 — take down VPN interface
- systemctl status wg-quick@wg0 — check service status
- systemctl enable wg-quick@wg0 — enable at boot

Generate client config:
- wg genkey | tee client_private.key | wg pubkey > client_public.key
- Use /opt/wg-genclients.sh script on the VPN VM for automated generation
- Client config includes: server public key, endpoint, allowed IPs, DNS

Troubleshooting:
- Handshake not completing: check UDP 51820 is open in firewall (ufw allow 51820/udp)
- MTU issues: set MTU = 1420 in client config
- No internet through VPN: check PostUp/PostDown iptables NAT rules
- DNS not resolving: add DNS = 1.1.1.1 to client config
""",
    ),
    (
        "postgresql",
        ["postgresql", "postgres", "psql", "database", "db", "sql", "pg_dump",
         "pgvector", "backup", "replication", "wal", "pg_hba", "connection",
         "nexgen_platform", "pgpool"],
        """## PostgreSQL 16 with pgvector
Runs on VM-DB-01 (10.20.0.20), port 5432.
Database: nexgen_platform
User: nexgen
Extensions: pgvector (for AI embeddings)

Commands:
- psql -h 10.20.0.20 -U nexgen -d nexgen_platform — connect to DB
- \\l — list databases
- \\dt — list tables
- \\d+ <table> — describe table with sizes
- SELECT * FROM pg_stat_activity; — active connections
- SELECT * FROM pg_stat_user_tables; — table statistics

Backup:
- pg_dump -Fc nexgen_platform > /var/backups/nexgen/<timestamp>.dump — custom format backup
- pg_restore -d nexgen_platform /var/backups/nexgen/<file>.dump — restore
- Backup directory: /var/backups/nexgen/ on VM-DB-01

pgvector:
- CREATE EXTENSION IF NOT EXISTS vector;
- Column type: vector(1536) for OpenAI/Claude embeddings
- Similarity: SELECT * FROM items ORDER BY embedding <=> '[...]' LIMIT 5;

Replication:
- wal_level = replica in postgresql.conf
- max_wal_senders = 5
- pg_hba.conf allows replication from 10.20.0.0/24
- Replica VM: VM-DB-02 (10.20.0.21)

Tuning (for 128GB server):
- shared_buffers = 32GB
- work_mem = 256MB
- effective_cache_size = 96GB
- maintenance_work_mem = 2GB

Config files: /etc/postgresql/16/main/
- postgresql.conf — main config
- pg_hba.conf — authentication rules
""",
    ),
    (
        "nginx",
        ["nginx", "reverse proxy", "proxy", "ssl", "tls", "certificate",
         "certbot", "lets encrypt", "https", "502", "upstream", "load balancer"],
        """## Nginx Reverse Proxy
Runs on VM-APP-01 (10.20.0.10), proxies to backend on localhost:8000.

Config: /etc/nginx/sites-available/roosk
Enabled: /etc/nginx/sites-enabled/roosk

Typical config:
```
server {
    listen 80;
    server_name roosk-app.nexgen.local;

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location / {
        root /opt/roosk/frontend/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

SSL/TLS with Let's Encrypt:
- certbot --nginx -d roosk-app.nexgen.local
- Auto-renewal: systemctl enable certbot.timer
- Manual renewal: certbot renew --dry-run

Commands:
- nginx -t — test config syntax
- systemctl reload nginx — apply config changes
- systemctl status nginx — check status

Troubleshooting:
- 502 Bad Gateway: backend is down, check docker ps or systemctl status
- Upstream timeout: increase proxy_read_timeout
- WebSocket upgrade: add proxy_set_header Upgrade/Connection headers
""",
    ),
    (
        "systemd",
        ["systemd", "systemctl", "service", "journalctl", "unit", "daemon",
         "enable", "disable", "restart", "status", "logs", "journal"],
        """## systemd Service Management
Key services on the platform:

VM-APP-01 (Application):
- docker.service — Docker daemon
- nginx.service — Reverse proxy
- code-server@deploy.service — VS Code in browser (if deployed)

VM-DB-01 (Database):
- postgresql.service — PostgreSQL 16

VPN VM:
- wg-quick@wg0.service — WireGuard VPN

Guacamole VM:
- docker.service — Guacamole runs as Docker Compose

Commands:
- systemctl status <service> — check if running
- systemctl start/stop/restart <service> — control service
- systemctl enable/disable <service> — boot persistence
- systemctl daemon-reload — reload unit files after changes
- journalctl -u <service> -f — follow service logs live
- journalctl -u <service> --since "1 hour ago" — recent logs
- journalctl -u <service> --no-pager | tail -100 — last 100 lines
- systemctl list-units --type=service --state=running — all running services
- systemctl list-timers — scheduled tasks

Unit file locations:
- /etc/systemd/system/ — custom units
- /lib/systemd/system/ — package-provided units
""",
    ),
    (
        "networking",
        ["network", "vlan", "subnet", "ip", "firewall", "ufw", "bridge",
         "dns", "dhcp", "interface", "vmbr", "10.20", "10.10", "route",
         "iptables", "nat", "port"],
        """## Networking & VLANs
Platform uses VLAN segmentation on a single physical NIC.

VLAN Map:
- VLAN 10: Management (10.10.0.0/24) — Proxmox web UI, SSH
- VLAN 20: Control Plane (10.20.0.0/24) — Platform VMs
- VLAN 30: Tenant (10.30.0.0/24) — User workloads
- VLAN 40: DMZ (10.40.0.0/24) — Public-facing services
- VLAN 50: Storage (10.50.0.0/24) — ZFS replication, backups

Key IP Assignments:
- Proxmox host: 192.168.4.58 (management)
- VM-APP-01: 10.20.0.10 (Roosk platform)
- VM-DB-01: 10.20.0.20 (PostgreSQL primary)
- VM-DB-02: 10.20.0.21 (PostgreSQL replica)
- VPN server: 10.10.0.x / VPN clients: 10.100.0.0/24

Proxmox bridge: vmbr0 (Linux bridge, all VLANs tagged)

Firewall (UFW on each VM):
- ufw status — show rules
- ufw allow 22/tcp — SSH
- ufw allow 80,443/tcp — HTTP/HTTPS
- ufw allow 5432/tcp — PostgreSQL
- ufw allow 51820/udp — WireGuard
- ufw allow 8080/tcp — code-server / Guacamole
- ufw --force enable — enable firewall

DNS: /etc/hosts on each VM for local resolution
Gateway: 10.20.0.1 (Proxmox host routes between VLANs)
""",
    ),
    (
        "roosk_api",
        ["roosk", "api", "endpoint", "route", "auth", "jwt", "token", "login",
         "mfa", "totp", "curl", "rest", "fastapi", "backend", "frontend",
         "murph", "platform", "dashboard"],
        """## Roosk Platform API Reference
Base URL: http://10.20.0.10:8000/api (or via Nginx on port 80)
Auth: JWT Bearer token (HS256), MFA via TOTP (pyotp)

Login flow:
1. POST /api/auth/login {email, password} → {access_token} or {mfa_required, mfa_token}
2. If MFA: POST /api/auth/mfa/login {mfa_token, totp_code} → {access_token}

Key endpoints:
- GET /health — platform health check (no auth)
- GET /api/vms/ — list all VMs
- POST /api/vms/{vmid}/action — VM power actions {action, parameters}
- GET /api/services/templates — list service templates
- POST /api/services/deploy — deploy from template {template_id, name?, cores?, ram_mb?}
- GET /api/services/deployments — list deployments
- POST /api/llm/complete — AI query with action execution {prompt, context?}
- GET /api/llm/stats — LLM usage statistics
- GET /api/agents/ — list AI agents
- GET /api/security/alerts — security alerts
- GET /api/databases/ — database instances
- GET /api/network/topology — network topology
- GET /api/metrics/system — system metrics
- GET /api/compliance/summary — compliance report
- GET /api/users/ — list users (admin only)
- POST /api/users/ — create user (admin only)
- POST /api/auth/mfa/setup — setup MFA
- POST /api/auth/mfa/verify — verify TOTP code

Error format: {"detail": "error message"}
All list endpoints return JSON arrays.
All POST endpoints accept JSON body.
""",
    ),
    (
        "guacamole",
        ["guacamole", "rdp", "vnc", "remote desktop", "daas", "desktop as a service",
         "browser", "gateway", "guacd", "tomcat"],
        """## Apache Guacamole — Remote Desktop Gateway
Deployed via service template "guacamole" as Docker Compose on VLAN 20.

Architecture:
- guacd: Connection broker daemon (protocol handler)
- guacamole: Web application (Tomcat-based)
- MySQL 8.0: Backend database for users/connections

Access: http://<guac-vm-ip>:8080/guacamole
Default login: guacadmin / guacadmin (CHANGE IMMEDIATELY after first login)

Adding an RDP connection:
1. Login as admin → Settings → Connections → New Connection
2. Protocol: RDP
3. Hostname: <Windows VM IP> (e.g., 10.20.0.x)
4. Port: 3389
5. Username/Password: Windows credentials
6. Security mode: NLA or TLS

Adding a VNC connection:
- Protocol: VNC, Port: 5900, Password: VNC password

Adding an SSH connection:
- Protocol: SSH, Hostname, Port: 22, Username, Password or key

Docker Compose location: /opt/guacamole/docker-compose.yml
Logs: docker compose -f /opt/guacamole/docker-compose.yml logs -f
Restart: docker compose -f /opt/guacamole/docker-compose.yml restart
""",
    ),
    (
        "windows_daas",
        ["windows", "rdp", "daas", "desktop", "win11", "remote desktop",
         "iso", "virtio", "tpm", "uefi", "ovmf"],
        """## Windows 11 DaaS (Desktop as a Service)
Deployed via service template "windows-desktop".

Setup process:
1. Deploy template → creates VM with UEFI/TPM2.0/Q35 machine type
2. Upload Windows 11 ISO to Proxmox: Datacenter → local → ISO Images → Upload
3. Also upload VirtIO driver ISO (virtio-win.iso from Fedora)
4. In Proxmox console: attach both ISOs as CD drives
5. Boot VM → Windows installer → Select custom install
6. Load VirtIO drivers: Browse CD → vioscsi → w11 → amd64
7. Complete Windows installation
8. Install remaining VirtIO drivers from Device Manager
9. Enable Remote Desktop: Settings → System → Remote Desktop → On
10. Configure Windows Firewall to allow RDP (port 3389)

Access methods:
- Direct RDP: mstsc /v:<vm-ip>:3389 (from Windows)
- Guacamole: Add RDP connection in Guacamole admin panel
- Proxmox console: noVNC via web UI

Performance tuning:
- CPU: host passthrough for best performance
- RAM: 8GB minimum, 16GB recommended
- Disk: virtio-scsi for best I/O
- GPU passthrough: possible if GPU available (not on R7625 by default)
""",
    ),
    (
        "code_server",
        ["code-server", "vscode", "vs code", "ide", "development", "coding",
         "claude code", "extension"],
        """## code-server (VS Code in Browser)
Deployed via service template "code-server" on VLAN 20.

Access: http://<vm-ip>:8080
Auth: Password from /home/deploy/.config/code-server/config.yaml

Pre-installed tools:
- Node.js 20 (via nodesource)
- Python 3 + pip
- Docker + Docker Compose
- Git
- Claude Code CLI (@anthropic-ai/claude-code)

Config file: /home/deploy/.config/code-server/config.yaml
Service: code-server@deploy.service
Logs: journalctl -u code-server@deploy -f

Change password:
1. Edit /home/deploy/.config/code-server/config.yaml
2. systemctl restart code-server@deploy

Install extensions:
- code-server --install-extension <publisher.extension>
- Or via the Extensions panel in the UI

Claude Code CLI:
- Run 'claude' in the integrated terminal
- Requires ANTHROPIC_API_KEY environment variable
""",
    ),
]


def get_full_knowledge() -> str:
    """Return all knowledge sections concatenated (~3500 tokens)."""
    return "\n\n".join(content for _, _, content in KNOWLEDGE_SECTIONS)


def get_relevant_knowledge(query: str, max_sections: int = 4) -> str:
    """Return knowledge sections most relevant to the query.

    Uses keyword overlap scoring — returns top N matching sections.
    Keeps token budget under ~2000 tokens per request.
    """
    query_lower = query.lower()
    query_tokens = set(re.findall(r'\w+', query_lower))

    scored: list[tuple[float, str, str]] = []
    for name, keywords, content in KNOWLEDGE_SECTIONS:
        # Score based on keyword matches
        score = 0.0
        for kw in keywords:
            kw_lower = kw.lower()
            if kw_lower in query_lower:
                score += 2.0  # Exact substring match in query
            elif any(t in kw_lower for t in query_tokens):
                score += 0.5  # Partial token overlap

        if score > 0:
            scored.append((score, name, content))

    # Sort by score descending, take top N
    scored.sort(key=lambda x: x[0], reverse=True)
    top_sections = scored[:max_sections]

    if not top_sections:
        # If no keyword match, return a general overview
        return """Domain Knowledge:
This platform runs on a Dell PowerEdge R7625 with Proxmox VE 9.1.
It manages VMs, containers, databases, VPNs, and remote desktops.
Ask about specific topics like Proxmox, Docker, WireGuard, PostgreSQL, networking, or any service."""

    result = "Domain Knowledge:\n"
    for _, name, content in top_sections:
        result += f"\n{content}\n"

    return result


def get_section(section_name: str) -> str | None:
    """Return a specific knowledge section by name."""
    for name, _, content in KNOWLEDGE_SECTIONS:
        if name == section_name:
            return content
    return None


def get_section_names() -> list[str]:
    """Return all available section names."""
    return [name for name, _, _ in KNOWLEDGE_SECTIONS]
