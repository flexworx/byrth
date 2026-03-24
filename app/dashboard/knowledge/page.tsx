'use client'

import { useState } from 'react'
import { BookOpen, Search, FileText, Server, Shield, Database, Network, Bot, ChevronRight, ChevronDown, Terminal, Activity, Settings, Brain, Key, Users, Boxes } from 'lucide-react'
import { clsx } from 'clsx'

interface KBArticle {
  id: string
  title: string
  category: string
  excerpt: string
  tags: string[]
  updated: string
  content: string
}

const articles: KBArticle[] = [
  {
    id: '1', title: 'Getting Started with Roosk Platform', category: 'General',
    excerpt: 'Overview of platform architecture, initial setup, and first steps for administrators.',
    tags: ['setup', 'admin', 'quickstart'], updated: '2026-03-09',
    content: `## Quick Start Guide

### Prerequisites
- Dell PowerEdge R7625 (or equivalent) with Proxmox VE 9.1 installed
- Docker Engine 24+ and Docker Compose v2
- Domain name pointing to your server IP
- AWS account with Bedrock access (us-east-1)

### Installation Steps

1. **Clone the repository**
   \`\`\`bash
   git clone https://github.com/flexworx/byrth.git
   cd roosk
   \`\`\`

2. **Configure environment**
   \`\`\`bash
   cp .env.example .env
   # Edit .env with your values:
   # - DATABASE_URL (PostgreSQL connection string)
   # - JWT_SECRET_KEY (generate with: openssl rand -hex 32)
   # - PROXMOX_HOST, PROXMOX_USER, PROXMOX_TOKEN_ID, PROXMOX_TOKEN_SECRET
   # - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY
   \`\`\`

3. **Initialize SSL certificates**
   \`\`\`bash
   chmod +x scripts/init-ssl.sh
   ./scripts/init-ssl.sh your-domain.com your-email@domain.com
   \`\`\`

4. **Launch the platform**
   \`\`\`bash
   docker compose up -d
   \`\`\`

5. **Run database migrations**
   \`\`\`bash
   docker compose exec backend alembic upgrade head
   \`\`\`

6. **Create admin user**
   \`\`\`bash
   docker compose exec backend python -m app.scripts.create_admin
   \`\`\`

### Architecture Overview
- **Frontend**: Next.js 14 on port 3000 (proxied through Nginx)
- **Backend**: FastAPI on port 8000 (internal only)
- **Database**: PostgreSQL 16 on port 5432 (internal only)
- **Proxy**: Nginx on ports 80/443 with SSL termination
- **Monitoring**: Prometheus (9090) + Grafana (3001)`
  },
  {
    id: '2', title: 'VM Provisioning via Proxmox', category: 'Infrastructure',
    excerpt: 'How to create, configure, and manage virtual machines through the dashboard or AI terminal.',
    tags: ['vm', 'proxmox', 'provisioning'], updated: '2026-03-09',
    content: `## Virtual Machine Management

### Creating VMs via Dashboard
Navigate to Dashboard > Virtual Machines > Create VM. Specify:
- **Name**: Hostname (alphanumeric + hyphens)
- **CPU Cores**: 1-32 (allocated from EPYC 9354 pool)
- **RAM**: 512MB - 64GB
- **Disk**: 10GB - 2TB (ZFS thin provisioned)
- **OS Type**: Linux (l26), Windows (win11), Other
- **VLAN**: Management (10), Tenant (30), DMZ (40)

### Creating VMs via AI Console
\`\`\`
"Create a new Ubuntu VM with 4 cores, 8GB RAM, and 100GB disk"
"Deploy a Windows 11 desktop with 8 cores and 16GB RAM"
"Clone VM-APP-01 as a test environment"
\`\`\`

### VM Lifecycle Actions
| Action | Dashboard | AI Command | API |
|--------|-----------|------------|-----|
| Start | Green play button | "Start VM 104" | POST /api/vms/{id}/start |
| Stop | Red stop button | "Stop VM 104" | POST /api/vms/{id}/stop |
| Restart | Amber restart | "Restart VM 104" | POST /api/vms/{id}/restart |
| Snapshot | Actions menu | "Snapshot VM 104" | POST /api/vms/{id}/snapshot |
| Delete | Actions > Delete | "Delete VM 104" | DELETE /api/vms/{id} |
| Resize | Settings tab | "Resize VM 104 to 8 cores" | PATCH /api/vms/{id} |
| Clone | Actions > Clone | "Clone VM 104" | POST /api/vms/{id}/clone |

### Resource Limits
- Max concurrent VMs: ~50 (depends on resource allocation)
- Available CPU: 128 threads (2x EPYC 9354)
- Available RAM: 128GB DDR5
- Storage: ~10TB usable (3x 3.84TB NVMe in RAIDZ1)

### Templates
Pre-built service templates available:
- \`windows-desktop\`: Windows 11 with RDP (4 cores, 8GB, 100GB)
- \`wireguard-vpn\`: WireGuard VPN server (1 core, 1GB, 10GB)
- \`code-server\`: VS Code in browser (2 cores, 4GB, 50GB)
- \`guacamole\`: Apache Guacamole gateway (2 cores, 4GB, 20GB)
- \`dev-environment\`: Full dev stack (4 cores, 8GB, 100GB)`
  },
  {
    id: '3', title: 'VLAN Network Segmentation', category: 'Networking',
    excerpt: 'Network isolation strategy: Management, Control Plane, Tenant, DMZ, and Storage VLANs.',
    tags: ['vlan', 'network', 'security', 'cato'], updated: '2026-03-09',
    content: `## Network Architecture

### VLAN Layout
| VLAN ID | Name | Subnet | Purpose |
|---------|------|--------|---------|
| 10 | Management | 10.0.10.0/24 | Proxmox, IPMI, management interfaces |
| 20 | Control Plane | 10.0.20.0/24 | Roosk platform, API servers, databases |
| 30 | Tenant | 10.0.30.0/24 | Customer/user VMs, DaaS desktops |
| 40 | DMZ | 10.0.40.0/24 | Public-facing services, web servers |
| 50 | Storage | 10.0.50.0/24 | ZFS replication, backup traffic |

### Cato 1600 SASE Integration
The Cato 1600 device provides:
- **SD-WAN**: Intelligent path selection across WAN links
- **Firewall**: Layer 7 application-aware firewall
- **IPS**: Intrusion prevention system
- **ZTNA**: Zero Trust Network Access for remote users
- **SWG**: Secure Web Gateway with SSL inspection

Configuration is managed through the Cato Management Application (CMA):
1. Log in to cma.catonetworks.com
2. Navigate to Network > Sites > Your Site
3. Configure LAN interfaces for each VLAN
4. Set up firewall rules per VLAN
5. Enable IPS and anti-malware inspection

### Firewall Rules (Default)
- Management VLAN: Access to all VLANs (admin only)
- Control Plane: Access to Storage, limited DMZ
- Tenant: Isolated, internet access via Cato SWG
- DMZ: Internet-facing only, no access to internal VLANs
- Storage: No internet, accessible from Control Plane only`
  },
  {
    id: '4', title: 'SOC 2 Type II Compliance Controls', category: 'Compliance',
    excerpt: 'Complete mapping of SOC 2 Trust Service Criteria to platform features and audit evidence.',
    tags: ['soc2', 'compliance', 'audit', 'nist'], updated: '2026-03-09',
    content: `## SOC 2 Type II Control Mapping

### Trust Service Criteria Coverage

**CC1 — Control Environment**
- Role-based access (4 roles: platform_admin, operator, viewer, api_service)
- Segregation of duties enforced via RBAC
- Evidence: User list, role assignments, audit logs

**CC2 — Communication and Information**
- Security policies documented in Knowledge Base
- Incident response runbooks maintained
- Evidence: KB articles, runbook executions

**CC3 — Risk Assessment**
- Automated vulnerability scanning via Wazuh
- Risk register maintained in compliance dashboard
- Evidence: Security alerts, remediation records

**CC4 — Monitoring Activities**
- Real-time monitoring via Prometheus + Grafana
- WebSocket notifications for critical alerts
- Evidence: Alert history, notification logs

**CC5 — Control Activities**
- JWT + TOTP MFA authentication
- API key scope restrictions
- CSP + security headers enforced
- Evidence: Auth logs, key audit trail

**CC6 — Logical and Physical Access**
- VLAN network segmentation (5 zones)
- SSH session audit logging
- Cato ZTNA for remote access
- Evidence: Network configs, SSH logs, ZTNA sessions

**CC7 — System Operations**
- Automated backups (PostgreSQL + ZFS snapshots)
- Maintenance window scheduling
- Runbook automation for incident response
- Evidence: Backup logs, maintenance records, runbook runs

**CC8 — Change Management**
- Git-tracked infrastructure changes
- Audit log for all configuration changes
- Approval workflows for destructive actions
- Evidence: Git history, audit logs, approval records

### NIST SP 800-53 Crosswalk
The platform maps to NIST families: AC (Access Control), AU (Audit), CA (Assessment), CM (Configuration Management), IA (Identification and Authentication), IR (Incident Response), SC (System and Communications Protection), SI (System and Information Integrity).`
  },
  {
    id: '5', title: 'Database Backup & Recovery', category: 'Database',
    excerpt: 'Automated backup schedules, ZFS snapshots, point-in-time recovery procedures.',
    tags: ['backup', 'postgresql', 'recovery', 'zfs'], updated: '2026-03-09',
    content: `## Backup Strategy

### Backup Layers
1. **pg_dump** — Logical backups, daily at 02:00 UTC
2. **WAL Archiving** — Continuous, enables point-in-time recovery
3. **ZFS Snapshots** — Block-level, every 6 hours
4. **Off-site Replication** — Optional S3 upload for DR

### Backup Schedule
| Type | Frequency | Retention | Location |
|------|-----------|-----------|----------|
| pg_dump | Daily 02:00 | 30 days | /backups/pg/ |
| WAL Archive | Continuous | 7 days | /backups/wal/ |
| ZFS Snapshot | Every 6h | 7 days | ZFS pool |
| S3 Upload | Daily 04:00 | 90 days | s3://roosk-backups/ |

### Recovery Procedures

**Full Restore**
\`\`\`bash
# Stop services
docker compose stop backend frontend
# Restore from pg_dump
docker compose exec postgres pg_restore -d roosk /backups/pg/latest.dump
# Restart services
docker compose start backend frontend
\`\`\`

**Point-in-Time Recovery**
\`\`\`bash
# Specify target timestamp
docker compose exec postgres pg_restore --target-time="2026-03-08 14:30:00" -d roosk
\`\`\`

**ZFS Snapshot Rollback**
\`\`\`bash
# List available snapshots
zfs list -t snapshot rpool/data
# Rollback (destructive — destroys newer data)
zfs rollback rpool/data@snap-20260308
\`\`\`

### Monitoring
- Backup status visible in Dashboard > Databases
- Failed backup alerts via WebSocket notifications
- Backup age monitoring in Prometheus (alert if > 26 hours old)`
  },
  {
    id: '6', title: 'AI Agent Architecture & Bedrock Integration', category: 'AI/ML',
    excerpt: 'How CentralIntel.ai agents work: types, capabilities, heartbeat protocol, and Bedrock configuration.',
    tags: ['ai', 'agents', 'bedrock', 'llm'], updated: '2026-03-09',
    content: `## AI Agent System

### Agent Types
| Agent | Model | Capabilities |
|-------|-------|-------------|
| Murph (General) | Claude Sonnet 4 | Full-stack operations, 28 executable actions |
| Infra Agent | Claude Sonnet 4 | VM management, compute scaling, storage ops |
| Security Agent | Claude Sonnet 4 | Threat analysis, incident response, compliance |
| Database Agent | Claude Sonnet 4 | Query optimization, backup management, replication |
| Network Agent | Claude Sonnet 4 | VLAN config, firewall rules, Cato SASE |
| DaaS Agent | Claude Sonnet 4 | Desktop provisioning, user management |
| Monitoring Agent | Claude Sonnet 4 | Alert triage, metric analysis, capacity planning |

### AWS Bedrock Configuration
\`\`\`bash
# Required environment variables
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret
AWS_DEFAULT_REGION=us-east-1
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-20250514-v1:0

# Optional: Use Claude Opus for complex decisions
BEDROCK_COMPLEX_MODEL_ID=us.anthropic.claude-opus-4-20250514-v1:0
\`\`\`

### Action Execution Flow
1. User types natural language prompt
2. Frontend sends to \`POST /api/llm/complete\`
3. Backend injects live platform state (VM list, CPU, RAM, alerts)
4. Request routed to Bedrock with action-aware system prompt
5. If LLM includes \`roosk_action\` block, action is parsed and executed
6. Action result returned alongside LLM explanation
7. All requests logged for cost tracking and audit

### Data Sanitization
Before any prompt reaches Bedrock:
- RFC1918 IPs → \`[INTERNAL-IP]\`
- VM hostnames → \`[VM-NAME]\`
- Internal file paths → stripped
- Sensitive keywords → request rejected

### 28 Available Actions
VMs: list, status, start, stop, restart, snapshot, create, delete, clone, resize, console
Containers: list, start, stop
Services: list, deploy, deployments
Database: list, status, backup
Network: topology, storage
Users: list
Logs: audit, security
Platform: health, metrics, nodes`
  },
  {
    id: '7', title: 'SSH Terminal Security & Audit Logging', category: 'Security',
    excerpt: 'WebSocket SSH proxy, JWT authentication, session recording, allowed network ranges.',
    tags: ['ssh', 'security', 'terminal', 'audit'], updated: '2026-03-09',
    content: `## SSH Terminal

### Architecture
The browser-based SSH terminal uses:
- **xterm.js** — Terminal emulator rendered in the browser
- **WebSocket** — Bidirectional communication via \`/api/ssh/connect\`
- **Paramiko** — Python SSH client on the backend
- **JWT Auth** — WebSocket upgrade requires valid JWT token

### Connection Flow
1. User opens Dashboard > SSH Terminal
2. Frontend establishes WebSocket to \`/api/ssh/connect\`
3. JWT token validated on WebSocket upgrade
4. User enters target host/port/username
5. Backend opens SSH connection via Paramiko
6. Bidirectional data stream between browser and SSH session
7. All keystrokes logged to audit trail

### Security Controls
- **Allowed Networks**: Only Management (10.0.10.0/24) and Control Plane (10.0.20.0/24)
- **Prohibited**: Direct SSH to internet hosts
- **Authentication**: SSH key preferred, password allowed with MFA
- **Session Timeout**: 30 minutes idle, 8 hours maximum
- **Recording**: Full session recording stored for 90 days

### Audit Trail
Every SSH session logs:
- Session start/end timestamps
- Target host and port
- Authenticating user
- Commands executed (keystroke buffer)
- Bytes transferred
- Session outcome (clean exit, timeout, error)`
  },
  {
    id: '8', title: 'Incident Response Runbook', category: 'Security',
    excerpt: 'Step-by-step procedures for security incidents: isolation, evidence, remediation, reporting.',
    tags: ['incident', 'security', 'runbook', 'soc2'], updated: '2026-03-09',
    content: `## Incident Response Procedures

### Severity Levels
| Level | Response Time | Examples |
|-------|--------------|---------|
| P0 - Critical | < 15 min | Active breach, data exfiltration, ransomware |
| P1 - High | < 1 hour | Unauthorized access, privilege escalation |
| P2 - Medium | < 4 hours | Malware detected, suspicious activity |
| P3 - Low | < 24 hours | Policy violation, failed login spike |

### Response Steps

**1. Detection & Triage**
- Alert received via Wazuh/Prometheus → WebSocket notification
- AI Security Agent performs initial classification
- QPS score assigned via Quantum Communications engine
- On-call engineer notified

**2. Containment**
- Isolate affected VM(s): \`"Stop VM 104"\` or network isolation
- Block suspicious IPs via Cato firewall
- Disable compromised accounts
- Preserve evidence: ZFS snapshot of affected systems

**3. Investigation**
- Review audit logs: Dashboard > Audit Logs (filter by timeframe)
- Check SSH session recordings
- Analyze Wazuh alerts for IoCs
- Correlate with network flow data from Cato

**4. Remediation**
- Patch vulnerabilities identified
- Rotate compromised credentials
- Restore from clean backup if needed
- Update firewall rules

**5. Recovery**
- Restore services from clean snapshots
- Verify system integrity
- Re-enable user access
- Monitor for recurrence (24h watch)

**6. Post-Incident**
- Document incident timeline
- Update runbooks with lessons learned
- File compliance report if required
- Update Knowledge Base article`
  },
  {
    id: '9', title: 'API Authentication & Programmatic Access', category: 'Development',
    excerpt: 'JWT token flow, API key scopes, rate limiting, and integration patterns.',
    tags: ['api', 'auth', 'jwt', 'keys'], updated: '2026-03-09',
    content: `## API Reference

### Authentication Methods

**1. JWT Token (Interactive Users)**
\`\`\`bash
# Login
POST /api/auth/login
Body: {"username": "admin", "password": "...", "totp_code": "123456"}
Response: {"access_token": "eyJ...", "token_type": "bearer"}

# Use token
Authorization: Bearer eyJ...
\`\`\`

**2. API Key (Service Accounts)**
\`\`\`bash
# Create key (admin only)
POST /api/auth/api-keys
Body: {"name": "ci-pipeline", "scopes": ["vms:read", "vms:write"]}
Response: {"key": "roosk_sk_...", "id": "uuid"}

# Use key
X-API-Key: roosk_sk_...
\`\`\`

### Available Scopes
| Scope | Description |
|-------|-------------|
| vms:read | List and view VM details |
| vms:write | Create, modify, delete VMs |
| services:read | List service templates and deployments |
| services:write | Deploy and manage services |
| databases:read | View database status |
| databases:write | Backup, restore operations |
| security:read | View alerts and audit logs |
| security:write | Resolve alerts, manage rules |
| users:read | List users |
| users:write | Create, modify users |
| llm:access | Use AI terminal / LLM proxy |
| admin:all | Full administrative access |

### Rate Limits
- **API endpoints**: 30 requests/second per IP
- **LLM proxy**: 10 requests/minute per user
- **Auth endpoints**: 5 attempts/minute per IP

### Key API Endpoints
| Method | Path | Description |
|--------|------|-------------|
| GET | /api/vms | List all VMs |
| POST | /api/vms | Create VM |
| POST | /api/vms/{id}/{action} | VM lifecycle action |
| GET | /api/services/templates | List templates |
| POST | /api/services/deploy | Deploy service |
| GET | /api/databases | List databases |
| GET | /api/security/alerts | Get security alerts |
| POST | /api/llm/complete | AI prompt completion |
| GET | /api/metrics | System metrics |
| GET | /api/audit-logs | Audit trail |`
  },
  {
    id: '10', title: 'Monitoring, Alerting & Prometheus Setup', category: 'Operations',
    excerpt: 'Prometheus metrics, Grafana dashboards, alert rules, WebSocket notification channels.',
    tags: ['monitoring', 'prometheus', 'grafana', 'alerts'], updated: '2026-03-09',
    content: `## Monitoring Stack

### Components
- **Prometheus** (port 9090) — Metric collection and alerting rules
- **Grafana** (port 3001) — Dashboards and visualization
- **Node Exporter** — Hardware and OS metrics from Proxmox host
- **Roosk Exporter** — Custom metrics from FastAPI backend

### Key Metrics
| Metric | Type | Description |
|--------|------|-------------|
| roosk_vms_total | Gauge | Total VMs by status |
| roosk_cpu_usage_percent | Gauge | Overall CPU utilization |
| roosk_ram_usage_bytes | Gauge | RAM usage |
| roosk_storage_used_bytes | Gauge | Storage consumption |
| roosk_api_requests_total | Counter | API request count by endpoint |
| roosk_api_latency_seconds | Histogram | API response times |
| roosk_llm_requests_total | Counter | LLM proxy requests |
| roosk_llm_cost_usd | Counter | Estimated Bedrock spend |
| roosk_security_alerts_active | Gauge | Unresolved security alerts |
| roosk_backup_age_seconds | Gauge | Time since last backup |

### Alert Rules
\`\`\`yaml
groups:
  - name: roosk
    rules:
      - alert: HighCPU
        expr: roosk_cpu_usage_percent > 85
        for: 5m
        labels: { severity: warning }
      - alert: CriticalCPU
        expr: roosk_cpu_usage_percent > 95
        for: 2m
        labels: { severity: critical }
      - alert: LowDiskSpace
        expr: (roosk_storage_used_bytes / roosk_storage_total_bytes) > 0.85
        for: 10m
        labels: { severity: warning }
      - alert: BackupStale
        expr: roosk_backup_age_seconds > 93600
        for: 1m
        labels: { severity: critical }
      - alert: VMDown
        expr: roosk_vm_status{status="stopped"} == 1
        for: 5m
        labels: { severity: warning }
\`\`\`

### WebSocket Notifications
All Prometheus alerts are forwarded to the Roosk WebSocket notification system:
1. Alertmanager sends webhook to \`/api/webhooks/alertmanager\`
2. Backend publishes to WebSocket channel
3. DashboardHeader bell icon shows real-time count
4. Toast notifications for critical alerts`
  },
  {
    id: '11', title: 'Docker Compose Deployment Guide', category: 'Infrastructure',
    excerpt: 'Complete guide to deploying Roosk via Docker Compose with SSL, monitoring, and auto-restart.',
    tags: ['docker', 'deployment', 'nginx', 'ssl'], updated: '2026-03-09',
    content: `## Docker Deployment

### Services Overview
| Service | Image | Ports | Purpose |
|---------|-------|-------|---------|
| postgres | postgres:16-alpine | 5432 (internal) | Primary database |
| backend | roosk-backend | 8000 (internal) | FastAPI API server |
| frontend | roosk-frontend | 3000 (internal) | Next.js web UI |
| nginx | nginx:alpine | 80, 443 | Reverse proxy, SSL |
| certbot | certbot | — | SSL certificate renewal |
| prometheus | prom/prometheus | 9090 | Metrics collection |
| grafana | grafana/grafana | 3001 | Metrics dashboards |

### Environment Variables
See \`.env.example\` for complete list. Critical settings:
\`\`\`bash
# Database
DATABASE_URL=postgresql+asyncpg://roosk:password@postgres:5432/roosk

# Security
JWT_SECRET_KEY=<openssl rand -hex 32>
JWT_ALGORITHM=HS256

# Proxmox
PROXMOX_HOST=10.0.10.1
PROXMOX_USER=root@pam
PROXMOX_TOKEN_ID=roosk
PROXMOX_TOKEN_SECRET=<token>

# AWS Bedrock
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_DEFAULT_REGION=us-east-1

# Domain
DOMAIN=roosk.yourdomain.com
\`\`\`

### Commands
\`\`\`bash
# Start all services
docker compose up -d

# View logs
docker compose logs -f backend

# Run migrations
docker compose exec backend alembic upgrade head

# Rebuild after code changes
docker compose build frontend backend
docker compose up -d frontend backend

# SSL certificate renewal (auto via certbot)
docker compose run certbot renew
\`\`\``
  },
  {
    id: '12', title: 'AI Operations Console — Natural Language Guide', category: 'AI/ML',
    excerpt: 'How to use the AI Ops Console to build, deploy, and manage anything via natural language.',
    tags: ['ai', 'console', 'natural-language', 'commands'], updated: '2026-03-09',
    content: `## AI Operations Console

The AI Ops Console (Dashboard > AI Operations) lets you manage your entire infrastructure using plain English. Behind the scenes, your prompts are processed by Claude via AWS Bedrock, with live platform state injected for context-aware responses.

### What You Can Do

**Virtual Machine Management**
- "Create a new Ubuntu VM with 4 cores and 8GB RAM"
- "List all running VMs"
- "Stop VM 104"
- "Resize VM-WEB-01 to 8 cores and 16GB RAM"
- "Take a snapshot of VM 105 before the upgrade"
- "Clone VM-APP-01 as staging-test"

**Service Deployment**
- "Deploy a WireGuard VPN server"
- "Set up a VS Code Server for remote development"
- "Deploy a Windows 11 desktop with 8 cores"
- "Spin up an Apache Guacamole remote desktop gateway"

**Database Operations**
- "Show me database status"
- "Trigger a backup of the primary database"
- "What's the replication lag?"

**Security & Compliance**
- "Show all unresolved security alerts"
- "Pull up the last 50 audit log entries"
- "Are we SOC 2 compliant?"

**Network & Infrastructure**
- "Show network topology"
- "What storage pools are available?"
- "Check platform health"

**Website Deployment**
- "Deploy a new web server with Nginx"
- "Set up a Node.js application server"
- "Create a dev environment for a React project"

### Agent Specialization
Select a specialized agent for domain-specific expertise:
- **Murph (General)**: Best for mixed tasks and broad questions
- **Infra Agent**: VM and compute optimization
- **Security Agent**: Threat analysis and compliance
- **Database Agent**: Query performance, backup strategy
- **Network Agent**: VLAN configuration, Cato SASE rules

### Tips
- Be specific about resource requirements (cores, RAM, disk)
- The AI has live visibility into all VMs, alerts, and metrics
- Destructive actions (stop, delete) include safety confirmations
- All actions are logged in the audit trail`
  },
  {
    id: '13', title: 'Cato 1600 SASE Configuration', category: 'Networking',
    excerpt: 'Managing your Cato 1600 device: SD-WAN, firewall, ZTNA, and integration with Roosk.',
    tags: ['cato', 'sase', 'firewall', 'ztna', 'sdwan'], updated: '2026-03-09',
    content: `## Cato 1600 SASE Device

### Overview
The Cato 1600 is a SASE (Secure Access Service Edge) appliance that provides:
- SD-WAN for intelligent traffic routing
- Next-Generation Firewall (NGFW)
- Intrusion Prevention System (IPS)
- Zero Trust Network Access (ZTNA)
- Secure Web Gateway (SWG)
- Cloud Access Security Broker (CASB)

### Integration with Roosk
The Roosk platform monitors the Cato device via its API:
- **Dashboard > Networks**: Shows VLAN topology routed through Cato
- **Security Center**: Displays IPS alerts forwarded from Cato
- **AI Console**: "Show Cato firewall status" queries the Cato API

### Configuration Checklist
1. **Site Setup**: Configure WAN interfaces (primary + backup)
2. **LAN Segmentation**: Map VLANs 10-50 to Cato LAN interfaces
3. **Firewall Rules**: Allow/deny between VLANs per security policy
4. **IPS Policy**: Enable recommended ruleset, tune for false positives
5. **ZTNA**: Configure remote access policies for admin users
6. **SWG**: Enable SSL inspection, configure URL categories
7. **SD-WAN**: Set application priorities (management > tenant > general)

### Management
- **Cato Management Application (CMA)**: cma.catonetworks.com
- **API**: Cato provides REST API for automation
- **Monitoring**: Cato provides native analytics dashboard

### Key Firewall Rules
| Source | Destination | Action | Notes |
|--------|-------------|--------|-------|
| VLAN 10 (Mgmt) | All VLANs | Allow | Admin access |
| VLAN 20 (Control) | VLAN 50 (Storage) | Allow | Backup traffic |
| VLAN 30 (Tenant) | Internet | Allow (SWG) | Filtered internet |
| VLAN 30 (Tenant) | VLAN 10,20 | Deny | Tenant isolation |
| VLAN 40 (DMZ) | Internet | Allow | Public services |
| VLAN 40 (DMZ) | VLAN 10,20,30 | Deny | DMZ isolation |`
  },
  {
    id: '14', title: 'Cost Tracking & Resource Optimization', category: 'Operations',
    excerpt: 'Understanding cost breakdown, AWS Bedrock spending, and infrastructure optimization.',
    tags: ['costs', 'optimization', 'bedrock', 'resources'], updated: '2026-03-09',
    content: `## Cost Management

### Monthly Cost Breakdown
| Resource | Cost | Notes |
|----------|------|-------|
| Dell R7625 Hardware | $0/mo | Owned, amortized over 5 years ($140/mo) |
| Electricity | ~$80/mo | Estimated for single server 24/7 |
| Internet (Business) | ~$100/mo | Static IP, SLA |
| Cato 1600 License | ~$200/mo | SASE subscription |
| AWS Bedrock (Claude) | ~$50-200/mo | Usage-based, depends on AI console activity |
| Domain + SSL | ~$15/year | Via Let's Encrypt (free SSL) |
| **Total On-Prem** | **~$430-580/mo** | |

### Cloud Equivalent Cost
Running equivalent workloads in AWS/Azure:
- 50 VMs equivalent: ~$3,000-5,000/mo
- Managed PostgreSQL: ~$200/mo
- Load balancer + WAF: ~$100/mo
- **Savings: 68-85% vs cloud**

### Bedrock Cost Optimization
- Use Claude Sonnet 4 (cheaper) for routine queries
- Reserve Claude Opus 4 for complex decisions only
- Cache common query results (Redis, 5-minute TTL)
- Batch non-urgent requests
- Monitor via Dashboard > Cost Tracking

### Resource Right-Sizing
- Review VM utilization weekly
- Downsize VMs with < 10% CPU average
- Consolidate underutilized databases
- Archive unused snapshots after 30 days`
  },
  {
    id: '15', title: 'Runbook Automation & Maintenance Windows', category: 'Operations',
    excerpt: 'Creating and executing automated runbooks, scheduling maintenance, and change management.',
    tags: ['runbook', 'automation', 'maintenance', 'change-management'], updated: '2026-03-09',
    content: `## Runbook Automation

### Built-in Runbooks
1. **High CPU Response** — Auto-diagnose, identify process, optional VM resize
2. **Database Failover** — Promote replica, update connection strings, verify
3. **SSL Certificate Renewal** — Check expiry, request cert, deploy, verify
4. **Security Incident Response** — Isolate, collect evidence, escalate, remediate

### Creating Custom Runbooks
Runbooks are defined as step sequences that can be executed manually or triggered by alerts:

\`\`\`json
{
  "id": "custom-backup-verify",
  "name": "Backup Verification",
  "trigger": "schedule:daily:06:00",
  "steps": [
    {"action": "db.status", "assert": "status == 'healthy'"},
    {"action": "db.backup", "params": {"db_id": "primary"}},
    {"action": "platform.metrics", "log": true},
    {"notify": "slack", "message": "Daily backup verification complete"}
  ]
}
\`\`\`

### Maintenance Windows
Schedule maintenance via Dashboard > Maintenance:
- **Title**: Descriptive name
- **Start/End**: Date and time range
- **Affected Resources**: VMs, services, networks
- **Status**: Scheduled → In Progress → Completed / Cancelled
- **Notifications**: Automatic stakeholder notifications at T-24h and T-1h

### Change Management
All changes are tracked:
1. Change request created (via maintenance window or manual)
2. Approval workflow (if required by role)
3. Execution during maintenance window
4. Post-change verification
5. Audit log entry with full context`
  },
  {
    id: '16', title: 'Digital Chief of Staff AI', category: 'AI/ML',
    excerpt: 'Quantum Communications v2 — QPS scoring, triage engine, AI daily briefings.',
    tags: ['chief-of-staff', 'quantum', 'triage', 'briefing'], updated: '2026-03-09',
    content: `## Digital Chief of Staff AI

### Overview
The Chief of Staff AI is an executive operations layer that triages all incoming communications using a Quantum Priority Scoring (QPS) system.

### Quantum Priority Score (QPS)
Each communication receives a score from 0-100:
- **Urgency (25%)**: NLP keyword analysis + historical patterns
- **Sender Importance (20%)**: Role hierarchy + relationship graph
- **Topic Relevance (20%)**: RAG similarity to active projects
- **Time Sensitivity (15%)**: Deadline proximity
- **Dependency Chain (10%)**: Downstream task blocking
- **Sentiment (10%)**: Emotion detection for escalation

### Priority Tiers
| Tier | Score | Response Time | Action |
|------|-------|--------------|--------|
| P0 | 90-100 | Immediate | Push notification, interrupt |
| P1 | 70-89 | < 30 min | Next review cycle |
| P2 | 40-69 | Daily | Batch digest |
| P3 | 0-39 | Weekly | Auto-archive candidate |

### AI Agents
- **Triage Agent**: Scores and classifies all incoming communications
- **Decision Support**: Synthesizes context, presents options with analysis
- **Delegation Agent**: Matches tasks to team members, tracks progress

### Communication Channels
- Email (via AWS SES)
- Slack (webhook integration)
- Microsoft Teams (webhook)
- SMS (via Amazon SNS)
- Voice (via Amazon Connect)

### Memory System
- **Short-Term (Redis)**: Active conversations, today's priorities
- **Long-Term (PostgreSQL + pgvector)**: Communication history with semantic search
- **Contextual Graph (Neo4j)**: People, projects, topics, dependencies

### Access
Dashboard > Chief of Staff AI`
  },
  {
    id: '17', title: 'Development Environment Setup', category: 'Development',
    excerpt: 'Setting up Git, VS Code, Node.js, Python, and development tools on the Dell server.',
    tags: ['development', 'git', 'vscode', 'setup', 'tools'], updated: '2026-03-09',
    content: `## Development Environment

### Server-Side Tools
Run the dev tools installer script:
\`\`\`bash
chmod +x infrastructure/deploy/install-dev-tools.sh
./infrastructure/deploy/install-dev-tools.sh
\`\`\`

This installs:
- Git (latest)
- Node.js 20 LTS (via NodeSource)
- Python 3.12 + pip + venv
- Docker Engine + Docker Compose v2
- GitHub CLI (gh)
- VS Code Server (code-server) for browser access
- PostgreSQL client tools
- Build essentials (gcc, make, etc.)

### VS Code Remote Development
1. Install VS Code on your local machine
2. Install "Remote - SSH" extension
3. Connect: \`ssh user@your-server-ip\`
4. VS Code opens with full access to server files

### Git Workflow
\`\`\`bash
# Clone the Roosk repo on the server
git clone https://github.com/flexworx/byrth.git
cd roosk

# Create feature branch
git checkout -b feature/my-feature

# Make changes, commit, push
git add .
git commit -m "Add my feature"
git push -u origin feature/my-feature

# Deploy changes
docker compose build frontend backend
docker compose up -d frontend backend
\`\`\`

### Browser-Based Development
Code Server (VS Code in browser) can be deployed via the AI Console:
\`\`\`
"Deploy a VS Code Server for remote development"
\`\`\`
This creates a VM with code-server pre-installed, accessible via HTTPS.`
  },
]

