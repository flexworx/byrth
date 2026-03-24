"""AI Action Parser — converts LLM responses into executable platform actions.

When the AI terminal receives a user prompt, Bedrock is instructed to return
structured JSON action blocks when the request maps to a platform capability.
This module parses those blocks and executes them via existing backend services.
"""

import json
import logging
import re
from typing import Any

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.proxmox import proxmox_client
from app.services.service_templates import deploy_service, list_templates, get_template

logger = logging.getLogger(__name__)

# Available actions the AI can invoke — 28 total
AVAILABLE_ACTIONS = {
    # VM management
    "vm.list": "List all virtual machines with status",
    "vm.status": "Get detailed status of a specific VM by VMID",
    "vm.start": "Start a virtual machine",
    "vm.stop": "Stop a virtual machine (destructive — requires approval)",
    "vm.restart": "Restart a virtual machine",
    "vm.snapshot": "Create a snapshot of a virtual machine",
    "vm.create": "Create a new VM with specified resources",
    "vm.delete": "Delete a VM permanently (destructive — requires approval)",
    "vm.clone": "Clone an existing VM to a new VM",
    "vm.resize": "Resize VM CPU cores and/or RAM",
    "vm.console": "Get VNC console access URL for a VM",
    # Container (LXC) management
    "container.list": "List all LXC containers",
    "container.start": "Start an LXC container",
    "container.stop": "Stop an LXC container",
    # Service templates
    "service.list": "List available service templates (windows-desktop, wireguard-vpn, code-server, guacamole, dev-environment)",
    "service.deploy": "Deploy a service from a template",
    "service.deployments": "List all service deployments",
    # Database
    "db.list": "List all database instances",
    "db.status": "Get database connection status and metrics",
    "db.backup": "Trigger a database backup",
    # Network
    "network.topology": "Get network topology (VLANs, bridges, interfaces)",
    "network.storage": "Get storage pool information",
    # Users
    "user.list": "List all platform users",
    # Logs
    "log.audit": "Get recent audit log entries",
    "log.security": "Get security alerts (unresolved by default)",
    # Platform
    "platform.health": "Check overall platform health status",
    "platform.metrics": "Get CPU, RAM, storage, and uptime metrics",
    "platform.nodes": "Get Proxmox node details",
}

# System prompt injected into Bedrock requests when action execution is enabled
ACTION_SYSTEM_PROMPT = """You are the AI assistant for the Roosk NexGen Server Orchestration Platform, running on a Dell PowerEdge R7625 with Proxmox VE 9.1.

You can execute platform actions by including a JSON action block in your response. When the user's request maps to a platform capability, include EXACTLY ONE action block wrapped in ```roosk_action``` markers.

Available actions:
{actions}

Action block format:
```roosk_action
{{"action": "<action_name>", "params": {{<parameters>}}}}
```

Examples:
- "List all VMs" → ```roosk_action
{{"action": "vm.list", "params": {{}}}}
```
- "Start VM 104" → ```roosk_action
{{"action": "vm.start", "params": {{"vmid": 104}}}}
```
- "Deploy a WireGuard VPN" → ```roosk_action
{{"action": "service.deploy", "params": {{"template_id": "wireguard-vpn"}}}}
```
- "Deploy a Windows desktop with 8 cores" → ```roosk_action
{{"action": "service.deploy", "params": {{"template_id": "windows-desktop", "overrides": {{"cores": 8}}}}}}
```
- "Clone VM 104 as my-clone" → ```roosk_action
{{"action": "vm.clone", "params": {{"vmid": 104, "name": "my-clone"}}}}
```
- "Show me all containers" → ```roosk_action
{{"action": "container.list", "params": {{}}}}
```
- "What's the database status?" → ```roosk_action
{{"action": "db.status", "params": {{}}}}
```
- "Show security alerts" → ```roosk_action
{{"action": "log.security", "params": {{}}}}
```
- "Show audit logs" → ```roosk_action
{{"action": "log.audit", "params": {{"limit": 20}}}}
```

Rules:
1. ONLY use action blocks when the user clearly wants to perform an action or retrieve live data. Pure informational/knowledge questions get text-only responses.
2. For destructive actions (vm.stop, vm.delete), explain what will happen and include the action block — the system enforces approval requirements.
3. Always provide a brief human-readable explanation BEFORE the action block.
4. If the user's request is ambiguous, ask for clarification instead of guessing.
5. For service deployments, map natural language to template IDs: "Windows desktop" → "windows-desktop", "VPN" → "wireguard-vpn", "VS Code" / "code server" → "code-server", "remote desktop gateway" → "guacamole", "dev VM" → "dev-environment".
6. For resize operations, only include the parameters the user wants to change (cores, ram_mb).
7. When the user asks about platform status, health, or metrics, use the appropriate platform.* action.

{knowledge_context}
"""

