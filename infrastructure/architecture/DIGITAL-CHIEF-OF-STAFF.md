# Digital Chief of Staff AI
## Architecture Specification v1.0

**Layer Position:** Sits ON TOP of Quantum Communications as the executive intelligence layer.
**Codename:** DCOS (Digital Chief of Staff)
**RADF Compliance:** 8.5+ minimum per AGD-X Constitution

---

## 1. SYSTEM OVERVIEW

```
+------------------------------------------------------------------+
|                    DIGITAL CHIEF OF STAFF AI                      |
|  (Executive Intelligence Layer - Decision, Delegation, Memory)    |
+------------------------------------------------------------------+
        |           |           |           |           |
        v           v           v           v           v
+----------+ +----------+ +----------+ +----------+ +----------+
| Priority | | Decision | | Delegate | | Memory   | | Briefing |
| Engine   | | Matrix   | | Router   | | Cortex   | | Engine   |
+----------+ +----------+ +----------+ +----------+ +----------+
        |           |           |           |           |
+------------------------------------------------------------------+
|                   QUANTUM COMMUNICATIONS v2                       |
|  (Unified Ingestion - Email, Slack, Teams, SMS, Voice, Webhook)   |
+------------------------------------------------------------------+
        |           |           |           |           |
        v           v           v           v           v
+----------+ +----------+ +----------+ +----------+ +----------+
| Email    | | Slack    | | Teams    | | SMS/     | | Webhook  |
| Adapter  | | Adapter  | | Adapter  | | Voice    | | Adapter  |
+----------+ +----------+ +----------+ +----------+ +----------+
        |           |           |           |           |
+------------------------------------------------------------------+
|                ROOSK NEXGEN PLATFORM (Existing)                   |
|  FastAPI + Next.js + Proxmox + PostgreSQL + Bedrock/Ollama        |
+------------------------------------------------------------------+
```

---

## 2. DIGITAL CHIEF OF STAFF — CORE MODULES

### 2.1 Priority Engine
Assigns urgency and importance scores to every inbound communication.

```
Input: Raw communication from Quantum Communications
Output: {
  priority: P0-P4,
  urgency: 0-100,
  importance: 0-100,
  category: "infrastructure" | "security" | "business" | "personal" | "compliance",
  requires_human: boolean,
  suggested_agent: string,
  deadline: ISO8601 | null
}
```

**Scoring Matrix:**
| Priority | Urgency | Importance | Response SLA | Example |
|----------|---------|------------|--------------|---------|
| P0 | 90-100 | 90-100 | < 5 min | Security breach, system down |
| P1 | 70-89 | 70-89 | < 30 min | Service degradation, compliance alert |
| P2 | 50-69 | 50-69 | < 2 hours | Client request, deployment review |
| P3 | 25-49 | 25-49 | < 8 hours | Routine maintenance, updates |
| P4 | 0-24 | 0-24 | < 24 hours | FYI, newsletters, low-priority |

### 2.2 Decision Matrix
Determines what action to take for each prioritized communication.

```python
class DecisionOutcome:
    action: "auto_respond" | "delegate_agent" | "escalate_human" | "queue" | "archive"
    agent_type: str | None        # Which specialized agent handles it
    draft_response: str | None    # AI-generated response draft
    approval_required: bool       # Does human need to approve before send?
    context_refs: list[str]       # Related memory/conversation IDs
```

**Decision Rules:**
1. P0 + security → Escalate human immediately + auto-trigger security agent
2. P0 + infrastructure → Auto-delegate to infra agent + notify human
3. P1 + business → Draft response + queue for human approval
4. P2-P3 + routine → Auto-respond using templates + log
5. P4 → Archive with summary, surface in daily briefing

### 2.3 Delegate Router
Routes decisions to the correct specialized agent from the existing agent registry.

```
Existing Agents (from agent_types.py):
  murph-generic        → General catch-all
  murph-infrastructure → VM, container, compute
  murph-security       → Alerts, compliance, access
  murph-database       → PostgreSQL, backups, replication
  murph-networking     → VLANs, VPN, DNS, firewall
  murph-daas           → Remote desktop, Guacamole
  murph-monitoring     → Prometheus, Grafana, health

New Agents for DCOS:
  murph-communications → Email/Slack/Teams routing
  murph-scheduler      → Calendar, meeting, deadline management
  murph-briefing       → Daily/weekly summary generation
```

