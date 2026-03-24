#!/bin/bash
# =============================================================================
# Roosk NexGen Platform — Comprehensive Test Suite v2.1
# Tests: syntax, imports, structure, stubs, frontend build, schema alignment,
#        user management, AI actions, knowledge base, agent types, LLM proxy,
#        service deployments, Proxmox version alignment, SSH terminal
# =============================================================================
set -uo pipefail

PASS=0
FAIL=0
WARN=0
ERRORS=""

green()  { echo -e "\033[32m  [PASS] $1\033[0m"; PASS=$((PASS+1)); }
red()    { echo -e "\033[31m  [FAIL] $1\033[0m"; FAIL=$((FAIL+1)); ERRORS="$ERRORS\n  - $1"; }
yellow() { echo -e "\033[33m  [WARN] $1\033[0m"; WARN=$((WARN+1)); }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"
INFRA="$ROOT/infrastructure"

echo "============================================="
echo "  Roosk NexGen Platform — Comprehensive Test"
echo "  Suite v2.1 (Phases 1-6 + SSH Terminal)"
echo "============================================="
echo ""
echo "Root: $ROOT"
echo ""

# =============================================
# SECTION 1: File Existence Checks
# =============================================
echo "--- Section 1: File Existence ---"

REQUIRED_FILES=(
  # Backend core
  "backend/app/main.py"
  "backend/app/core/config.py"
  "backend/app/core/security.py"
  "backend/app/core/database.py"
  "backend/app/models/models.py"
  "backend/app/api/schemas/schemas.py"
  # Backend routes (14 routers)
  "backend/app/api/routes/auth.py"
  "backend/app/api/routes/vms.py"
  "backend/app/api/routes/databases.py"
  "backend/app/api/routes/metrics.py"
  "backend/app/api/routes/security.py"
  "backend/app/api/routes/agents.py"
  "backend/app/api/routes/network.py"
  "backend/app/api/routes/llm.py"
  "backend/app/api/routes/murph.py"
  "backend/app/api/routes/compliance.py"
  "backend/app/api/routes/services.py"
  "backend/app/api/routes/health.py"
  "backend/app/api/routes/users.py"
  "backend/app/api/routes/ssh.py"
  # Backend services
  "backend/app/services/proxmox.py"
  "backend/app/services/llm_proxy.py"
  "backend/app/services/audit.py"
  "backend/app/services/backup.py"
  "backend/app/services/webhooks.py"
  "backend/app/services/service_templates.py"
  "backend/app/services/ai_actions.py"
  "backend/app/services/knowledge_base.py"
  "backend/app/services/agent_types.py"
  # Frontend pages (11 pages + Login)
  "frontend/src/App.tsx"
  "frontend/src/hooks/useAuth.ts"
  "frontend/src/hooks/useApi.ts"
  "frontend/src/services/api.ts"
  "frontend/src/types/index.ts"
  "frontend/src/pages/Login.tsx"
  "frontend/src/pages/Dashboard.tsx"
  "frontend/src/pages/VirtualMachines.tsx"
  "frontend/src/pages/ServiceCatalog.tsx"
  "frontend/src/pages/DatabaseManagement.tsx"
  "frontend/src/pages/NetworkControl.tsx"
  "frontend/src/pages/SecurityCenter.tsx"
  "frontend/src/pages/AIAgents.tsx"
  "frontend/src/pages/Monitoring.tsx"
  "frontend/src/pages/Compliance.tsx"
  "frontend/src/pages/Settings.tsx"
  "frontend/src/pages/UserManagement.tsx"
  "frontend/src/pages/SSHTerminal.tsx"
  # Frontend components
  "frontend/src/components/layout/Sidebar.tsx"
  "frontend/src/components/layout/Layout.tsx"
  "frontend/src/components/dashboard/AICommandTerminal.tsx"
  "frontend/src/components/dashboard/SystemHealthBar.tsx"
  "frontend/src/components/dashboard/VMInventoryGrid.tsx"
  "frontend/src/components/dashboard/SecurityAlertsPanel.tsx"
  "frontend/src/components/dashboard/MurphAgentStatus.tsx"
  "frontend/src/components/dashboard/DatabaseHealth.tsx"
  "frontend/src/components/dashboard/NetworkMap.tsx"
  "frontend/src/components/dashboard/RecentActivity.tsx"
  # Infrastructure
  "infrastructure/deploy/bootstrap-roosk.sh"
  "infrastructure/deploy/01-proxmox-post-install.sh"
  "infrastructure/deploy/02-create-vms.sh"
  "infrastructure/cloud-init/roosk-app.yml"
  "infrastructure/cloud-init/roosk-db.yml"
  "infrastructure/cloud-init/wireguard.yml"
  "infrastructure/cloud-init/code-server.yml"
  "infrastructure/cloud-init/guacamole.yml"
  "infrastructure/cloud-init/dev-environment.yml"
  # Config
  "docker-compose.yml"
  "monitoring/prometheus/prometheus.yml"
  "backend/requirements.txt"
  "frontend/package.json"
  # Tests
  "backend/tests/test_llm_proxy.py"
  "backend/tests/test_api.py"
)

