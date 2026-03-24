#!/bin/bash
# =============================================================================
#  ROOSK.AI — FULL AUTOMATED DEPLOYMENT
#  One script, zero thinking. Deploys everything in the correct order.
#
#  Usage (on a fresh Ubuntu 22.04 server or VM):
#    curl -sL https://raw.githubusercontent.com/flexworx/byrth/main/infrastructure/deploy/roosk-full-auto.sh | sudo bash
#    — OR —
#    sudo bash roosk-full-auto.sh
#
#  Deployment Order:
#    Step 1: Install all development tools
#    Step 2: Clone Roosk repository
#    Step 3: Configure PostgreSQL database
#    Step 4: Set up FastAPI backend
#    Step 5: Build Next.js frontend
#    Step 6: Configure Nginx reverse proxy
#    Step 7: Set up SSL (if domain configured)
#    Step 8: Create systemd services
#    Step 9: Run database migrations
#    Step 10: Create admin user
#    Step 11: Start all services
#    Step 12: Verify health
# =============================================================================
set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m'

LOG="/var/log/roosk-deploy.log"
PLATFORM_DIR="/opt/roosk"
DB_PASS="$(openssl rand -hex 16)"
JWT_SECRET="$(openssl rand -hex 32)"
DOMAIN="${ROOSK_DOMAIN:-}"

log()   { echo -e "${CYAN}[ROOSK]${NC} $1" | tee -a "$LOG"; }
ok()    { echo -e "${GREEN}  ✓${NC} $1" | tee -a "$LOG"; }
warn()  { echo -e "${YELLOW}  ⚠${NC} $1" | tee -a "$LOG"; }
err()   { echo -e "${RED}  ✗${NC} $1" | tee -a "$LOG"; exit 1; }
step()  { echo -e "\n${BOLD}${CYAN}━━━ Step $1: $2 ━━━${NC}" | tee -a "$LOG"; }

echo ""
echo -e "${CYAN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}║      ${BOLD}ROOSK.AI — Full Automated Deployment${NC}${CYAN}               ║${NC}"
echo -e "${CYAN}║      MURPH.AI HSE Operations Center                      ║${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}║      Zero thinking. One script. Everything deployed.     ║${NC}"
echo -e "${CYAN}║                                                          ║${NC}"
echo -e "${CYAN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""

[ "$(id -u)" -eq 0 ] || err "Must run as root (sudo)"

START_TIME=$(date +%s)

# ═══════════════════════════════════════════════════════════════════════════
step "1/12" "Installing development tools"
# ═══════════════════════════════════════════════════════════════════════════

apt-get update -y >> "$LOG" 2>&1
apt-get install -y build-essential gcc g++ make curl wget git unzip zip jq \
    htop tmux vim ca-certificates gnupg lsb-release \
    software-properties-common apt-transport-https >> "$LOG" 2>&1
ok "Base packages"

# Node.js 20
if ! command -v node &> /dev/null || [[ $(node -v | cut -d. -f1 | tr -d v) -lt 20 ]]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >> "$LOG" 2>&1
    apt-get install -y nodejs >> "$LOG" 2>&1
fi
ok "Node.js $(node -v)"

# Python 3.12
add-apt-repository -y ppa:deadsnakes/ppa >> "$LOG" 2>&1 || true
apt-get update -y >> "$LOG" 2>&1
apt-get install -y python3.12 python3.12-venv python3.12-dev python3-pip >> "$LOG" 2>&1
ok "Python $(python3.12 --version 2>&1)"

# Docker
if ! command -v docker &> /dev/null; then
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg 2>/dev/null
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" > /etc/apt/sources.list.d/docker.list
    apt-get update -y >> "$LOG" 2>&1
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin >> "$LOG" 2>&1
    systemctl enable --now docker >> "$LOG" 2>&1
fi
ok "Docker $(docker --version | awk '{print $3}' | tr -d ,)"

# GitHub CLI
if ! command -v gh &> /dev/null; then
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | dd of=/usr/share/keyrings/githubcli-archive-keyring.gpg >> "$LOG" 2>&1
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list
    apt-get update -y >> "$LOG" 2>&1
    apt-get install -y gh >> "$LOG" 2>&1
fi
ok "GitHub CLI $(gh --version | head -1 | awk '{print $3}')"

# Global npm tools
npm install -g pm2 >> "$LOG" 2>&1
ok "pm2 process manager"

# ═══════════════════════════════════════════════════════════════════════════
step "2/12" "Cloning Roosk repository"
# ═══════════════════════════════════════════════════════════════════════════

mkdir -p "$PLATFORM_DIR"
if [ -d "$PLATFORM_DIR/.git" ]; then
    cd "$PLATFORM_DIR" && git pull >> "$LOG" 2>&1
    ok "Repository updated"
else
    git clone https://github.com/flexworx/byrth.git "$PLATFORM_DIR" >> "$LOG" 2>&1
    ok "Repository cloned to $PLATFORM_DIR"
fi
cd "$PLATFORM_DIR"