### 2.4 Memory Cortex
Persistent, searchable memory system that gives the Chief of Staff context.

**Memory Types:**
| Type | Storage | TTL | Example |
|------|---------|-----|---------|
| Episodic | pgvector embeddings | Permanent | "Last Tuesday, client X complained about latency" |
| Semantic | Knowledge base entries | Updated weekly | "Client X prefers email over Slack" |
| Procedural | Action templates | Permanent | "When deploying, always snapshot first" |
| Working | Redis cache | 24 hours | "Currently handling 3 P1 tickets" |

**Schema:**
```sql
CREATE TABLE dcos_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_type VARCHAR(20) NOT NULL,  -- episodic, semantic, procedural, working
    content TEXT NOT NULL,
    embedding vector(1536),            -- pgvector for semantic search
    source_channel VARCHAR(50),        -- email, slack, teams, sms, webhook
    source_id VARCHAR(255),            -- original message ID
    entities JSONB,                    -- extracted people, orgs, systems
    priority VARCHAR(5),               -- P0-P4 at time of creation
    tags TEXT[],
    related_memories UUID[],           -- links to related memories
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,            -- NULL = permanent
    accessed_count INT DEFAULT 0,
    last_accessed TIMESTAMPTZ
);

CREATE INDEX idx_memory_embedding ON dcos_memory
    USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_memory_type ON dcos_memory(memory_type);
CREATE INDEX idx_memory_source ON dcos_memory(source_channel);
CREATE INDEX idx_memory_tags ON dcos_memory USING gin(tags);
```

### 2.5 Briefing Engine
Generates executive summaries at configurable intervals.

**Briefing Types:**
- **Real-time:** P0/P1 alerts → push notification
- **Hourly digest:** Active items summary (during business hours)
- **Daily briefing:** Full day summary + tomorrow's priorities
- **Weekly report:** Trends, metrics, compliance status

---

## 3. QUANTUM COMMUNICATIONS v2 — UNIFIED INGESTION

### 3.1 Communication Adapters

Each adapter normalizes inbound messages into a unified `QuantumMessage` format:

```typescript
interface QuantumMessage {
  id: string;                    // UUID
  channel: "email" | "slack" | "teams" | "sms" | "voice" | "webhook";
  direction: "inbound" | "outbound";
  sender: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
    org?: string;
  };
  recipients: Recipient[];
  subject?: string;
  body: string;                  // Plain text normalized
  body_html?: string;            // Original HTML if available
  attachments: Attachment[];
  thread_id?: string;            // Conversation threading
  in_reply_to?: string;          // Parent message ID
  metadata: Record<string, any>; // Channel-specific data
  received_at: string;           // ISO8601
  raw_payload: string;           // Original payload for audit
}
```

### 3.2 Adapter Specifications

#### Email Adapter
- **Protocol:** IMAP (poll) + SMTP (send) + SES webhook (receive)
- **AWS Service:** Amazon SES (inbound/outbound) + S3 (attachment store)
- **Features:** Thread detection, attachment extraction, spam scoring
- **Config:** Multiple mailboxes, routing rules per domain

#### Slack Adapter
- **Protocol:** Slack Events API + Web API
- **AWS Service:** API Gateway → Lambda → SQS
- **Features:** Channel monitoring, DM handling, thread replies, reactions
- **Scopes:** channels:history, chat:write, users:read, reactions:read

#### Teams Adapter
- **Protocol:** Microsoft Graph API + Change Notifications
- **AWS Service:** API Gateway → Lambda → SQS
- **Features:** Channel messages, 1:1 chats, meeting transcripts
- **Auth:** OAuth 2.0 with Microsoft Entra ID

#### SMS/Voice Adapter
- **Protocol:** Twilio Webhooks
- **AWS Service:** API Gateway → Lambda → SQS
- **Features:** Inbound/outbound SMS, call transcription, voicemail-to-text
- **Config:** Phone number routing, auto-reply rules