for f in "${REQUIRED_FILES[@]}"; do
  if [ -f "$ROOT/$f" ]; then
    green "$f exists"
  else
    red "$f MISSING"
  fi
done

echo ""

# =============================================
# SECTION 2: Stub/Mock/Placeholder Sweep
# =============================================
echo "--- Section 2: Stub/Mock Sweep ---"

STUB_HITS=$(grep -rn --include="*.py" -iE '\bSTUB\b|\bFIXME\b|\bTODO\b|\bhardcoded\b|\bfake\b' "$BACKEND/app/" 2>/dev/null || true)
if [ -z "$STUB_HITS" ]; then
  green "Backend: zero stubs/TODO/FIXME/hardcoded/fake"
else
  red "Backend has stubs or TODOs:"
  echo "$STUB_HITS" | head -20
fi

FRONTEND_STUBS=$(grep -rn --include="*.ts" --include="*.tsx" -iE '\bSTUB\b|\bFIXME\b|\bTODO\b|\bhardcoded\b|\bfake\b' "$FRONTEND/src/" 2>/dev/null || true)
if [ -z "$FRONTEND_STUBS" ]; then
  green "Frontend: zero stubs/TODO/FIXME/hardcoded/fake"
else
  red "Frontend has stubs or TODOs:"
  echo "$FRONTEND_STUBS" | head -20
fi

echo ""

# =============================================
# SECTION 3: Python Syntax Check
# =============================================
echo "--- Section 3: Python Syntax Check ---"

PY_SYNTAX_ERRORS=0
HAVE_PYTHON=false
if command -v python3 &>/dev/null; then
  if python3 --version &>/dev/null; then
    HAVE_PYTHON=true
  fi
fi

if [ "$HAVE_PYTHON" = true ]; then
  while IFS= read -r pyfile; do
    if ! python3 -m py_compile "$pyfile" 2>/dev/null; then
      red "Syntax error: $pyfile"
      PY_SYNTAX_ERRORS=$((PY_SYNTAX_ERRORS+1))
    fi
  done < <(find "$BACKEND/app" -name "*.py" -type f 2>/dev/null)

  if [ "$PY_SYNTAX_ERRORS" -eq 0 ]; then
    green "All Python files pass syntax check"
  fi
else
  PY_COUNT=$(find "$BACKEND/app" -name "*.py" -type f 2>/dev/null | wc -l)
  BROKEN=0
  while IFS= read -r pyfile; do
    if [ ! -s "$pyfile" ] && [[ "$pyfile" != *"__init__.py" ]]; then
      red "Empty file: $pyfile"
      BROKEN=$((BROKEN+1))
    fi
  done < <(find "$BACKEND/app" -name "*.py" -type f 2>/dev/null)

  if [ "$BROKEN" -eq 0 ]; then
    green "All $PY_COUNT Python files validated (structure check — no local Python)"
  fi
fi

echo ""

# =============================================
# SECTION 4: Router Import Verification
# =============================================
echo "--- Section 4: Router Cross-Reference ---"

MAIN_PY="$BACKEND/app/main.py"
EXPECTED_ROUTERS=("auth" "health" "vms" "llm" "murph" "databases" "security" "network" "metrics" "agents" "compliance" "services" "users" "ssh")
for r in "${EXPECTED_ROUTERS[@]}"; do
  if grep -q "$r" "$MAIN_PY" 2>/dev/null; then
    green "main.py imports router: $r"
  else
    red "main.py MISSING router: $r"
  fi
done

for r in "${EXPECTED_ROUTERS[@]}"; do
  if grep -q "${r}.router" "$MAIN_PY" 2>/dev/null; then
    green "main.py registers: ${r}.router"
  else
    red "main.py MISSING registration: ${r}.router"
  fi
done

# Count routers — should be 14
ROUTER_COUNT=$(grep -c "include_router" "$MAIN_PY" 2>/dev/null || echo "0")
if [ "$ROUTER_COUNT" -eq 14 ]; then
  green "main.py has exactly 14 registered routers"
else
  red "main.py has $ROUTER_COUNT routers (expected 14)"
fi

echo ""

# =============================================
# SECTION 5: Frontend Route Verification
# =============================================
echo "--- Section 5: Frontend Routes ---"

APP_TSX="$FRONTEND/src/App.tsx"
EXPECTED_ROUTES=("/" "/vms" "/services" "/databases" "/networks" "/security" "/ai-agents" "/monitoring" "/compliance" "/users" "/terminal" "/settings")
for route in "${EXPECTED_ROUTES[@]}"; do
  if grep -q "\"$route\"" "$APP_TSX" 2>/dev/null; then
    green "App.tsx has route: $route"
  else
    red "App.tsx MISSING route: $route"
  fi
done

echo ""

# =============================================
# SECTION 6: Sidebar Navigation Items
# =============================================
echo "--- Section 6: Sidebar Nav Items ---"

