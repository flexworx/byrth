"""Agent type registry — 7 specialized agent types with capabilities and knowledge domains.

Each agent type has a focused set of actions it can execute and knowledge
sections it receives, making it an expert in its domain.
"""

from typing import Any


AGENT_TYPES: dict[str, dict[str, Any]] = {
    "generic": {
        "name": "Murph (General)",
        "description": "General-purpose AI assistant with full platform awareness. Can answer questions about any topic and execute all available actions.",
        "icon": "bot",
        "capabilities": [
            "vm.list", "vm.status", "vm.start", "vm.stop", "vm.restart", "vm.snapshot",
            "vm.create", "vm.delete", "vm.clone", "vm.resize", "vm.console",
            "container.list", "container.start", "container.stop",
            "service.list", "service.deploy", "service.deployments",
            "db.list", "db.status", "db.backup",
            "network.topology", "network.storage",
            "user.list", "log.audit", "log.security",
            "platform.health", "platform.metrics", "platform.nodes",
        ],
        "knowledge_sections": [
            "proxmox", "docker", "wireguard", "postgresql", "nginx",
            "systemd", "networking", "roosk_api", "guacamole", "windows_daas", "code_server",
        ],
        "system_prompt_addon": "You are Murph, the general-purpose AI assistant. You have expertise across all platform domains. Help the user with any question or action.",
    },
    "infrastructure": {
        "name": "Infra Agent",
        "description": "Infrastructure specialist — Proxmox VMs, LXC containers, storage, ZFS, and compute resources.",
        "icon": "server",
        "capabilities": [
            "vm.list", "vm.status", "vm.start", "vm.stop", "vm.restart", "vm.snapshot",
            "vm.create", "vm.delete", "vm.clone", "vm.resize", "vm.console",
            "container.list", "container.start", "container.stop",
            "service.list", "service.deploy", "service.deployments",
            "network.storage",
            "platform.health", "platform.metrics", "platform.nodes",
        ],
        "knowledge_sections": ["proxmox", "docker", "systemd"],
        "system_prompt_addon": "You are the Infrastructure Agent, an expert in Proxmox VE, VM management, LXC containers, ZFS storage, and compute resource allocation. Focus your answers on infrastructure topics. For non-infrastructure questions, suggest the appropriate specialist agent.",
    },
    "security": {
        "name": "Security Agent",
        "description": "Security specialist — alerts, compliance, firewall rules, TLS certificates, MFA, and access control.",
        "icon": "shield",
        "capabilities": [
            "log.security", "log.audit", "user.list",
            "platform.health", "vm.list", "vm.status",
            "network.topology",
        ],
        "knowledge_sections": ["networking", "roosk_api", "nginx"],
        "system_prompt_addon": "You are the Security Agent, an expert in platform security. You monitor alerts, analyze compliance, manage firewall rules, review audit logs, and enforce access control policies. Always prioritize security best practices in your recommendations.",
    },
    "database": {
        "name": "Database Agent",
        "description": "Database specialist — PostgreSQL administration, backups, replication, pgvector, query optimization.",
        "icon": "database",
        "capabilities": [
            "db.list", "db.status", "db.backup",
            "platform.health", "log.audit",
        ],
        "knowledge_sections": ["postgresql", "systemd"],
        "system_prompt_addon": "You are the Database Agent, an expert in PostgreSQL 16 administration. You handle backups, replication monitoring, pgvector operations, query optimization, and connection management. Provide specific SQL commands and config recommendations.",
    },
    "networking": {
        "name": "Network Agent",
        "description": "Networking specialist — VLANs, WireGuard VPN, DNS, firewall rules, IP addressing, and routing.",
        "icon": "network",
        "capabilities": [
            "network.topology", "network.storage",
            "vm.list", "vm.status",
            "platform.health", "platform.nodes",
        ],
        "knowledge_sections": ["networking", "wireguard", "nginx"],
        "system_prompt_addon": "You are the Network Agent, an expert in platform networking. You manage VLANs, WireGuard VPN, DNS resolution, firewall rules, and IP addressing. Provide specific network configuration commands and troubleshooting steps.",
    },
    "daas": {
        "name": "DaaS Agent",
        "description": "Desktop-as-a-Service specialist — Guacamole gateway, Windows desktops, RDP, VNC, code-server.",
        "icon": "monitor",
        "capabilities": [
            "service.list", "service.deploy", "service.deployments",
            "vm.list", "vm.status", "vm.start", "vm.stop",
            "vm.create", "vm.console",
        ],
        "knowledge_sections": ["guacamole", "windows_daas", "code_server", "proxmox"],
        "system_prompt_addon": "You are the DaaS Agent, an expert in Desktop-as-a-Service operations. You manage Guacamole remote desktop gateway, Windows 11 VM deployments, RDP/VNC connections, and code-server instances. Help users set up and troubleshoot remote desktop access.",
    },
    "monitoring": {
        "name": "Monitoring Agent",
        "description": "Monitoring specialist — Prometheus metrics, Grafana dashboards, system health, alerting, and performance analysis.",
        "icon": "activity",
        "capabilities": [
            "platform.health", "platform.metrics", "platform.nodes",
            "vm.list", "vm.status",
            "db.status",
            "log.security", "log.audit",
            "network.topology",
        ],
        "knowledge_sections": ["proxmox", "systemd", "docker", "postgresql"],
        "system_prompt_addon": "You are the Monitoring Agent, an expert in system observability. You analyze CPU, memory, storage, and network metrics, monitor service health, detect anomalies, and recommend performance optimizations. Use Prometheus queries and system commands to diagnose issues.",
    },
}


def get_agent_type(type_id: str) -> dict | None:
    """Get an agent type definition by ID."""
    return AGENT_TYPES.get(type_id)


def list_agent_types() -> list[dict]:
    """List all available agent types."""
    return [
        {"id": type_id, **{k: v for k, v in config.items() if k != "system_prompt_addon"}}
        for type_id, config in AGENT_TYPES.items()
    ]


def get_agent_capabilities(type_id: str) -> list[str]:
    """Get the action capabilities for an agent type."""
    agent_type = AGENT_TYPES.get(type_id)
    if not agent_type:
        return []
    return agent_type["capabilities"]


def get_agent_knowledge_sections(type_id: str) -> list[str]:
    """Get the knowledge section names for an agent type."""
    agent_type = AGENT_TYPES.get(type_id)
    if not agent_type:
        return []
    return agent_type["knowledge_sections"]


def get_agent_system_prompt(type_id: str) -> str:
    """Get the specialized system prompt addon for an agent type."""
    agent_type = AGENT_TYPES.get(type_id)
    if not agent_type:
        return ""
    return agent_type.get("system_prompt_addon", "")


def get_default_agents() -> list[dict]:
    """Get the 7 default agent seed data for database initialization."""
    agents = []
    for type_id, config in AGENT_TYPES.items():
        agents.append({
            "agent_id": f"murph-{type_id}",
            "name": config["name"],
            "agent_type": type_id,
            "capabilities": config["capabilities"],
            "description": config["description"],
            "version": "1.0.0",
            "status": "active",
        })
    return agents