#### Webhook Adapter
- **Protocol:** Generic HTTPS POST
- **AWS Service:** API Gateway → Lambda → SQS
- **Features:** GitHub events, PagerDuty alerts, Stripe events, custom webhooks
- **Auth:** HMAC-SHA256 signature verification (existing webhook service)

### 3.3 Ingestion Pipeline

```
[Adapter] → [SQS Queue] → [Normalizer Lambda] → [Priority Engine]
                                    ↓
                            [DynamoDB Raw Store]
                                    ↓
                            [Embedding Lambda] → [pgvector Memory]
                                    ↓
                            [Decision Matrix] → [Delegate Router]
                                    ↓
                    [Agent Execution] → [Response Pipeline]
                                    ↓
                            [Outbound Adapter] → [Channel]
```

---

## 4. AWS ARCHITECTURE

### 4.1 Service Map

```
                         ┌─────────────────────┐
                         │   Route 53 (DNS)     │
                         └──────────┬──────────┘
                                    │
                         ┌──────────▼──────────┐
                         │  CloudFront (CDN)    │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
   ┌──────────▼──────────┐ ┌──────▼──────┐ ┌────────────▼────────────┐
   │  ALB (Next.js UI)   │ │ API Gateway │ │ API Gateway (Webhooks)  │
   │  ECS Fargate        │ │ (REST API)  │ │ (Ingestion Endpoints)   │
   └──────────┬──────────┘ └──────┬──────┘ └────────────┬────────────┘
              │                    │                      │
              │            ┌──────▼──────┐    ┌─────────▼─────────┐
              │            │ ECS Fargate  │    │   Lambda Functions │
              │            │ (FastAPI)    │    │   (Adapters +      │
              │            └──────┬──────┘    │    Normalizers)     │
              │                   │           └─────────┬─────────┘
              │                   │                     │
              │            ┌──────▼──────────────────────▼──────┐
              │            │          SQS Queues                 │
              │            │  ingest-email | ingest-slack |       │
              │            │  ingest-teams | ingest-sms  |       │
              │            │  ingest-webhook | priority-queue     │
              │            └──────────────────┬─────────────────┘
              │                               │
   ┌──────────▼───────────────────────────────▼──────────────────┐
   │                        VPC (10.0.0.0/16)                     │
   │                                                              │
   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
   │  │ RDS Aurora   │  │ ElastiCache  │  │ OpenSearch       │  │
   │  │ PostgreSQL   │  │ Redis        │  │ (Log Analytics)  │  │
   │  │ + pgvector   │  │ (Working Mem)│  │                  │  │
   │  └──────────────┘  └──────────────┘  └──────────────────┘  │
   │                                                              │
   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
   │  │ S3 Buckets   │  │ Bedrock      │  │ DynamoDB         │  │
   │  │ (Attachments,│  │ (Claude AI)  │  │ (Raw Messages,   │  │
   │  │  Backups)    │  │              │  │  Session State)  │  │
   │  └──────────────┘  └──────────────┘  └──────────────────┘  │
   │                                                              │
   │  ┌──────────────────────────────────────────────────────┐   │
   │  │  Site-to-Site VPN → Proxmox R7625 (192.168.4.58)    │   │
   │  │  (Hybrid: AWS cloud + on-prem infrastructure)        │   │
   │  └──────────────────────────────────────────────────────┘   │
   └──────────────────────────────────────────────────────────────┘
```

### 4.2 AWS Services Inventory