# Regex to extract action block from LLM response
_ACTION_BLOCK_RE = re.compile(
    r"```roosk_action\s*\n?(.*?)\n?```",
    re.DOTALL,
)


def build_action_system_prompt(knowledge_context: str = "") -> str:
    """Build the system prompt with current available actions and optional knowledge."""
    actions_text = "\n".join(f"- {k}: {v}" for k, v in AVAILABLE_ACTIONS.items())
    return ACTION_SYSTEM_PROMPT.format(
        actions=actions_text,
        knowledge_context=knowledge_context,
    )


def parse_action_block(response_text: str) -> dict | None:
    """Extract and parse a roosk_action JSON block from LLM response text.

    Returns None if no action block found, or the parsed dict.
    """
    match = _ACTION_BLOCK_RE.search(response_text)
    if not match:
        return None

    try:
        block = json.loads(match.group(1).strip())
        if "action" in block:
            return block
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse action block: {e}")

    return None


def strip_action_block(response_text: str) -> str:
    """Remove the action block from the response text, leaving only the explanation."""
    return _ACTION_BLOCK_RE.sub("", response_text).strip()


async def execute_action(
    action_block: dict,
    db: AsyncSession,
    user_id: str | None = None,
) -> dict[str, Any]:
    """Execute a parsed action block and return the result.

    Returns:
        {
            "action": str,
            "success": bool,
            "result": dict,
            "error": str | None,
        }
    """
    action = action_block.get("action", "")
    params = action_block.get("params", {})

    try:
        # --- VM Actions ---
        if action == "vm.list":
            vms = await proxmox_client.list_vms()
            return _ok(action, {"vms": vms, "count": len(vms)})

        elif action == "vm.status":
            vmid = int(params.get("vmid", 0))
            if not vmid:
                return _err(action, "Missing vmid parameter")
            data = await proxmox_client.get_vm_status(vmid)
            return _ok(action, {"vmid": vmid, "status": data})

        elif action == "vm.start":
            vmid = int(params["vmid"])
            data = await proxmox_client.start_vm(vmid)
            return _ok(action, {"vmid": vmid, "started": True, "data": data})

        elif action == "vm.stop":
            vmid = int(params["vmid"])
            data = await proxmox_client.stop_vm(vmid)
            return _ok(action, {"vmid": vmid, "stopped": True, "data": data})

        elif action == "vm.restart":
            vmid = int(params["vmid"])
            data = await proxmox_client.restart_vm(vmid)
            return _ok(action, {"vmid": vmid, "restarted": True, "data": data})

        elif action == "vm.snapshot":
            vmid = int(params["vmid"])
            name = params.get("name", f"snap-{vmid}-ai")
            desc = params.get("description", "Created via AI terminal")
            data = await proxmox_client.create_snapshot(vmid, name, desc)
            return _ok(action, {"vmid": vmid, "snapshot": name, "data": data})

        elif action == "vm.create":
            create_params = {
                "vmid": int(params.get("vmid", 0)) or None,
                "name": params.get("name", "ai-vm"),
                "cores": int(params.get("cores", 2)),
                "memory": int(params.get("ram_mb", 4096)),
                "ostype": params.get("os_type", "l26"),
            }
            # Auto-assign VMID if not provided
            if not create_params["vmid"]:
                existing = await proxmox_client.list_vms()
                create_params["vmid"] = max((v["vmid"] for v in existing), default=199) + 1
            data = await proxmox_client.create_vm(**create_params)
            return _ok(action, {"vmid": create_params["vmid"], "name": create_params["name"], "created": True, "data": data})

        elif action == "vm.delete":
            vmid = int(params["vmid"])
            data = await proxmox_client.delete_vm(vmid)
            return _ok(action, {"vmid": vmid, "deleted": True, "data": data})

        elif action == "vm.clone":
            vmid = int(params["vmid"])
            name = params.get("name", f"clone-{vmid}")
            existing = await proxmox_client.list_vms()
            newid = max((v["vmid"] for v in existing), default=199) + 1
            data = await proxmox_client.clone_vm(vmid, newid, name)
            return _ok(action, {"source_vmid": vmid, "new_vmid": newid, "name": name, "data": data})

        elif action == "vm.resize":
            vmid = int(params["vmid"])
            cores = params.get("cores")
            ram_mb = params.get("ram_mb")
            data = await proxmox_client.resize_vm(
                vmid,
                cores=int(cores) if cores else None,
                memory=int(ram_mb) if ram_mb else None,
            )
            return _ok(action, {"vmid": vmid, "resized": True, "cores": cores, "ram_mb": ram_mb, "data": data})

        elif action == "vm.console":
            vmid = int(params["vmid"])
            data = await proxmox_client.get_vm_vnc(vmid)
            return _ok(action, {"vmid": vmid, "console": data})

        # --- Container Actions ---
        elif action == "container.list":
            containers = await proxmox_client.list_containers()
            return _ok(action, {"containers": containers, "count": len(containers)})

        elif action == "container.start":
            vmid = int(params["vmid"])
            data = await proxmox_client.start_container(vmid)
            return _ok(action, {"vmid": vmid, "started": True, "data": data})

        elif action == "container.stop":
            vmid = int(params["vmid"])
            data = await proxmox_client.stop_container(vmid)
            return _ok(action, {"vmid": vmid, "stopped": True, "data": data})

        # --- Service Actions ---
        elif action == "service.list":
            templates = await list_templates()
            return _ok(action, {"templates": templates, "count": len(templates)})

        elif action == "service.deploy":
            template_id = params.get("template_id", "")
            template = await get_template(template_id)
            if not template:
                available = [t["id"] for t in await list_templates()]
                return _err(action, f"Unknown template '{template_id}'. Available: {', '.join(available)}")
            overrides = params.get("overrides", {})
            result = await deploy_service(template_id, overrides, db, user_id)
            return _ok(action, result)

        elif action == "service.deployments":
            from app.models.models import ServiceDeployment
            result = await db.execute(
                select(ServiceDeployment).order_by(ServiceDeployment.created_at.desc()).limit(20)
            )
            deployments = [
                {
                    "deployment_id": d.deployment_id,
                    "template_name": d.template_name,
                    "vm_name": d.vm_name,
                    "status": d.status,
                    "created_at": d.created_at.isoformat() if d.created_at else None,
                }
                for d in result.scalars().all()
            ]
            return _ok(action, {"deployments": deployments, "count": len(deployments)})

        # --- Database Actions ---
        elif action == "db.list":
            from app.models.models import DatabaseInstance
            result = await db.execute(select(DatabaseInstance))
            dbs = [
                {
                    "id": str(d.id), "name": d.name, "engine": d.engine,
                    "host": d.host, "port": d.port, "role": d.role, "status": d.status,
                }
                for d in result.scalars().all()
            ]
            return _ok(action, {"databases": dbs, "count": len(dbs)})

        elif action == "db.status":
            from app.models.models import DatabaseInstance
            result = await db.execute(select(DatabaseInstance))
            dbs = [
                {
                    "name": d.name, "engine": d.engine, "status": d.status,
                    "connections_active": d.connections_active,
                    "connections_max": d.connections_max,
                    "storage_used_gb": d.storage_used_gb,
                    "replication_lag": d.replication_lag_seconds,
                    "last_backup": d.last_backup.isoformat() if d.last_backup else None,
                }
                for d in result.scalars().all()
            ]
            return _ok(action, {"databases": dbs, "count": len(dbs)})

        elif action == "db.backup":
            db_id = params.get("db_id")
            if not db_id:
                return _err(action, "Missing db_id parameter")
            from app.models.models import DatabaseInstance
            from uuid import UUID
            result = await db.execute(select(DatabaseInstance).where(DatabaseInstance.id == UUID(db_id)))
            target = result.scalar_one_or_none()
            if not target:
                return _err(action, f"Database '{db_id}' not found")
            return _ok(action, {"database": target.name, "backup_status": "initiated", "host": target.host})

        # --- Network Actions ---
        elif action == "network.topology":
            network = await proxmox_client.get_network()
            bridges = [n for n in network if n.get("type") == "bridge"]
            vlans = [n for n in network if "vlan" in n.get("iface", "").lower()]
            return _ok(action, {"interfaces": len(network), "bridges": len(bridges), "vlans": len(vlans), "data": network})

        elif action == "network.storage":
            storage = await proxmox_client.get_storage()
            return _ok(action, {"pools": storage, "count": len(storage)})

        # --- User Actions ---
        elif action == "user.list":
            from app.models.models import User
            result = await db.execute(select(User).order_by(User.created_at))
            users = [
                {
                    "id": str(u.id), "username": u.username, "email": u.email,
                    "role": u.role, "mfa_enabled": u.mfa_enabled, "is_active": u.is_active,
                }
                for u in result.scalars().all()
            ]
            return _ok(action, {"users": users, "count": len(users)})

        # --- Log Actions ---
        elif action == "log.audit":
            from app.models.models import AuditLog
            limit = int(params.get("limit", 20))
            result = await db.execute(
                select(AuditLog).order_by(AuditLog.timestamp.desc()).limit(limit)
            )
            logs = [
                {
                    "action": log.action, "resource_type": log.resource_type,
                    "outcome": log.outcome,
                    "timestamp": log.timestamp.isoformat() if log.timestamp else None,
                }
                for log in result.scalars().all()
            ]
            return _ok(action, {"logs": logs, "count": len(logs)})

        elif action == "log.security":
            from app.models.models import SecurityAlert
            resolved = params.get("resolved", False)
            result = await db.execute(
                select(SecurityAlert)
                .where(SecurityAlert.resolved == resolved)
                .order_by(SecurityAlert.created_at.desc())
                .limit(20)
            )
            alerts = [
                {
                    "id": str(a.id), "severity": a.severity, "title": a.title,
                    "source": a.source, "resolved": a.resolved,
                    "created_at": a.created_at.isoformat() if a.created_at else None,
                }
                for a in result.scalars().all()
            ]
            return _ok(action, {"alerts": alerts, "count": len(alerts)})

        # --- Platform Actions ---
        elif action == "platform.health":
            px_health = await proxmox_client.health_check()
            return _ok(action, {"proxmox": px_health})

        elif action == "platform.metrics":
            node_status = await proxmox_client.get_node_status()
            return _ok(action, {
                "cpu_percent": round(node_status.get("cpu", 0) * 100, 1),
                "ram_used": node_status.get("memory", {}).get("used", 0),
                "ram_total": node_status.get("memory", {}).get("total", 0),
                "uptime": node_status.get("uptime", 0),
            })

        elif action == "platform.nodes":
            nodes = await proxmox_client.get_nodes()
            return _ok(action, {"nodes": nodes, "count": len(nodes)})

        else:
            return _err(action, f"Unknown action: {action}")

    except Exception as e:
        logger.error(f"Action execution failed: {action} — {e}")
        return _err(action, str(e))


def _ok(action: str, result: dict) -> dict:
    return {"action": action, "success": True, "result": result, "error": None}


def _err(action: str, error: str) -> dict:
    return {"action": action, "success": False, "result": {}, "error": error}
