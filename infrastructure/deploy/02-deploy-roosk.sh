#!/bin/bash
# =============================================================================
# ROOSK — Phase 2: Deploy Platform
# Installs Roosk directly on Proxmox (no VMs needed yet)
#
# Usage:
#   scp 02-deploy-roosk.sh root@192.168.4.58:/root/
#   ssh root@192.168.4.58 "bash /root/02-deploy-roosk.sh"
#
# What it does:
#   1. Installs Node.js 20 + Python 3.11 + PostgreSQL 16 + pgvector
#   2. Clones the Roosk repo from GitHub
#   3. Sets up the database
#   4. Builds frontend + backend
#   5. Creates systemd services (auto-start on boot)
#   6. Configures Nginx reverse proxy
#   7. Starts everything
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { echo -e "${CYAN}[ROOSK]${NC} $1"; }
ok()  { echo -e "${GREEN}  OK${NC} $1"; }
warn(){ echo -e "${YELLOW}  WARN${NC} $1"; }
err() { echo -e "${RED}  FAIL${NC} $1"; exit 1; }

PLATFORM_DIR="/opt/roosk"
LOG="/root/roosk-deploy.log"

echo ""
echo -e "${CYAN}======================================${NC}"
echo -e "${CYAN}  ROOSK — Phase 2: Deploy Platform${NC}"
echo -e "${CYAN}  Direct install on Proxmox${NC}"
echo -e "${CYAN}======================================${NC}"
echo ""

[ "$(id -u)" -eq 0 ] || err "Must run as root"

# ─── Collect Info ─────────────────────────────────────────────────
echo "I need a few things from you:"
echo ""

# GitHub repo
REPO_URL=""
read -rp "GitHub repo URL [https://github.com/flexworx/byrth.git]: " REPO_URL
REPO_URL="${REPO_URL:-https://github.com/flexworx/byrth.git}"

# AWS credentials (optional)
AWS_KEY=""
AWS_SECRET=""
echo ""
echo "AWS credentials are optional (needed for Bedrock AI features)."
echo "Press Enter to skip if you don't have them yet."
read -rp "AWS Access Key ID [skip]: " AWS_KEY
if [ -n "$AWS_KEY" ]; then
    read -rsp "AWS Secret Access Key: " AWS_SECRET
    echo ""
fi

# Generate secrets
DB_PASS=$(openssl rand -hex 16)
JWT_SECRET=$(openssl rand -hex 32)
MURPH_HMAC=$(openssl rand -hex 32)
MURPH_WEBHOOK=$(openssl rand -hex 32)

echo ""
log "Starting deployment..."
echo ""

# ─── 1. Install Node.js 20 ───────────────────────────────────────
log "Step 1/8: Installing Node.js 20..."
if ! command -v node &>/dev/null || ! node --version | grep -q "v20"; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG" 2>&1
    DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs >> "$LOG" 2>&1
    ok "Node.js $(node --version) installed"
else
    ok "Node.js $(node --version) already installed"
fi

# ─── 2. Install Python 3.11 ──────────────────────────────────────
log "Step 2/8: Installing Python 3.11..."
if ! command -v python3.11 &>/dev/null; then
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        python3.11 python3.11-venv python3.11-dev >> "$LOG" 2>&1 || {
        # If not in default repos, add deadsnakes PPA
        DEBIAN_FRONTEND=noninteractive apt-get install -y software-properties-common >> "$LOG" 2>&1
        add-apt-repository -y ppa:deadsnakes/ppa >> "$LOG" 2>&1 || true
        apt-get update -y >> "$LOG" 2>&1
        DEBIAN_FRONTEND=noninteractive apt-get install -y \
            python3.11 python3.11-venv python3.11-dev >> "$LOG" 2>&1 || {
            warn "Python 3.11 not available, using system Python 3"
        }
    }
fi
PYTHON_CMD=$(command -v python3.11 || command -v python3)
ok "Python: $($PYTHON_CMD --version)"

# ─── 3. Install PostgreSQL 16 + pgvector ─────────────────────────
log "Step 3/8: Installing PostgreSQL 16 + pgvector..."
if ! command -v psql &>/dev/null; then
    # Add PostgreSQL apt repo
    echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
        > /etc/apt/sources.list.d/pgdg.list
    wget -qO- https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add - >> "$LOG" 2>&1
    apt-get update -y >> "$LOG" 2>&1
    DEBIAN_FRONTEND=noninteractive apt-get install -y \
        postgresql-16 postgresql-client-16 >> "$LOG" 2>&1
    ok "PostgreSQL 16 installed"
else
    ok "PostgreSQL already installed"
fi