| Service | Purpose | Est. Monthly Cost |
|---------|---------|-------------------|
| ECS Fargate (2 tasks) | Next.js UI + FastAPI backend | ~$60 |
| RDS Aurora PostgreSQL | Primary DB + pgvector | ~$120 |
| ElastiCache Redis | Working memory, session cache | ~$40 |
| Amazon SES | Email inbound/outbound | ~$10 |
| API Gateway | REST API + webhook endpoints | ~$15 |
| Lambda (10 functions) | Adapters, normalizers, processors | ~$20 |
| SQS (6 queues) | Message ingestion pipeline | ~$5 |
| DynamoDB | Raw message store, session state | ~$25 |
| S3 (3 buckets) | Attachments, backups, static assets | ~$10 |
| Bedrock (Claude) | AI processing (existing) | ~$50-200 |
| CloudFront | CDN for UI | ~$10 |
| Route 53 | DNS management | ~$2 |
| Site-to-Site VPN | AWS ↔ Proxmox hybrid link | ~$35 |
| OpenSearch (t3.small) | Log analytics, search | ~$40 |
| Secrets Manager | API keys, tokens | ~$5 |
| CloudWatch | Monitoring, alerting | ~$15 |
| **TOTAL** | | **~$460-610/mo** |

### 4.3 Hybrid Architecture (AWS + On-Prem)

The R7625 Proxmox server remains the **infrastructure control plane**:
- VM/container management stays on-prem
- Database replicas on-prem (VM-DB-01, VM-DB-02)
- SSH terminal access stays on-prem
- AI processing uses AWS Bedrock (cloud)
- Communication ingestion runs in AWS (Lambda + SQS)
- Site-to-Site VPN connects AWS VPC to 192.168.4.0/24 network

---

## 5. PROMPT SYSTEM

### 5.1 Prompt Hierarchy

```
Level 0: CONSTITUTION (immutable)
  └── Platform identity, safety rails, compliance requirements

Level 1: CHIEF OF STAFF PERSONA (rarely changes)
  └── Executive behavior, decision-making principles, tone

Level 2: DOMAIN CONTEXT (per-request, dynamic)
  └── Relevant knowledge sections from knowledge_base.py
  └── Recent memory from Memory Cortex
  └── Current priority queue state

Level 3: CHANNEL CONTEXT (per-message)
  └── Communication channel norms (email=formal, slack=casual)
  └── Sender relationship history
  └── Thread context
```

### 5.2 System Prompts

#### Constitution Prompt (Level 0)
```
You are the Digital Chief of Staff for the Roosk NexGen Platform.
You operate under the RADF + SEBL + AGD-X governance frameworks.
Minimum quality score: 8.5/10 per AGD-X Constitution.

Core Directives:
1. NEVER fabricate information. If unsure, say so and escalate.
2. NEVER execute destructive actions without explicit human approval.
3. ALWAYS log decisions and reasoning to the audit trail.
4. ALWAYS respect communication channel norms and recipient preferences.
5. PROTECT sensitive data per existing sanitization rules.
6. ESCALATE P0/P1 issues to human immediately.
7. MAINTAIN context across conversations using Memory Cortex.
```

#### Chief of Staff Persona (Level 1)
```
You are an executive-level AI assistant operating as Chief of Staff.

Your responsibilities:
- Triage all inbound communications by priority and urgency
- Draft responses calibrated to channel and relationship context
- Delegate infrastructure/security/database tasks to specialist agents
- Maintain a living briefing document of active priorities
- Track commitments, deadlines, and follow-ups
- Provide daily executive summaries with actionable insights

Communication style:
- Email: Professional, structured, signature block
- Slack: Concise, uses threads, emoji reactions for acknowledgment
- Teams: Business-appropriate, formatted messages
- SMS: Brief, action-oriented
- Internal: Technical, precise, includes CLI commands when relevant

Decision framework:
- Can I handle this autonomously? → Handle it.
- Do I need specialist knowledge? → Delegate to appropriate agent.
- Could this have negative consequences? → Draft + queue for human approval.
- Is this urgent and critical? → Escalate immediately + take safe interim action.
```

#### Domain Context Template (Level 2)
```
Current State:
- Active P0 issues: {p0_count}
- Active P1 issues: {p1_count}
- Pending human approvals: {pending_approvals}
- Platform health: {health_status}

Relevant Memory:
{retrieved_memories}

Domain Knowledge:
{knowledge_sections}
```

#### Channel Context Template (Level 3)
```
Channel: {channel_type}
Sender: {sender_name} ({sender_email})
Relationship: {relationship_context}
Thread: {thread_summary}
Previous interactions: {interaction_count} messages, last {last_interaction_date}
Sender preferences: {preferences}
```