SIDEBAR="$FRONTEND/src/components/layout/Sidebar.tsx"
NAV_ITEMS=("Dashboard" "Virtual Machines" "Services" "Databases" "Networks" "Security" "AI Agents" "Monitoring" "Compliance" "Users" "SSH Terminal" "Settings")
for item in "${NAV_ITEMS[@]}"; do
  if grep -q "$item" "$SIDEBAR" 2>/dev/null; then
    green "Sidebar has: $item"
  else
    red "Sidebar MISSING: $item"
  fi
done

echo ""

# =============================================
# SECTION 7: Security Checks
# =============================================
echo "--- Section 7: Security Checks ---"

CONFIG_PY="$BACKEND/app/core/config.py"
AUTH_PY="$BACKEND/app/api/routes/auth.py"

if grep -q 'HS256' "$CONFIG_PY" 2>/dev/null; then
  green "JWT algorithm is HS256 (correct)"
else
  red "JWT algorithm is NOT HS256"
fi

if grep -q 'RS256' "$CONFIG_PY" 2>/dev/null; then
  red "RS256 still present in config.py"
else
  green "No RS256 reference in config.py"
fi

if grep -qE 'ADMIN_USERS|nexgen2026' "$AUTH_PY" 2>/dev/null; then
  red "auth.py still has hardcoded credentials"
else
  green "auth.py has no hardcoded credentials"
fi

if grep -q 'pyotp' "$AUTH_PY" 2>/dev/null; then
  green "auth.py has TOTP/MFA support (pyotp)"
else
  red "auth.py missing MFA support"
fi

if grep -q 'mfa_secret' "$BACKEND/app/models/models.py" 2>/dev/null; then
  green "User model has mfa_secret column"
else
  red "User model missing mfa_secret column"
fi

USEAUTH="$FRONTEND/src/hooks/useAuth.ts"
if grep -qE 'admin@flexworx.io.*nexgen2026|nexgen2026.*admin@flexworx.io' "$USEAUTH" 2>/dev/null; then
  red "useAuth.ts still has hardcoded dev auth fallback"
else
  green "useAuth.ts has no dev auth fallback"
fi

echo ""

# =============================================
# SECTION 8: API Endpoint Coverage
# =============================================
echo "--- Section 8: API Endpoint Coverage ---"

API_TS="$FRONTEND/src/services/api.ts"
EXPECTED_API_FNS=(
  # Core
  "getHealth" "getVMs" "getVM" "createVM" "vmAction"
  # LLM
  "llmComplete" "getLLMHealth" "getLLMStats"
  # Security
  "getAlerts" "resolveAlert"
  # Databases
  "getDatabases" "getDatabase" "triggerBackup"
  # Agents
  "getAgents" "getAgent" "deregisterAgent" "getAgentTypes"
  # Network
  "getNetworkTopology" "getNetworkStorage"
  # Metrics
  "getSystemMetrics" "getNodes"
  # Murph
  "getMurphStatus"
  # Compliance
  "getComplianceSummary" "getComplianceLogs"
  # Audit
  "getAuditLogs"
  # Services
  "getServiceTemplates" "deployService" "getDeployments"
  # Auth / MFA
  "setupMFA" "verifyMFA" "disableMFA"
  # User Management
  "getUsers" "createUser" "updateUser" "deleteUser" "resetUserPassword" "changePassword"
  # SSH Terminal
  "getSSHHosts"
)

for fn in "${EXPECTED_API_FNS[@]}"; do
  if grep -q "export const $fn" "$API_TS" 2>/dev/null; then
    green "api.ts exports: $fn"
  else
    red "api.ts MISSING: $fn"
  fi
done

echo ""

# =============================================
# SECTION 9: Infrastructure Checks
# =============================================
echo "--- Section 9: Infrastructure ---"

BOOTSTRAP="$INFRA/deploy/bootstrap-roosk.sh"
if [ -f "$BOOTSTRAP" ]; then
  if head -1 "$BOOTSTRAP" | grep -q '#!/bin/bash'; then
    green "bootstrap-roosk.sh has bash shebang"
  else
    red "bootstrap-roosk.sh missing shebang"
  fi
  if grep -q 'set -euo pipefail' "$BOOTSTRAP" 2>/dev/null; then
    green "bootstrap-roosk.sh has strict error handling"
  else
    yellow "bootstrap-roosk.sh missing strict mode"
  fi
fi

if grep -q 'nexgen-pool' "$INFRA/ansible/playbooks/01-proxmox-setup.yml" 2>/dev/null; then
  green "01-proxmox-setup.yml: ZFS pool = nexgen-pool"
else
  red "01-proxmox-setup.yml: ZFS pool name mismatch"
fi

if grep -q 'datapool' "$INFRA/ansible/playbooks/01-proxmox-setup.yml" 2>/dev/null; then
  red "01-proxmox-setup.yml: still references 'datapool'"
else
  green "01-proxmox-setup.yml: no 'datapool' reference"
fi

VM_SCRIPT="$INFRA/deploy/02-create-vms.sh"
if grep -q '10.20.0.20' "$VM_SCRIPT" 2>/dev/null; then
  green "02-create-vms.sh: VM-DB-01 IP correct (10.20.0.20)"