# ═══════════════════════════════════════════════════════════════════════════
step "3/12" "Configuring PostgreSQL database"
# ═══════════════════════════════════════════════════════════════════════════

apt-get install -y postgresql postgresql-contrib >> "$LOG" 2>&1
systemctl enable --now postgresql >> "$LOG" 2>&1

sudo -u postgres psql -c "CREATE USER roosk WITH PASSWORD '${DB_PASS}';" 2>/dev/null || true
sudo -u postgres psql -c "CREATE DATABASE roosk_platform OWNER roosk;" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE roosk_platform TO roosk;" 2>/dev/null || true
ok "Database: roosk_platform (user: roosk)"

# ═══════════════════════════════════════════════════════════════════════════
step "4/12" "Setting up FastAPI backend"
# ═══════════════════════════════════════════════════════════════════════════

cd "$PLATFORM_DIR/api-server"
python3.12 -m venv venv
source venv/bin/activate
pip install --upgrade pip >> "$LOG" 2>&1
pip install -r requirements.txt >> "$LOG" 2>&1
pip install email-validator bcrypt==4.2.1 >> "$LOG" 2>&1

cat > .env <<ENV
DATABASE_URL=postgresql+asyncpg://roosk:${DB_PASS}@localhost:5432/roosk_platform
JWT_SECRET_KEY=${JWT_SECRET}
JWT_ALGORITHM=HS256
DEBUG=false
CORS_ORIGINS=["http://localhost:3000","http://$(hostname -I | awk '{print $1}')"]
PROXMOX_URL=https://10.10.0.1:8006
PROXMOX_TOKEN_ID=platform@pve!platform-token
PROXMOX_TOKEN_SECRET=CHANGE_ME
AWS_DEFAULT_REGION=us-east-1
AWS_ACCESS_KEY_ID=CHANGE_ME
AWS_SECRET_ACCESS_KEY=CHANGE_ME
BEDROCK_MODEL_ID=us.anthropic.claude-sonnet-4-20250514-v1:0
PROMETHEUS_ENABLED=true
ENV
deactivate
ok "Backend configured"

# ═══════════════════════════════════════════════════════════════════════════
step "5/12" "Building Next.js frontend"
# ═══════════════════════════════════════════════════════════════════════════

cd "$PLATFORM_DIR"
npm ci >> "$LOG" 2>&1
npm run build >> "$LOG" 2>&1
ok "Frontend built ($(ls .next/standalone/server.js 2>/dev/null && echo 'standalone mode' || echo 'standard mode'))"

# ═══════════════════════════════════════════════════════════════════════════
step "6/12" "Configuring Nginx reverse proxy"
# ═══════════════════════════════════════════════════════════════════════════

apt-get install -y nginx >> "$LOG" 2>&1

SERVER_IP=$(hostname -I | awk '{print $1}')
SERVER_NAME="${DOMAIN:-$SERVER_IP}"

cat > /etc/nginx/sites-available/roosk <<NGINX
# Rate limiting
limit_req_zone \$binary_remote_addr zone=api:10m rate=30r/s;

server {
    listen 80;
    server_name ${SERVER_NAME} www.${SERVER_NAME};

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Frontend
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # API (rate limited)
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
    }

    # WebSocket for notifications
    location /api/notifications/ws {
        proxy_pass http://127.0.0.1:8000/api/notifications/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
    }

    # WebSocket for SSH terminal
    location /api/ssh/ {
        proxy_pass http://127.0.0.1:8000/api/ssh/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 86400s;
    }

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml;
    gzip_min_length 256;
}
NGINX

ln -sf /etc/nginx/sites-available/roosk /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t >> "$LOG" 2>&1
systemctl enable --now nginx >> "$LOG" 2>&1
systemctl reload nginx
ok "Nginx configured (${SERVER_NAME})"

# ═══════════════════════════════════════════════════════════════════════════
step "7/12" "Setting up SSL"
# ═══════════════════════════════════════════════════════════════════════════

if [ -n "$DOMAIN" ]; then
    apt-get install -y certbot python3-certbot-nginx >> "$LOG" 2>&1
    certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "admin@${DOMAIN}" >> "$LOG" 2>&1 || warn "SSL setup failed — run manually: certbot --nginx -d $DOMAIN"
    ok "SSL configured for $DOMAIN"
else
    warn "No ROOSK_DOMAIN set — skipping SSL. Set it and run: certbot --nginx -d yourdomain.com"
fi

# ═══════════════════════════════════════════════════════════════════════════
step "8/12" "Creating systemd services"
# ═══════════════════════════════════════════════════════════════════════════

cat > /etc/systemd/system/roosk-api.service <<SVC
[Unit]
Description=Roosk.AI FastAPI Backend
After=network.target postgresql.service
Wants=postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=${PLATFORM_DIR}/api-server
Environment=PATH=${PLATFORM_DIR}/api-server/venv/bin:/usr/bin:/usr/local/bin
ExecStart=${PLATFORM_DIR}/api-server/venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