### 5.3 Prompt Assembly Pipeline

```python
def assemble_prompt(message: QuantumMessage, memories: list, knowledge: str) -> str:
    """
    Level 0 (Constitution)
    + Level 1 (Persona)
    + Level 2 (Domain: memories + knowledge + platform state)
    + Level 3 (Channel: sender context + thread + preferences)
    + User Message
    = Final prompt sent to Bedrock
    """
```

---

## 6. MEMORY SYSTEM

### 6.1 Memory Pipeline

```
[Inbound Message]
       │
       ▼
[Entity Extraction]  ← Bedrock: extract people, orgs, systems, dates
       │
       ▼
[Embedding Generation]  ← Bedrock Titan Embeddings v2 (1536 dims)
       │
       ▼
[Memory Classification]  ← episodic | semantic | procedural
       │
       ▼
[Deduplication Check]  ← cosine similarity > 0.95 = duplicate
       │
       ▼
[Store to pgvector]  ← PostgreSQL with vector index
       │
       ▼
[Update Working Memory]  ← Redis: active context window
```

### 6.2 Memory Retrieval

```python
async def recall(query: str, limit: int = 5) -> list[Memory]:
    """
    1. Generate embedding for query
    2. Vector similarity search in pgvector (top 20 candidates)
    3. Re-rank by recency + access frequency + priority
    4. Return top N with context
    """
```

### 6.3 Memory Decay

- Working memory: Expires after 24 hours (Redis TTL)
- Episodic memory: Importance score decays 5%/month, pruned below threshold
- Semantic memory: Refreshed weekly from accumulated episodic data
- Procedural memory: Permanent, only updated by explicit instruction

### 6.4 Memory API Endpoints

```
POST   /api/memory/store          — Store new memory
GET    /api/memory/recall?q=      — Semantic search
GET    /api/memory/thread/:id     — Get conversation thread memories
POST   /api/memory/consolidate    — Merge episodic → semantic (cron job)
DELETE /api/memory/:id            — Forget specific memory
GET    /api/memory/stats          — Memory system health metrics
```

---

## 7. NEXT.JS UI — NEW PAGES

### 7.1 New Dashboard Routes

```
/dashboard/communications       — Unified inbox (all channels)
/dashboard/communications/[id]  — Message detail + AI draft + actions
/dashboard/chief-of-staff       — DCOS command center
/dashboard/chief-of-staff/briefing  — Daily/weekly briefings
/dashboard/chief-of-staff/memory    — Memory browser + search
/dashboard/chief-of-staff/decisions — Decision log + overrides
/dashboard/chief-of-staff/settings  — Channel configs, routing rules
```

### 7.2 Component Architecture

```
src/components/
  communications/
    UnifiedInbox.tsx           — Multi-channel message list
    MessageDetail.tsx          — Full message view + AI analysis
    ComposeModal.tsx           — Send via any channel
    ChannelFilter.tsx          — Filter by email/slack/teams/sms
    ThreadView.tsx             — Conversation thread display
    PriorityBadge.tsx          — P0-P4 visual indicator
    AttachmentViewer.tsx       — Preview attachments

  chief-of-staff/
    CommandCenter.tsx          — Main DCOS dashboard
    PriorityQueue.tsx          — Live priority queue display
    BriefingCard.tsx           — Briefing summary card
    DecisionLog.tsx            — AI decisions with human override
    MemoryBrowser.tsx          — Search and browse AI memories
    AgentActivity.tsx          — Which agents are handling what
    MetricsPanel.tsx           — Communication volume + response times
    ChannelHealth.tsx          — Adapter connectivity status
```

### 7.3 Real-time Updates

```typescript
// WebSocket connection for live updates
const wsUrl = `wss://${host}/api/ws/dcos`;

// Events pushed to UI:
type DCOSEvent =
  | { type: "new_message"; message: QuantumMessage }
  | { type: "priority_change"; id: string; priority: string }
  | { type: "decision_made"; decision: Decision }
  | { type: "agent_response"; agent_id: string; response: string }
  | { type: "briefing_ready"; briefing_id: string }
  | { type: "escalation"; priority: "P0" | "P1"; summary: string };