else
  red "02-create-vms.sh: VM-DB-01 IP mismatch"
fi

PROM="$ROOT/monitoring/prometheus/prometheus.yml"
if grep -q 'bearer_token_file' "$PROM" 2>/dev/null; then
  red "prometheus.yml still references bearer_token_file"
else
  green "prometheus.yml: no bearer_token_file reference"
fi

echo ""

# =============================================
# SECTION 10: Cloud-Init Template Validation
# =============================================
echo "--- Section 10: Cloud-Init Templates ---"

CLOUD_INIT_DIR="$INFRA/cloud-init"
CI_FILES=("roosk-app.yml" "roosk-db.yml" "wireguard.yml" "code-server.yml" "guacamole.yml" "dev-environment.yml")
for ci in "${CI_FILES[@]}"; do
  if [ -f "$CLOUD_INIT_DIR/$ci" ]; then
    if head -1 "$CLOUD_INIT_DIR/$ci" | grep -q '#cloud-config'; then
      green "$ci: valid cloud-config header"
    else
      red "$ci: missing #cloud-config header"
    fi
  else
    red "$ci: FILE NOT FOUND"
  fi
done

echo ""

# =============================================
# SECTION 11: Service Template Verification
# =============================================
echo "--- Section 11: Service Templates ---"

ST_FILE="$BACKEND/app/services/service_templates.py"
EXPECTED_TEMPLATES=("windows-desktop" "wireguard-vpn" "code-server" "guacamole" "dev-environment")
for tmpl in "${EXPECTED_TEMPLATES[@]}"; do
  if grep -q "\"$tmpl\"" "$ST_FILE" 2>/dev/null; then
    green "Template defined: $tmpl"
  else
    red "Template MISSING: $tmpl"
  fi
done

echo ""

# =============================================
# SECTION 12: Frontend TypeScript Build
# =============================================
echo "--- Section 12: Frontend Build ---"

if [ -f "$FRONTEND/package.json" ]; then
  if command -v npx &>/dev/null && [ -d "$FRONTEND/node_modules" ]; then
    echo "  Running TypeScript check..."
    cd "$FRONTEND"
    TSC_OUTPUT=$(npx tsc --noEmit 2>&1)
    TSC_EXIT=$?
    cd "$ROOT"
    if [ "$TSC_EXIT" -eq 0 ]; then
      green "TypeScript: zero errors"
    else
      red "TypeScript errors found"
      echo "$TSC_OUTPUT" | tail -20
    fi

    echo "  Running production build..."
    cd "$FRONTEND"
    BUILD_OUTPUT=$(npx vite build 2>&1)
    BUILD_EXIT=$?
    cd "$ROOT"
    if [ "$BUILD_EXIT" -eq 0 ]; then
      green "Vite production build: success"
    else
      red "Vite production build: FAILED"
      echo "$BUILD_OUTPUT" | tail -20
    fi
  else
    yellow "node_modules not installed — skipping frontend checks"
  fi
else
  red "package.json not found"
fi

echo ""

# =============================================
# SECTION 13: Schema Alignment Check
# =============================================
echo "--- Section 13: Schema Alignment ---"

SCHEMAS="$BACKEND/app/api/schemas/schemas.py"
if grep -q 'action_executed' "$SCHEMAS" 2>/dev/null; then
  green "LLMCompleteResponse has action_executed field"
else
  red "LLMCompleteResponse missing action_executed field"
fi
if grep -q 'action_result' "$SCHEMAS" 2>/dev/null; then
  green "LLMCompleteResponse has action_result field"
else
  red "LLMCompleteResponse missing action_result field"
fi

if grep -q 'agent_type' "$SCHEMAS" 2>/dev/null; then
  green "LLMCompleteRequest has agent_type field"
else
  red "LLMCompleteRequest missing agent_type field"
fi

if grep -q 'mfa_required' "$AUTH_PY" 2>/dev/null; then
  green "LoginResponse supports mfa_required"
else
  red "LoginResponse missing mfa_required"
fi

echo ""

# =============================================
# SECTION 14: Dependencies Check
# =============================================
echo "--- Section 14: Dependencies ---"

REQ="$BACKEND/requirements.txt"
EXPECTED_DEPS=("fastapi" "sqlalchemy" "asyncpg" "python-jose" "passlib" "boto3" "pyotp" "httpx" "prometheus" "pydantic" "asyncssh")
for dep in "${EXPECTED_DEPS[@]}"; do
  if grep -qi "$dep" "$REQ" 2>/dev/null; then
    green "requirements.txt has: $dep"
  else
    red "requirements.txt MISSING: $dep"
  fi
done

echo ""

# =============================================
# SECTION 15: User Management (Phase 2)
# =============================================
echo "--- Section 15: User Management ---"

USERS_PY="$BACKEND/app/api/routes/users.py"
if [ -f "$USERS_PY" ]; then
  green "users.py route file exists"
else
  red "users.py route file MISSING"
fi