# Install pgvector
DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-16-pgvector >> "$LOG" 2>&1 || {
    warn "pgvector package not available — will install from source later if needed"
}

# Ensure PostgreSQL is running
systemctl enable postgresql
systemctl start postgresql
ok "PostgreSQL running"

# ─── 4. Set up Database ──────────────────────────────────────────
log "Step 4/8: Setting up database..."
sudo -u postgres psql -c "CREATE USER roosk WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE roosk_platform OWNER roosk;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE roosk_platform TO roosk;" 2>/dev/null || true
sudo -u postgres psql -d roosk_platform -c "GRANT ALL ON SCHEMA public TO roosk;" 2>/dev/null || true
sudo -u postgres psql -d roosk_platform -c "CREATE EXTENSION IF NOT EXISTS vector;" 2>/dev/null || {
    warn "pgvector extension not available yet"
}

# Allow local connections with password
PG_HBA="/etc/postgresql/16/main/pg_hba.conf"
if [ -f "$PG_HBA" ]; then
    if ! grep -q "roosk" "$PG_HBA" 2>/dev/null; then
        echo "host all roosk 127.0.0.1/32 scram-sha-256" >> "$PG_HBA"
        systemctl reload postgresql
    fi
fi

ok "Database roosk_platform ready (user: roosk)"

# ─── 5. Clone Repo ───────────────────────────────────────────────
log "Step 5/8: Cloning repository..."
mkdir -p "$PLATFORM_DIR"

if [ -d "$PLATFORM_DIR/.git" ]; then
    cd "$PLATFORM_DIR"
    git pull >> "$LOG" 2>&1 || warn "Git pull failed — using existing code"
    ok "Repo updated"
else
    git clone "$REPO_URL" "$PLATFORM_DIR" >> "$LOG" 2>&1 || err "Git clone failed. Check the URL and try again."
    ok "Repo cloned to $PLATFORM_DIR"
fi
cd "$PLATFORM_DIR"

# ─── 6. Backend Setup ────────────────────────────────────────────
log "Step 6/8: Setting up FastAPI backend..."
cd "$PLATFORM_DIR/api-server"

# Create virtual environment
$PYTHON_CMD -m venv venv
source venv/bin/activate

# Install dependencies
pip install --upgrade pip >> "$LOG" 2>&1
pip install -r requirements.txt >> "$LOG" 2>&1
pip install email-validator >> "$LOG" 2>&1

# Read Proxmox token if available
PROXMOX_TOKEN=""
if [ -f /root/.proxmox-token ]; then
    PROXMOX_TOKEN=$(cat /root/.proxmox-token)
fi

# Create .env file
cat > .env <<ENVFILE
# Roosk Platform Configuration — Generated $(date)
DATABASE_URL=postgresql+asyncpg://roosk:${DB_PASS}@localhost:5432/roosk_platform
JWT_SECRET_KEY=${JWT_SECRET}
JWT_ALGORITHM=HS256
DEBUG=false
CORS_ORIGINS=["http://192.168.4.58","http://localhost:3000","https://roosk.ai"]

# Proxmox
PROXMOX_URL=https://127.0.0.1:8006
PROXMOX_NODE=r7625
PROXMOX_TOKEN_ID=platform@pve!platform-token
PROXMOX_TOKEN_SECRET=${PROXMOX_TOKEN}
PROXMOX_VERIFY_SSL=false

# AWS Bedrock (optional — leave empty to disable AI features)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=${AWS_KEY}
AWS_SECRET_ACCESS_KEY=${AWS_SECRET}
BEDROCK_MODEL_ID=anthropic.claude-3-sonnet-20240229-v1:0

# Murph Agent Security
MURPH_HMAC_SECRET=${MURPH_HMAC}
MURPH_WEBHOOK_SECRET=${MURPH_WEBHOOK}

# Monitoring
PROMETHEUS_ENABLED=true

# Ollama (disabled until GPU added)
OLLAMA_ENABLED=false
ENVFILE

chmod 600 .env
deactivate
ok "Backend configured"

# ─── 7. Frontend Setup ───────────────────────────────────────────
log "Step 7/8: Building Next.js frontend..."
cd "$PLATFORM_DIR"

# Install npm dependencies
npm ci >> "$LOG" 2>&1 || npm install >> "$LOG" 2>&1
ok "NPM packages installed"

# Build Next.js (standalone mode)
npm run build >> "$LOG" 2>&1
ok "Frontend built"

# ─── 8. Create Services + Nginx ──────────────────────────────────
log "Step 8/8: Creating systemd services and Nginx..."