```

---

## 8. DATABASE MIGRATIONS

### 8.1 New Tables

```sql
-- Quantum Communications: Messages
CREATE TABLE qc_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(20) NOT NULL,
    direction VARCHAR(10) NOT NULL,
    sender_id VARCHAR(255),
    sender_name VARCHAR(255),
    sender_email VARCHAR(255),
    subject TEXT,
    body TEXT NOT NULL,
    body_html TEXT,
    thread_id UUID,
    in_reply_to UUID REFERENCES qc_messages(id),
    attachments JSONB DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    raw_payload TEXT,
    received_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DCOS: Priority Assignments
CREATE TABLE dcos_priorities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES qc_messages(id),
    priority VARCHAR(5) NOT NULL,
    urgency INT NOT NULL,
    importance INT NOT NULL,
    category VARCHAR(50),
    requires_human BOOLEAN DEFAULT false,
    suggested_agent VARCHAR(50),
    deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DCOS: Decisions
CREATE TABLE dcos_decisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES qc_messages(id),
    priority_id UUID REFERENCES dcos_priorities(id),
    action VARCHAR(30) NOT NULL,
    agent_type VARCHAR(50),
    draft_response TEXT,
    approval_required BOOLEAN DEFAULT false,
    approved_by UUID,
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    outcome VARCHAR(20),
    reasoning TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DCOS: Memory (with pgvector)
CREATE TABLE dcos_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    memory_type VARCHAR(20) NOT NULL,
    content TEXT NOT NULL,
    embedding vector(1536),
    source_channel VARCHAR(50),
    source_id VARCHAR(255),
    entities JSONB DEFAULT '{}',
    priority VARCHAR(5),
    tags TEXT[] DEFAULT '{}',
    related_memories UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    accessed_count INT DEFAULT 0,
    last_accessed TIMESTAMPTZ
);

-- DCOS: Briefings
CREATE TABLE dcos_briefings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    briefing_type VARCHAR(20) NOT NULL,
    period_start TIMESTAMPTZ NOT NULL,
    period_end TIMESTAMPTZ NOT NULL,
    summary TEXT NOT NULL,
    metrics JSONB DEFAULT '{}',
    action_items JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DCOS: Channel Configurations
CREATE TABLE dcos_channel_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    channel VARCHAR(20) NOT NULL UNIQUE,
    enabled BOOLEAN DEFAULT false,
    config JSONB NOT NULL DEFAULT '{}',
    credentials_ref VARCHAR(255),  -- Secrets Manager ARN
    last_sync TIMESTAMPTZ,
    status VARCHAR(20) DEFAULT 'disconnected',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 9. NEW API ENDPOINTS

### 9.1 Communication Routes

```
GET    /api/communications/               — List all messages (paginated, filtered)
GET    /api/communications/:id            — Get message detail
POST   /api/communications/send           — Send message via any channel
GET    /api/communications/threads/:id    — Get conversation thread
GET    /api/communications/channels       — List channel statuses
POST   /api/communications/channels/:ch/test — Test channel connectivity
```

### 9.2 Chief of Staff Routes

```
GET    /api/dcos/queue                    — Current priority queue
GET    /api/dcos/decisions                — Decision log
POST   /api/dcos/decisions/:id/approve    — Approve pending decision
POST   /api/dcos/decisions/:id/override   — Override AI decision
GET    /api/dcos/briefing/latest          — Latest briefing
GET    /api/dcos/briefing/:type           — Get briefing by type
POST   /api/dcos/briefing/generate        — Force generate briefing
GET    /api/dcos/metrics                  — Communication analytics
GET    /api/dcos/health                   — DCOS system health
```

### 9.3 Memory Routes

```
POST   /api/memory/store                  — Store new memory
GET    /api/memory/recall                 — Semantic search (?q=)
GET    /api/memory/thread/:id             — Thread memories
POST   /api/memory/consolidate            — Trigger episodic→semantic merge
DELETE /api/memory/:id                    — Delete memory
GET    /api/memory/stats                  — Memory system stats
```