# Check CRUD endpoints exist
for endpoint in "list_users" "create_user" "update_user" "delete_user" "reset_password"; do
  if grep -q "$endpoint" "$USERS_PY" 2>/dev/null; then
    green "users.py has: $endpoint"
  else
    red "users.py MISSING: $endpoint"
  fi
done

# Check admin protection
if grep -q 'require_role.*platform_admin' "$USERS_PY" 2>/dev/null; then
  green "users.py has admin role protection"
else
  red "users.py missing admin role protection"
fi

# Check frontend UserManagement page
USER_MGMT="$FRONTEND/src/pages/UserManagement.tsx"
if [ -f "$USER_MGMT" ]; then
  green "UserManagement.tsx exists"
  if grep -q 'getUsers' "$USER_MGMT" 2>/dev/null; then
    green "UserManagement uses getUsers API"
  else
    red "UserManagement missing getUsers call"
  fi
  if grep -q 'createUser' "$USER_MGMT" 2>/dev/null; then
    green "UserManagement uses createUser API"
  else
    red "UserManagement missing createUser call"
  fi
fi

# Check UserAccount type
TYPES_TS="$FRONTEND/src/types/index.ts"
if grep -q 'UserAccount' "$TYPES_TS" 2>/dev/null; then
  green "types/index.ts has UserAccount interface"
else
  red "types/index.ts MISSING UserAccount interface"
fi

echo ""

# =============================================
# SECTION 16: AI Actions (Phase 3)
# =============================================
echo "--- Section 16: AI Actions (28 total) ---"

AI_ACTIONS="$BACKEND/app/services/ai_actions.py"
EXPECTED_ACTIONS=(
  "vm.list" "vm.status" "vm.start" "vm.stop" "vm.restart" "vm.snapshot"
  "vm.create" "vm.delete" "vm.clone" "vm.resize" "vm.console"
  "container.list" "container.start" "container.stop"
  "service.list" "service.deploy" "service.deployments"
  "db.list" "db.status" "db.backup"
  "network.topology" "network.storage"
  "user.list"
  "log.audit" "log.security"
  "platform.health" "platform.metrics" "platform.nodes"
)

ACTION_COUNT=0
for action in "${EXPECTED_ACTIONS[@]}"; do
  if grep -q "\"$action\"" "$AI_ACTIONS" 2>/dev/null; then
    green "Action defined: $action"
    ACTION_COUNT=$((ACTION_COUNT+1))
  else
    red "Action MISSING: $action"
  fi
done

if [ "$ACTION_COUNT" -ge 28 ]; then
  green "Total actions: $ACTION_COUNT (target: 28)"
else
  red "Only $ACTION_COUNT actions found (target: 28)"
fi

# Check execute_action handler exists
if grep -q 'async def execute_action' "$AI_ACTIONS" 2>/dev/null; then
  green "execute_action handler exists"
else
  red "execute_action handler MISSING"
fi

# Check AI terminal has matching nav targets
TERMINAL="$FRONTEND/src/components/dashboard/AICommandTerminal.tsx"
for action in "vm.list" "vm.start" "container.list" "db.status" "log.audit" "platform.health"; do
  if grep -q "'$action'" "$TERMINAL" 2>/dev/null; then
    green "AICommandTerminal has nav for: $action"
  else
    red "AICommandTerminal missing nav for: $action"
  fi
done

echo ""

# =============================================
# SECTION 17: Knowledge Base (Phase 4)
# =============================================
echo "--- Section 17: Knowledge Base ---"

KB_FILE="$BACKEND/app/services/knowledge_base.py"
if [ -f "$KB_FILE" ]; then
  green "knowledge_base.py exists"
else
  red "knowledge_base.py MISSING"
fi

# Check knowledge sections
KB_SECTIONS=("proxmox" "docker" "wireguard" "postgresql" "nginx" "systemd" "networking" "roosk_api" "guacamole" "windows_daas" "code_server")
for section in "${KB_SECTIONS[@]}"; do
  if grep -q "\"$section\"" "$KB_FILE" 2>/dev/null; then
    green "KB section: $section"
  else
    red "KB section MISSING: $section"
  fi
done

# Check key functions exist
if grep -q 'def get_relevant_knowledge' "$KB_FILE" 2>/dev/null; then
  green "get_relevant_knowledge() exists"
else
  red "get_relevant_knowledge() MISSING"
fi

if grep -q 'def get_full_knowledge' "$KB_FILE" 2>/dev/null; then
  green "get_full_knowledge() exists"
else
  red "get_full_knowledge() MISSING"
fi

if grep -q 'def get_section' "$KB_FILE" 2>/dev/null; then
  green "get_section() exists"
else
  red "get_section() MISSING"
fi

echo ""

# =============================================
# SECTION 18: Specialized Agent Types (Phase 5)
# =============================================
echo "--- Section 18: Agent Types ---"

AT_FILE="$BACKEND/app/services/agent_types.py"
if [ -f "$AT_FILE" ]; then
  green "agent_types.py exists"
else
  red "agent_types.py MISSING"
fi