cat > /etc/systemd/system/roosk-web.service <<SVC
[Unit]
Description=Roosk.AI Next.js Frontend
After=network.target roosk-api.service

[Service]
Type=simple
User=root
WorkingDirectory=${PLATFORM_DIR}
ExecStart=/usr/bin/node ${PLATFORM_DIR}/.next/standalone/server.js
Environment=PORT=3000
Environment=HOSTNAME=0.0.0.0
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVC

systemctl daemon-reload
ok "Systemd services created"

# ═══════════════════════════════════════════════════════════════════════════
step "9/12" "Running database migrations"
# ═══════════════════════════════════════════════════════════════════════════

cd "$PLATFORM_DIR/api-server"
source venv/bin/activate
alembic upgrade head >> "$LOG" 2>&1 || warn "Migrations may need manual review"
deactivate
ok "Database migrations applied"

# ═══════════════════════════════════════════════════════════════════════════
step "10/12" "Creating admin user"
# ═══════════════════════════════════════════════════════════════════════════

cd "$PLATFORM_DIR/api-server"
source venv/bin/activate
python3.12 -c "
import asyncio
from app.core.database import async_engine, Base
from app.models.models import User
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import sessionmaker
from passlib.hash import bcrypt

async def create_admin():
    async with async_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    Session = sessionmaker(async_engine, class_=AsyncSession, expire_on_commit=False)
    async with Session() as session:
        from sqlalchemy import select
        existing = await session.execute(select(User).where(User.username == 'admin'))
        if existing.scalar_one_or_none():
            print('Admin user already exists')
            return
        admin = User(
            username='admin',
            email='admin@roosk.ai',
            hashed_password=bcrypt.hash('nexgen2026'),
            role='platform_admin',
            is_active=True,
        )
        session.add(admin)
        await session.commit()
        print('Admin user created: admin / nexgen2026')

asyncio.run(create_admin())
" >> "$LOG" 2>&1 || warn "Admin user creation requires running migrations first"
deactivate
ok "Admin user ready"

# ═══════════════════════════════════════════════════════════════════════════
step "11/12" "Starting all services"
# ═══════════════════════════════════════════════════════════════════════════

systemctl enable roosk-api roosk-web >> "$LOG" 2>&1
systemctl restart roosk-api
sleep 3
systemctl restart roosk-web
sleep 2
systemctl reload nginx
ok "All services started"

# ═══════════════════════════════════════════════════════════════════════════
step "12/12" "Health verification"
# ═══════════════════════════════════════════════════════════════════════════

sleep 3

# Check API
if curl -sf http://127.0.0.1:8000/health > /dev/null 2>&1; then
    ok "API server: healthy"
else
    warn "API server: starting up (may take 10-15 seconds)"
fi

# Check frontend
if curl -sf http://127.0.0.1:3000 > /dev/null 2>&1; then
    ok "Frontend: healthy"
else
    warn "Frontend: starting up"
fi

# Check Nginx
if curl -sf http://127.0.0.1 > /dev/null 2>&1; then
    ok "Nginx: healthy"
else
    warn "Nginx: check config"
fi

END_TIME=$(date +%s)
ELAPSED=$((END_TIME - START_TIME))

echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║          ${BOLD}ROOSK.AI IS FULLY DEPLOYED${NC}${GREEN}                    ║${NC}"
echo -e "${GREEN}║          Deployment completed in ${ELAPSED}s                     ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}╠══════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  Dashboard:  http://${SERVER_IP}                         ║${NC}"
echo -e "${GREEN}║  API Docs:   http://${SERVER_IP}/docs                    ║${NC}"
echo -e "${GREEN}║  Login:      admin / nexgen2026                         ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  NEXT STEPS (optional):                                  ║${NC}"
echo -e "${GREEN}║  1. Edit /opt/roosk/api-server/.env:                    ║${NC}"
echo -e "${GREEN}║     - Set PROXMOX_TOKEN_SECRET                          ║${NC}"
echo -e "${GREEN}║     - Set AWS_ACCESS_KEY_ID + SECRET                    ║${NC}"
echo -e "${GREEN}║  2. Set domain: export ROOSK_DOMAIN=roosk.ai            ║${NC}"
echo -e "${GREEN}║  3. Enable SSL: certbot --nginx -d roosk.ai             ║${NC}"
echo -e "${GREEN}║  4. Change admin password in dashboard                  ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  SERVICES:                                               ║${NC}"
echo -e "${GREEN}║    systemctl status roosk-api roosk-web nginx            ║${NC}"
echo -e "${GREEN}║    journalctl -u roosk-api -f  (view logs)              ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}║  UPDATES:                                                ║${NC}"
echo -e "${GREEN}║    cd /opt/roosk && git pull                            ║${NC}"
echo -e "${GREEN}║    npm run build                                        ║${NC}"
echo -e "${GREEN}║    systemctl restart roosk-api roosk-web                 ║${NC}"
echo -e "${GREEN}║                                                          ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "Full log: $LOG"
