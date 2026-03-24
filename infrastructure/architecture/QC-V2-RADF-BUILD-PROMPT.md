# Quantum Communications v2 Engineering RADF Build
## Next Prompt Specification

Copy and paste the following prompt to initiate the full engineering build:

---

## PROMPT: Quantum Communications v2 Engineering RADF Build

You are building **Quantum Communications v2** with the **Digital Chief of Staff AI** layer for the Roosk NexGen Platform. The architecture spec is at `infrastructure/architecture/DIGITAL-CHIEF-OF-STAFF.md`. The existing codebase has:

- **Frontend:** Next.js 14 App Router in `app/` with Tailwind + Framer Motion
- **Backend:** FastAPI in `api-server/` with 28 AI-executable actions, 7 agent types, LLM proxy (Bedrock + Ollama), knowledge base, webhook delivery, Proxmox integration
- **Database:** PostgreSQL + pgvector via Alembic async migrations
- **Infrastructure:** Proxmox on Dell R7625, Docker Compose deployment

Build the following in order, following RADF governance (8.5+ minimum AGD-X score):

### 1. AWS INFRASTRUCTURE (CDK or CloudFormation)

Create `infrastructure/aws/` with:
- `cdk.json` + `app.py` (CDK entry point)
- `stacks/networking.py` — VPC, subnets, security groups, Site-to-Site VPN to 192.168.4.0/24
- `stacks/compute.py` — ECS Fargate for Next.js + FastAPI, ALB, CloudFront
- `stacks/data.py` — RDS Aurora PostgreSQL (pgvector), ElastiCache Redis, DynamoDB, S3 buckets
- `stacks/ingestion.py` — API Gateway endpoints, SQS queues (6), Lambda functions (10)
- `stacks/messaging.py` — SES configuration, SNS topics for alerts
- `stacks/monitoring.py` — CloudWatch dashboards, alarms, OpenSearch

### 2. NEXT.JS UI — New Dashboard Pages

Add these routes to `app/dashboard/`:
- `communications/page.tsx` — Unified Inbox: multi-channel message list with ChannelFilter, PriorityBadge, real-time WebSocket updates
- `communications/[id]/page.tsx` — Message detail: full message + AI analysis + priority score + draft response + approve/override actions
- `chief-of-staff/page.tsx` — DCOS Command Center: PriorityQueue, AgentActivity, MetricsPanel, ChannelHealth
- `chief-of-staff/briefing/page.tsx` — Daily/weekly briefings with BriefingCard components
- `chief-of-staff/memory/page.tsx` — MemoryBrowser: semantic search, memory timeline, entity graph
- `chief-of-staff/decisions/page.tsx` — DecisionLog: AI decisions with human override capability
- `chief-of-staff/settings/page.tsx` — Channel configurations, routing rules, adapter credentials

Add components to `src/components/`:
- `communications/` — UnifiedInbox, MessageDetail, ComposeModal, ChannelFilter, ThreadView, PriorityBadge, AttachmentViewer
- `chief-of-staff/` — CommandCenter, PriorityQueue, BriefingCard, DecisionLog, MemoryBrowser, AgentActivity, MetricsPanel, ChannelHealth

Follow existing patterns:
- `'use client'` on all interactive components
- Glass-card design system from globals.css
- `nexgen-*` design tokens from Tailwind config
- Framer Motion animations (motion.tsx variants + PageTransition)
- Loading skeletons (`loading.tsx`) for each route
- Mobile-responsive with DashboardSidebar pattern

### 3. PROMPT SYSTEM

Create `api-server/app/services/prompt_system.py`:
- 4-level prompt hierarchy: Constitution → Persona → Domain Context → Channel Context
- `assemble_prompt(message, memories, knowledge, platform_state)` function
- Constitution prompt (immutable safety rails + RADF compliance)
- Chief of Staff persona (decision framework, communication style per channel)
- Domain context template (active P0/P1 count, retrieved memories, knowledge sections)
- Channel context template (sender history, thread summary, preferences)
- Token budget management: max 4000 tokens for context, 4096 for response

Create `api-server/app/services/priority_engine.py`:
- `score_priority(message: QuantumMessage) -> PriorityAssignment`
- P0-P4 scoring matrix using urgency (0-100) + importance (0-100)
- Category detection: infrastructure, security, business, personal, compliance
- Deadline extraction from message body
- Suggested agent routing based on category