---

## 10. NEW AGENT TYPES

```python
# Added to agent_types.py
"communications": {
    "name": "Communications Agent",
    "description": "Communications specialist — email drafting, Slack responses, Teams messages, SMS, multi-channel routing.",
    "icon": "mail",
    "capabilities": [
        "comm.list", "comm.send", "comm.draft", "comm.thread",
        "comm.channel.status", "comm.channel.test",
    ],
    "knowledge_sections": ["roosk_api", "networking"],
    "system_prompt_addon": "You are the Communications Agent, expert in multi-channel communication management. You draft contextually appropriate messages, manage threads across channels, and ensure timely responses.",
},
"scheduler": {
    "name": "Scheduler Agent",
    "description": "Scheduling specialist — deadlines, follow-ups, SLA tracking, briefing generation.",
    "icon": "calendar",
    "capabilities": [
        "dcos.queue", "dcos.briefing", "dcos.decisions",
        "dcos.metrics", "log.audit",
    ],
    "knowledge_sections": ["roosk_api"],
    "system_prompt_addon": "You are the Scheduler Agent, expert in time management and prioritization. You track deadlines, generate briefings, and ensure SLA compliance for all communications.",
},
"chief_of_staff": {
    "name": "Chief of Staff",
    "description": "Executive AI — orchestrates all agents, makes delegation decisions, maintains organizational memory, generates briefings.",
    "icon": "crown",
    "capabilities": [
        # Has access to ALL capabilities from ALL agents
        # Plus DCOS-specific capabilities
    ],
    "knowledge_sections": [
        # Has access to ALL knowledge sections
    ],
    "system_prompt_addon": "You are the Digital Chief of Staff, the executive intelligence layer. You orchestrate all specialist agents, make priority decisions, maintain organizational memory, and ensure nothing falls through the cracks.",
},
```

---

## 11. LAMBDA FUNCTIONS (AWS)

| Function | Trigger | Purpose |
|----------|---------|---------|
| `qc-email-adapter` | SES Inbound Rule | Normalize email → QuantumMessage |
| `qc-slack-adapter` | API Gateway (Events) | Normalize Slack event → QuantumMessage |
| `qc-teams-adapter` | API Gateway (Graph) | Normalize Teams notification → QuantumMessage |
| `qc-sms-adapter` | API Gateway (Twilio) | Normalize SMS/voice → QuantumMessage |
| `qc-webhook-adapter` | API Gateway (Generic) | Normalize webhook → QuantumMessage |
| `qc-normalizer` | SQS (all queues) | Final normalization + dedup + store |
| `dcos-priority-engine` | SQS (normalized) | Score priority + route to decision |
| `dcos-embedding-gen` | SQS (store-memory) | Generate embeddings + store pgvector |
| `dcos-briefing-gen` | EventBridge (cron) | Generate scheduled briefings |
| `dcos-outbound-router` | SQS (outbound) | Route responses to correct channel |

---

## 12. IMPLEMENTATION PHASES

### Phase 1: Foundation (Week 1-2)
- Database migrations (new tables)
- Memory Cortex service + pgvector embeddings
- Priority Engine core logic
- DCOS API routes (FastAPI)
- Basic DCOS dashboard page (Next.js)

### Phase 2: Ingestion (Week 3-4)
- Email adapter (SES)
- Slack adapter (Events API)
- SQS queue infrastructure
- Normalizer Lambda
- Unified Inbox UI

### Phase 3: Intelligence (Week 5-6)
- Decision Matrix logic
- Delegate Router integration with existing agents
- Draft response generation
- Human approval workflow
- Briefing Engine

### Phase 4: Full Channel Support (Week 7-8)
- Teams adapter
- SMS/Voice adapter (Twilio)
- Webhook adapter (extend existing)
- Outbound routing for all channels
- Channel health monitoring UI

### Phase 5: Polish + Hardening (Week 9-10)
- Memory decay + consolidation cron
- Advanced briefing templates
- Response time analytics
- Load testing
- Security audit
- RADF/SEBL scoring