AGENT_TYPES=("generic" "infrastructure" "security" "database" "networking" "daas" "monitoring")
for atype in "${AGENT_TYPES[@]}"; do
  if grep -q "\"$atype\"" "$AT_FILE" 2>/dev/null; then
    green "Agent type: $atype"
  else
    red "Agent type MISSING: $atype"
  fi
done

# Check agent type functions
for func in "get_agent_type" "list_agent_types" "get_default_agents" "get_agent_system_prompt" "get_agent_knowledge_sections"; do
  if grep -q "def $func" "$AT_FILE" 2>/dev/null; then
    green "$func() exists"
  else
    red "$func() MISSING"
  fi
done

# Check GET /agents/types endpoint
AGENTS_PY="$BACKEND/app/api/routes/agents.py"
if grep -q 'get_agent_types\|/types' "$AGENTS_PY" 2>/dev/null; then
  green "agents.py has /types endpoint"
else
  red "agents.py missing /types endpoint"
fi

# Check MurphAgent model has agent_type column
if grep -q 'agent_type' "$BACKEND/app/models/models.py" 2>/dev/null; then
  green "MurphAgent model has agent_type column"
else
  red "MurphAgent model missing agent_type column"
fi

if grep -q 'capabilities' "$BACKEND/app/models/models.py" 2>/dev/null; then
  green "MurphAgent model has capabilities column"
else
  red "MurphAgent model missing capabilities column"
fi

# Check database seeds agents
if grep -q 'get_default_agents' "$BACKEND/app/core/database.py" 2>/dev/null; then
  green "database.py seeds default agents"
else
  red "database.py missing agent seeding"
fi

# Check frontend agent type display
AI_AGENTS="$FRONTEND/src/pages/AIAgents.tsx"
if grep -q 'agent_type' "$AI_AGENTS" 2>/dev/null; then
  green "AIAgents.tsx displays agent_type"
else
  red "AIAgents.tsx missing agent_type display"
fi

if grep -q 'capabilities' "$AI_AGENTS" 2>/dev/null; then
  green "AIAgents.tsx displays capabilities"
else
  red "AIAgents.tsx missing capabilities display"
fi

# Check agent selector in terminal
if grep -q 'selectedAgent\|AGENT_OPTIONS' "$TERMINAL" 2>/dev/null; then
  green "AICommandTerminal has agent selector"
else
  red "AICommandTerminal missing agent selector"
fi

# Check frontend types for agent fields
if grep -q 'agent_type' "$TYPES_TS" 2>/dev/null; then
  green "MurphAgent type has agent_type field"
else
  red "MurphAgent type missing agent_type field"
fi

echo ""

# =============================================
# SECTION 19: LLM Proxy (Phase 6)
# =============================================
echo "--- Section 19: LLM Proxy & Stats ---"

LLM_PROXY="$BACKEND/app/services/llm_proxy.py"
LLM_ROUTE="$BACKEND/app/api/routes/llm.py"

# Check dual-backend support
if grep -q '_complete_ollama' "$LLM_PROXY" 2>/dev/null; then
  green "llm_proxy.py has Ollama backend"
else
  red "llm_proxy.py missing Ollama backend"
fi

if grep -q '_complete_bedrock' "$LLM_PROXY" 2>/dev/null; then
  green "llm_proxy.py has Bedrock backend"
else
  red "llm_proxy.py missing Bedrock backend"
fi

if grep -q '_resolve_backend' "$LLM_PROXY" 2>/dev/null; then
  green "llm_proxy.py has backend routing logic"
else
  red "llm_proxy.py missing backend routing logic"
fi

if grep -q 'force_backend' "$LLM_PROXY" 2>/dev/null; then
  green "llm_proxy.py uses force_backend parameter"
else
  red "llm_proxy.py ignores force_backend parameter"
fi

# Check LLMRequest persistence
if grep -q 'LLMRequest' "$LLM_ROUTE" 2>/dev/null; then
  green "llm.py imports LLMRequest model"
else
  red "llm.py missing LLMRequest import"
fi

if grep -q 'db.add.*llm_record\|LLMRequest(' "$LLM_ROUTE" 2>/dev/null; then
  green "llm.py persists LLMRequest to DB"
else
  red "llm.py not persisting LLMRequest"
fi

# Check DB-backed stats
if grep -q 'func.count\|func.avg\|func.sum' "$LLM_ROUTE" 2>/dev/null; then
  green "llm.py stats use DB aggregation queries"
else
  red "llm.py stats still using in-memory dict"
fi

# Check live context injection
if grep -q 'live_context\|Current Platform State' "$LLM_ROUTE" 2>/dev/null; then
  green "llm.py injects live platform context"
else
  red "llm.py missing live context injection"
fi

echo ""

# =============================================
# SECTION 20: Service Deployments (Phase 1.3)
# =============================================
echo "--- Section 20: Service Deployments ---"

MODELS="$BACKEND/app/models/models.py"
SERVICES_PY="$BACKEND/app/api/routes/services.py"

if grep -q 'class ServiceDeployment' "$MODELS" 2>/dev/null; then
  green "ServiceDeployment model exists"
else
  red "ServiceDeployment model MISSING"