const categories = Array.from(new Set(articles.map((a) => a.category)))
const categoryIcons: Record<string, typeof BookOpen> = {
  General: BookOpen, Infrastructure: Server, Networking: Network,
  Compliance: Shield, Database: Database, 'AI/ML': Brain,
  Security: Shield, Development: Terminal, Operations: Activity,
}

export default function KnowledgeBasePage() {
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const filtered = articles.filter((a) => {
    const matchesSearch = !search || a.title.toLowerCase().includes(search.toLowerCase()) || a.tags.some((t) => t.includes(search.toLowerCase())) || a.content.toLowerCase().includes(search.toLowerCase())
    const matchesCategory = !activeCategory || a.category === activeCategory
    return matchesSearch && matchesCategory
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-xl font-bold text-nexgen-text flex items-center gap-2">
          <BookOpen size={22} className="text-nexgen-accent" />
          Knowledge Base
        </h1>
        <div className="relative w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-nexgen-muted" />
          <input
            type="text"
            placeholder="Search articles..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-4 py-2 bg-nexgen-bg border border-nexgen-border/40 rounded-lg text-xs text-nexgen-text focus:outline-none focus:border-nexgen-accent/60"
          />
        </div>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={clsx('px-3 py-1.5 rounded-lg text-xs transition-colors', !activeCategory ? 'bg-nexgen-accent/20 text-nexgen-accent' : 'text-nexgen-muted hover:text-nexgen-text')}
        >
          All ({articles.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={clsx('px-3 py-1.5 rounded-lg text-xs transition-colors', activeCategory === cat ? 'bg-nexgen-accent/20 text-nexgen-accent' : 'text-nexgen-muted hover:text-nexgen-text')}
          >
            {cat} ({articles.filter((a) => a.category === cat).length})
          </button>
        ))}
      </div>

      {/* Article list */}
      <div className="space-y-3">
        {filtered.map((article) => {
          const Icon = categoryIcons[article.category] ?? BookOpen
          const isExpanded = expandedId === article.id
          return (
            <div key={article.id} className="glass-card overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : article.id)}
                className="w-full p-5 text-left hover:bg-nexgen-card/20 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-nexgen-accent/10 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-nexgen-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-semibold text-nexgen-text">{article.title}</h3>
                      {isExpanded ? <ChevronDown size={14} className="text-nexgen-muted flex-shrink-0" /> : <ChevronRight size={14} className="text-nexgen-muted flex-shrink-0" />}
                    </div>
                    <p className="text-xs text-nexgen-muted leading-relaxed mb-2">{article.excerpt}</p>
                    <div className="flex items-center gap-3">
                      <div className="flex flex-wrap gap-1">
                        {article.tags.map((tag) => (
                          <span key={tag} className="px-1.5 py-0.5 rounded bg-nexgen-card text-[9px] font-mono text-nexgen-muted">{tag}</span>
                        ))}
                      </div>
                      <span className="text-[9px] text-nexgen-muted/60 ml-auto">{article.updated}</span>
                    </div>
                  </div>
                </div>
              </button>
              {isExpanded && (
                <div className="px-5 pb-5 border-t border-nexgen-border/10">
                  <div className="prose prose-sm prose-invert max-w-none mt-4 text-xs text-nexgen-text/80 leading-relaxed">
                    {article.content.split('\n').map((line, i) => {
                      if (line.startsWith('## ')) return <h2 key={i} className="text-base font-bold text-nexgen-text mt-4 mb-2">{line.slice(3)}</h2>
                      if (line.startsWith('### ')) return <h3 key={i} className="text-sm font-semibold text-nexgen-text mt-3 mb-1">{line.slice(4)}</h3>
                      if (line.startsWith('```')) return <div key={i} className="font-mono text-[10px] bg-nexgen-bg/70 rounded px-2 py-0.5 text-nexgen-accent">{line.replace(/```\w*/, '')}</div>
                      if (line.startsWith('|')) return <div key={i} className="font-mono text-[10px] text-nexgen-muted">{line}</div>
                      if (line.startsWith('- ')) return <div key={i} className="flex gap-1.5 ml-2"><span className="text-nexgen-accent">-</span><span>{line.slice(2)}</span></div>
                      if (line.match(/^\d+\. /)) return <div key={i} className="flex gap-1.5 ml-2"><span className="text-nexgen-accent font-mono">{line.match(/^\d+/)?.[0]}.</span><span>{line.replace(/^\d+\.\s*/, '')}</span></div>
                      if (line.trim() === '') return <div key={i} className="h-2" />
                      return <p key={i}>{line}</p>
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="glass-card p-12 text-center">
          <BookOpen size={40} className="text-nexgen-muted mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-nexgen-text mb-2">No Articles Found</h3>
          <p className="text-xs text-nexgen-muted">Try adjusting your search or category filter.</p>
        </div>
      )}
    </div>
  )
}