Create `api-server/app/services/decision_matrix.py`:
- `decide(message, priority, memories) -> DecisionOutcome`
- Actions: auto_respond, delegate_agent, escalate_human, queue, archive
- Rules engine: P0+security→escalate, P1+business→draft+approve, P2-P3→auto, P4→archive
- Draft response generation via Bedrock
- Human approval workflow integration

### 4. MEMORY SYSTEM

Create `api-server/app/services/memory_cortex.py`:
- Memory types: episodic, semantic, procedural, working
- `store(content, memory_type, source, entities, tags)` — generate embedding + store pgvector
- `recall(query, limit=5)` — vector similarity search + re-rank by recency/frequency/priority
- `consolidate()` — merge episodic → semantic (weekly cron)
- `decay()` — reduce importance scores over time, prune below threshold
- Entity extraction via Bedrock (people, orgs, systems, dates)
- Embedding generation via Bedrock Titan Embeddings v2 (1536 dimensions)
- Redis integration for working memory (24h TTL)
- Deduplication: cosine similarity > 0.95 = skip

Create Alembic migration for new tables:
- `qc_messages` — all inbound/outbound communications
- `dcos_priorities` — priority assignments per message
- `dcos_decisions` — decision log with approval workflow
- `dcos_memory` — pgvector-enabled memory store
- `dcos_briefings` — generated briefings
- `dcos_channel_configs` — channel adapter configurations

### 5. COMMUNICATION INGESTION PIPELINES

Create `api-server/app/services/adapters/`:
- `base.py` — `QuantumMessage` dataclass, `BaseAdapter` abstract class
- `email_adapter.py` — SES inbound webhook → QuantumMessage normalization
- `slack_adapter.py` — Slack Events API → QuantumMessage normalization
- `teams_adapter.py` — Microsoft Graph → QuantumMessage normalization
- `sms_adapter.py` — Twilio webhook → QuantumMessage normalization
- `webhook_adapter.py` — Generic HMAC-verified webhook → QuantumMessage normalization

Create `api-server/app/services/ingestion_pipeline.py`:
- `ingest(raw_payload, channel) -> QuantumMessage` — normalize + store
- `process(message: QuantumMessage)` — priority → decision → delegate → respond
- Outbound routing: send responses back through the correct channel adapter
- Thread detection and conversation linking
- Attachment extraction and S3 storage

Create FastAPI routes:
- `api-server/app/api/routes/communications.py` — CRUD for messages, threads, channels
- `api-server/app/api/routes/dcos.py` — Priority queue, decisions, briefings, metrics
- `api-server/app/api/routes/memory.py` — Store, recall, consolidate, stats

Add 3 new agent types to `agent_types.py`:
- `communications` — Email/Slack/Teams routing specialist
- `scheduler` — Deadlines, follow-ups, SLA tracking
- `chief_of_staff` — Executive orchestrator with full capability access

### VERIFICATION REQUIREMENTS

After completing all sections:
1. `npm run build` — zero errors
2. All new Python files pass `python -m py_compile`
3. All imports resolve to real exports
4. All new API routes are registered in `main.py`
5. Alembic migration generates and applies cleanly
6. New dashboard routes render with loading skeletons
7. WebSocket endpoint for real-time DCOS events exists
8. No TODO, FIXME, STUB, or mock data in shipped code

Provide a full TASK COMPLETION REPORT per the Anti-Laziness Constitution.

---

## NOTES FOR THE BUILD AGENT

- The existing `llm_proxy.py` handles Bedrock + Ollama — reuse it for all AI calls
- The existing `ai_actions.py` has the action execution pattern — extend it for new DCOS actions
- The existing `knowledge_base.py` has keyword-scored retrieval — the Memory Cortex replaces this for DCOS with vector search
- The existing `webhooks.py` has HMAC signing — reuse the pattern for all adapter authentication
- The existing `agent_types.py` registry pattern is how new agents should be added
- Tailwind config already has `nexgen-*` tokens — use them for all new UI components
- The glass-card CSS pattern in `globals.css` should be used for all new cards/panels