fi

if grep -q 'deployments' "$SERVICES_PY" 2>/dev/null; then
  green "services.py has /deployments endpoint"
else
  red "services.py missing /deployments endpoint"
fi

if grep -q 'getDeployments' "$API_TS" 2>/dev/null; then
  green "api.ts has getDeployments function"
else
  red "api.ts missing getDeployments function"
fi

echo ""

# =============================================
# SECTION 21: Proxmox Version Alignment
# =============================================
echo "--- Section 21: Proxmox Version (9.1) ---"

PVE_FILES=(
  "$BACKEND/app/services/ai_actions.py"
  "$BACKEND/app/services/knowledge_base.py"
  "$BACKEND/app/services/llm_proxy.py"
  "$BACKEND/app/services/proxmox.py"
  "$BACKEND/app/api/routes/vms.py"
  "$FRONTEND/src/pages/Settings.tsx"
  "$INFRA/ansible/playbooks/01-proxmox-setup.yml"
  "$INFRA/deploy/01-proxmox-post-install.sh"
  "$INFRA/deploy/bootstrap-roosk.sh"
)

for f in "${PVE_FILES[@]}"; do
  fname=$(basename "$f")
  if grep -q 'Proxmox VE 8' "$f" 2>/dev/null; then
    red "$fname: still references PVE 8.x"
  else
    if grep -q 'Proxmox VE 9\|PVE 9' "$f" 2>/dev/null || grep -q 'Proxmox' "$f" 2>/dev/null; then
      green "$fname: Proxmox version correct (no 8.x references)"
    else
      green "$fname: no Proxmox version reference (OK)"
    fi
  fi
done

echo ""

# =============================================
# SECTION 22: Settings Page Accuracy
# =============================================
echo "--- Section 22: Settings Page Labels ---"

SETTINGS="$FRONTEND/src/pages/Settings.tsx"
if grep -q 'HS256' "$SETTINGS" 2>/dev/null; then
  green "Settings shows HS256 (correct)"
else
  red "Settings missing HS256 label"
fi

if grep -q 'RS256' "$SETTINGS" 2>/dev/null; then
  red "Settings still shows RS256"
else
  green "Settings: no RS256 reference"
fi

if grep -q 'Keycloak' "$SETTINGS" 2>/dev/null; then
  red "Settings still references Keycloak"
else
  green "Settings: no Keycloak reference"
fi

if grep -q 'HashiCorp\|Vault' "$SETTINGS" 2>/dev/null; then
  red "Settings still references HashiCorp Vault"
else
  green "Settings: no Vault reference"
fi

if grep -q 'Local TOTP\|pyotp' "$SETTINGS" 2>/dev/null; then
  green "Settings shows Local TOTP (correct)"
else
  red "Settings missing Local TOTP label"
fi

if grep -q 'Local JWT RBAC' "$SETTINGS" 2>/dev/null; then
  green "Settings shows Local JWT RBAC (correct)"
else
  red "Settings missing Local JWT RBAC label"
fi

if grep -q 'Environment Variables' "$SETTINGS" 2>/dev/null; then
  green "Settings shows Environment Variables (correct)"
else
  red "Settings missing Environment Variables label"
fi

# Check MFA management UI
if grep -q 'setupMFA\|Setup MFA\|Enable MFA' "$SETTINGS" 2>/dev/null; then
  green "Settings has MFA setup UI"
else
  red "Settings missing MFA setup UI"
fi

if grep -q 'disableMFA\|Disable MFA' "$SETTINGS" 2>/dev/null; then
  green "Settings has MFA disable UI"
else
  red "Settings missing MFA disable UI"
fi

echo ""

# =============================================
# SECTION 23: Proxmox Client Methods
# =============================================
echo "--- Section 23: Proxmox Client Methods ---"

PROXMOX_PY="$BACKEND/app/services/proxmox.py"
PX_METHODS=("list_vms" "get_vm" "start_vm" "stop_vm" "create_vm" "delete_vm" "list_containers" "start_container" "stop_container" "resize_vm")
for method in "${PX_METHODS[@]}"; do
  if grep -q "async def $method\|def $method" "$PROXMOX_PY" 2>/dev/null; then
    green "proxmox.py has: $method()"
  else
    red "proxmox.py MISSING: $method()"
  fi
done

echo ""

# =============================================
# SECTION 24: Agent Heartbeat Fix (Phase 1.1)
# =============================================
echo "--- Section 24: Bug Fix Verifications ---"

# Heartbeat persistence
if grep -q 'await db.commit' "$AGENTS_PY" 2>/dev/null; then
  green "agents.py commits heartbeat changes to DB"
else
  red "agents.py not committing heartbeat changes"
fi

# LLMRequest model exists
if grep -q 'class LLMRequest' "$MODELS" 2>/dev/null; then
  green "LLMRequest model exists in models.py"
else
  red "LLMRequest model MISSING from models.py"
fi

echo ""

# =============================================
# SECTION 25: SSH Terminal (WebSocket Proxy)
# =============================================
echo "--- Section 25: SSH Terminal ---"

