#!/bin/bash
# =============================================================================
#  BYRTH.AI — Development Tools Installer
#  Run this on the Dell R7625 (or any Ubuntu 22.04+ server) to install
#  all development tools needed for the Byrth platform.
#
#  Usage: bash install-dev-tools.sh
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${CYAN}[DEV-TOOLS]${NC} $1"; }
ok()  { echo -e "${GREEN}  ✓${NC} $1"; }
warn(){ echo -e "${YELLOW}  ⚠${NC} $1"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║     BYRTH.AI — Development Tools Installer          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""

# Must be root or sudo
if [ "$(id -u)" -ne 0 ]; then
    echo "Run with sudo: sudo bash install-dev-tools.sh"
    exit 1
fi

# ─── 1. System Update ─────────────────────────────────────────────────────
log "[1/10] Updating system packages..."
apt-get update -y > /dev/null 2>&1
apt-get upgrade -y > /dev/null 2>&1
ok "System updated"

# ─── 2. Build Essentials ──────────────────────────────────────────────────
log "[2/10] Installing build essentials..."
apt-get install -y build-essential gcc g++ make cmake \
    curl wget git unzip zip jq htop tmux vim nano \
    ca-certificates gnupg lsb-release software-properties-common \
    apt-transport-https > /dev/null 2>&1
ok "Build essentials installed"

# ─── 3. Git (latest) ──────────────────────────────────────────────────────
log "[3/10] Installing Git..."
add-apt-repository -y ppa:git-core/ppa > /dev/null 2>&1 || true
apt-get update -y > /dev/null 2>&1
apt-get install -y git > /dev/null 2>&1
GIT_VER=$(git --version | awk '{print $3}')
ok "Git $GIT_VER installed"

# ─── 4. Node.js 20 LTS ────────────────────────────────────────────────────
log "[4/10] Installing Node.js 20 LTS..."
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - > /dev/null 2>&1
    apt-get install -y nodejs > /dev/null 2>&1
fi
NODE_VER=$(node -v)
NPM_VER=$(npm -v)
ok "Node.js $NODE_VER / npm $NPM_VER"

# Install global npm tools
npm install -g pnpm yarn pm2 > /dev/null 2>&1
ok "pnpm, yarn, pm2 installed globally"

# ─── 5. Python 3.12 ───────────────────────────────────────────────────────
log "[5/10] Installing Python 3.12..."
add-apt-repository -y ppa:deadsnakes/ppa > /dev/null 2>&1 || true
apt-get update -y > /dev/null 2>&1
apt-get install -y python3.12 python3.12-venv python3.12-dev python3-pip > /dev/null 2>&1
PY_VER=$(python3.12 --version 2>/dev/null || echo "Python 3.12")
ok "$PY_VER installed"

# ─── 6. Docker Engine + Compose ───────────────────────────────────────────
log "[6/10] Installing Docker..."
if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -y > /dev/null 2>&1
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin > /dev/null 2>&1
    systemctl enable docker
    systemctl start docker
fi
DOCKER_VER=$(docker --version | awk '{print $3}' | tr -d ,)
COMPOSE_VER=$(docker compose version --short 2>/dev/null || echo "n/a")
ok "Docker $DOCKER_VER / Compose $COMPOSE_VER"

# Add current user to docker group
if [ -n "${SUDO_USER:-}" ]; then
    usermod -aG docker "$SUDO_USER" 2>/dev/null || true
    ok "Added $SUDO_USER to docker group"
fi

# ─── 7. GitHub CLI ────────────────────────────────────────────────────────
log "[7/10] Installing GitHub CLI..."
if ! command -v gh &> /dev/null; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg > /dev/null 2>&1
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list
    apt-get update -y > /dev/null 2>&1
    apt-get install -y gh > /dev/null 2>&1
fi
GH_VER=$(gh --version | head -1 | awk '{print $3}')
ok "GitHub CLI $GH_VER"

# ─── 8. VS Code Server (code-server) ──────────────────────────────────────
log "[8/10] Installing VS Code Server (code-server)..."
if ! command -v code-server &> /dev/null; then
    curl -fsSL https://code-server.dev/install.sh | sh > /dev/null 2>&1
fi
ok "code-server installed (access VS Code in browser)"

# Configure code-server
mkdir -p ~/.config/code-server
cat > ~/.config/code-server/config.yaml <<'EOF'
bind-addr: 0.0.0.0:8443
auth: password
password: byrth2026
cert: false
EOF
ok "code-server configured on port 8443 (password: byrth2026)"

# Enable as service
systemctl enable --now code-server@root > /dev/null 2>&1 || true

# ─── 9. PostgreSQL Client Tools ───────────────────────────────────────────
log "[9/10] Installing PostgreSQL client tools..."
apt-get install -y postgresql-client-16 > /dev/null 2>&1 || \
    apt-get install -y postgresql-client > /dev/null 2>&1
ok "PostgreSQL client tools installed"

# ─── 10. Additional Dev Tools ─────────────────────────────────────────────
log "[10/10] Installing additional tools..."

# Playwright system dependencies
npx playwright install-deps > /dev/null 2>&1 || true
ok "Playwright system dependencies"

# Redis CLI
apt-get install -y redis-tools > /dev/null 2>&1 || true
ok "Redis CLI"

# AWS CLI v2
if ! command -v aws &> /dev/null; then
    curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
    unzip -q /tmp/awscliv2.zip -d /tmp
    /tmp/aws/install > /dev/null 2>&1
    rm -rf /tmp/aws /tmp/awscliv2.zip
fi
ok "AWS CLI v2"

# lazydocker (Docker TUI)
curl -fsSL https://raw.githubusercontent.com/jesseduffield/lazydocker/master/scripts/install_update_linux.sh | bash > /dev/null 2>&1 || true
ok "lazydocker (Docker TUI)"

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║        ALL DEVELOPMENT TOOLS INSTALLED              ║${NC}"
echo -e "${CYAN}╠══════════════════════════════════════════════════════╣${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║  Installed:                                          ║${NC}"
echo -e "${CYAN}║    • Git, Node.js 20, Python 3.12                   ║${NC}"
echo -e "${CYAN}║    • Docker + Docker Compose                        ║${NC}"
echo -e "${CYAN}║    • GitHub CLI (gh)                                ║${NC}"
echo -e "${CYAN}║    • VS Code Server (code-server) on port 8443     ║${NC}"
echo -e "${CYAN}║    • npm: pnpm, yarn, pm2                          ║${NC}"
echo -e "${CYAN}║    • PostgreSQL client, Redis CLI                   ║${NC}"
echo -e "${CYAN}║    • AWS CLI v2                                     ║${NC}"
echo -e "${CYAN}║    • Playwright system deps                        ║${NC}"
echo -e "${CYAN}║    • lazydocker (Docker TUI)                        ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║  VS Code Server: http://SERVER_IP:8443              ║${NC}"
echo -e "${CYAN}║    Password: byrth2026 (change in config)           ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║  VS Code Remote (from your PC):                     ║${NC}"
echo -e "${CYAN}║    1. Install 'Remote - SSH' extension              ║${NC}"
echo -e "${CYAN}║    2. Connect to ssh user@SERVER_IP                 ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}║  GitHub Login:                                       ║${NC}"
echo -e "${CYAN}║    gh auth login                                     ║${NC}"
echo -e "${CYAN}║                                                      ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${GREEN}Done! Log out and back in for docker group to take effect.${NC}"