# Backend service
cat > /etc/systemd/system/roosk-api.service <<SVC
[Unit]
Description=Roosk FastAPI Backend
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${PLATFORM_DIR}/api-server
Environment=PATH=${PLATFORM_DIR}/api-server/venv/bin:/usr/local/bin:/usr/bin
ExecStart=${PLATFORM_DIR}/api-server/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

# Frontend service
cat > /etc/systemd/system/roosk-web.service <<SVC
[Unit]
Description=Roosk Next.js Frontend
After=network.target roosk-api.service

[Service]
Type=simple
User=root
WorkingDirectory=${PLATFORM_DIR}
ExecStart=/usr/bin/node ${PLATFORM_DIR}/.next/standalone/server.js
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
Environment=API_URL=http://127.0.0.1:8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

# Nginx reverse proxy
DEBIAN_FRONTEND=noninteractive apt-get install -y nginx >> "$LOG" 2>&1

cat > /etc/nginx/sites-available/roosk <<'NGINX'
server {
    listen 80 default_server;
    server_name _;

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Frontend (Next.js)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_buffering off;
    }

    # API (FastAPI)
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket for notifications
    location /api/notifications/ws {
        proxy_pass http://127.0.0.1:8000/api/notifications/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # WebSocket for SSH terminal
    location /api/ssh/ {
        proxy_pass http://127.0.0.1:8000/api/ssh/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Health check
    location /health {
        proxy_pass http://127.0.0.1:8000/health;
    }

    # API docs
    location /docs {
        proxy_pass http://127.0.0.1:8000/docs;
    }
    location /openapi.json {
        proxy_pass http://127.0.0.1:8000/openapi.json;
    }
}
NGINX

# Enable Nginx site
ln -sf /etc/nginx/sites-available/roosk /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t >> "$LOG" 2>&1 || err "Nginx config test failed"

# Start everything
systemctl daemon-reload
systemctl enable roosk-api roosk-web nginx
systemctl start roosk-api
sleep 3
systemctl start roosk-web
systemctl reload nginx

ok "All services started"

# ─── Save Credentials ────────────────────────────────────────────
cat > /root/.roosk-secrets <<SECRETS
# Roosk Platform Secrets — Generated $(date)
# KEEP THIS FILE SECURE — DO NOT SHARE

DB_USER=roosk
DB_PASS=${DB_PASS}
DB_NAME=roosk_platform
DB_HOST=localhost

JWT_SECRET=${JWT_SECRET}
MURPH_HMAC_SECRET=${MURPH_HMAC}
MURPH_WEBHOOK_SECRET=${MURPH_WEBHOOK}

PROXMOX_TOKEN_ID=platform@pve!platform-token
PROXMOX_TOKEN_SECRET=${PROXMOX_TOKEN}

AWS_ACCESS_KEY_ID=${AWS_KEY}

PLATFORM_DIR=${PLATFORM_DIR}
SECRETS
chmod 600 /root/.roosk-secrets

# ─── Verify ──────────────────────────────────────────────────────
echo ""
log "Verifying deployment..."
sleep 5

# Check backend
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:8000/health 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ]; then
    ok "Backend API is running (port 8000)"
else
    warn "Backend returned HTTP $API_STATUS — check: journalctl -u roosk-api"
fi

# Check frontend
WEB_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:3000 2>/dev/null || echo "000")
if [ "$WEB_STATUS" = "200" ]; then
    ok "Frontend is running (port 3000)"
else
    warn "Frontend returned HTTP $WEB_STATUS — check: journalctl -u roosk-web"
fi

# Check Nginx
NGINX_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:80 2>/dev/null || echo "000")
if [ "$NGINX_STATUS" = "200" ] || [ "$NGINX_STATUS" = "302" ]; then
    ok "Nginx proxy is running (port 80)"
else
    warn "Nginx returned HTTP $NGINX_STATUS — check: journalctl -u nginx"
fi

# ─── Done ─────────────────────────────────────────────────────────
SERVER_IP=$(ip -4 addr show vmbr0 2>/dev/null | grep inet | awk '{print $2}' | cut -d/ -f1)
SERVER_IP="${SERVER_IP:-192.168.4.58}"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}  ROOSK IS LIVE${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "  Dashboard:  http://${SERVER_IP}"
echo "  API Docs:   http://${SERVER_IP}/docs"
echo "  Proxmox:    https://${SERVER_IP}:8006"
echo ""
echo "  Secrets:    /root/.roosk-secrets"
echo "  Logs:       journalctl -u roosk-api -f"
echo "              journalctl -u roosk-web -f"
echo ""
echo "  Services:"
echo "    systemctl status roosk-api"
echo "    systemctl status roosk-web"
echo "    systemctl status nginx"
echo ""
echo -e "${GREEN}  Open http://${SERVER_IP} in your browser!${NC}"
echo ""