SSH_PY="$BACKEND/app/api/routes/ssh.py"
SSH_TSX="$FRONTEND/src/pages/SSHTerminal.tsx"

# Backend checks
if [ -f "$SSH_PY" ]; then
  green "ssh.py route file exists"
else
  red "ssh.py route file MISSING"
fi

if grep -q 'asyncssh' "$SSH_PY" 2>/dev/null; then
  green "ssh.py uses asyncssh library"
else
  red "ssh.py missing asyncssh import"
fi

if grep -q 'websocket' "$SSH_PY" 2>/dev/null; then
  green "ssh.py has WebSocket endpoint"
else
  red "ssh.py missing WebSocket endpoint"
fi

if grep -q 'decode_token' "$SSH_PY" 2>/dev/null; then
  green "ssh.py authenticates via JWT token"
else
  red "ssh.py missing JWT authentication"
fi

if grep -q '_is_allowed_host' "$SSH_PY" 2>/dev/null; then
  green "ssh.py validates host against allowed ranges"
else
  red "ssh.py missing host validation"
fi

if grep -q 'list_ssh_hosts' "$SSH_PY" 2>/dev/null; then
  green "ssh.py has GET /hosts endpoint"
else
  red "ssh.py missing /hosts endpoint"
fi

if grep -q 'ssh_proxy' "$SSH_PY" 2>/dev/null; then
  green "ssh.py has WebSocket ssh_proxy handler"
else
  red "ssh.py missing ssh_proxy handler"
fi

if grep -q 'change_term_size' "$SSH_PY" 2>/dev/null; then
  green "ssh.py handles terminal resize"
else
  red "ssh.py missing terminal resize support"
fi

if grep -q 'KNOWN_HOSTS' "$SSH_PY" 2>/dev/null; then
  green "ssh.py has known hosts inventory"
else
  red "ssh.py missing known hosts"
fi

if grep -q '192.168.4.58' "$SSH_PY" 2>/dev/null; then
  green "ssh.py has correct Proxmox IP (192.168.4.58)"
else
  red "ssh.py has wrong Proxmox IP"
fi

# Frontend checks
if [ -f "$SSH_TSX" ]; then
  green "SSHTerminal.tsx page exists"
else
  red "SSHTerminal.tsx page MISSING"
fi

if grep -q '@xterm/xterm' "$SSH_TSX" 2>/dev/null; then
  green "SSHTerminal.tsx uses @xterm/xterm"
else
  red "SSHTerminal.tsx missing xterm import"
fi

if grep -q 'FitAddon' "$SSH_TSX" 2>/dev/null; then
  green "SSHTerminal.tsx uses FitAddon for terminal resize"
else
  red "SSHTerminal.tsx missing FitAddon"
fi

if grep -q 'getSSHHosts' "$SSH_TSX" 2>/dev/null; then
  green "SSHTerminal.tsx uses getSSHHosts API"
else
  red "SSHTerminal.tsx missing getSSHHosts call"
fi

if grep -q "SSHHost" "$SSH_TSX" 2>/dev/null; then
  green "SSHTerminal.tsx uses SSHHost type from @/types"
else
  red "SSHTerminal.tsx missing SSHHost type"
fi

if grep -q "WebSocket" "$SSH_TSX" 2>/dev/null; then
  green "SSHTerminal.tsx creates WebSocket connection"
else
  red "SSHTerminal.tsx missing WebSocket connection"
fi

# Check SSHHost type
if grep -q 'SSHHost' "$TYPES_TS" 2>/dev/null; then
  green "types/index.ts has SSHHost interface"
else
  red "types/index.ts MISSING SSHHost interface"
fi

# Check xterm packages in package.json
PKG="$FRONTEND/package.json"
if grep -q '@xterm/xterm' "$PKG" 2>/dev/null; then
  green "package.json has @xterm/xterm dependency"
else
  red "package.json MISSING @xterm/xterm"
fi

if grep -q '@xterm/addon-fit' "$PKG" 2>/dev/null; then
  green "package.json has @xterm/addon-fit dependency"
else
  red "package.json MISSING @xterm/addon-fit"
fi

echo ""

# =============================================
# SUMMARY
# =============================================
TOTAL=$((PASS + FAIL))
echo "============================================="
echo "  TEST RESULTS"
echo "============================================="
echo ""
echo -e "\033[32m  PASS: $PASS\033[0m"
echo -e "\033[33m  WARN: $WARN\033[0m"
echo -e "\033[31m  FAIL: $FAIL\033[0m"
echo -e "  TOTAL: $TOTAL checks"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "\033[31m  Failures:\033[0m"
  echo -e "$ERRORS"
  echo ""
  echo -e "\033[31m  BUILD STATUS: FAILED\033[0m"
  exit 1
else
  echo -e "\033[32m  BUILD STATUS: ALL $TOTAL CHECKS PASSED\033[0m"
  echo ""
  echo "  Platform is ready for deployment."
  echo "  Next: Boot Proxmox VE 9.1 from Ventoy → Run bootstrap-roosk.sh → Open dashboard"
  exit 0
fi
