#!/bin/bash
# =============================================================================
# Platform Deployment Script — Run on VM-APP-01 after Ubuntu is installed
# Deploys the NexGen FastAPI backend + React frontend
# =============================================================================
set -euo pipefail

echo "=== NexGen Platform Deployment ==="
echo "Target: VM-APP-01 (10.20.0.10)"

PLATFORM_DIR="/opt/nexgen"
REPO_URL="http://10.20.0.30:3000/admin/roosk.git"  # Gitea on VM-GIT-01

# 1. System setup
echo "[1/7] System setup..."
apt-get update -y
apt-get install -y \
    python3.11 python3.11-venv python3-pip \
    nodejs npm \
    nginx \
    git curl wget

# Install Node 20.x if not present
if ! node --version 2>/dev/null | grep -q "v20"; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 2. Clone repo
echo "[2/7] Cloning platform code..."
if [ ! -d "$PLATFORM_DIR/.git" ]; then
    git clone "$REPO_URL" "$PLATFORM_DIR"
else
    cd "$PLATFORM_DIR" && git pull origin main
fi

# 3. Backend setup
echo "[3/7] Setting up Python backend..."
cd "$PLATFORM_DIR/backend"
python3.11 -m venv venv
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Create .env file
cat > .env <<ENVEOF
DATABASE_URL=postgresql+asyncpg://nexgen:nexgen@10.20.0.11:5432/nexgen_platform
JWT_SECRET_KEY=$(openssl rand -hex 32)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
PROXMOX_URL=https://192.168.4.58:8006
PROXMOX_TOKEN_ID=platform@pve!platform-token
PROXMOX_TOKEN_SECRET=$(cat /root/.proxmox-token 2>/dev/null || echo "SET_ME")
MURPH_HMAC_SECRET=$(openssl rand -hex 32)
CORS_ORIGINS=["https://dashboard.nexgen.local","http://localhost:3000"]
DEBUG=false
ENVEOF

chmod 600 .env
deactivate

# 4. Frontend build
echo "[4/7] Building frontend..."
cd "$PLATFORM_DIR/frontend"
npm ci
npm run build

# 5. Create systemd service
echo "[5/7] Setting up systemd service..."
cat > /etc/systemd/system/nexgen-api.service <<SVCEOF
[Unit]
Description=NexGen Platform API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=$PLATFORM_DIR/backend
Environment=PATH=$PLATFORM_DIR/backend/venv/bin:/usr/bin:/bin
ExecStart=$PLATFORM_DIR/backend/venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable nexgen-api
systemctl start nexgen-api

# 6. Nginx reverse proxy
echo "[6/7] Configuring Nginx..."
cat > /etc/nginx/sites-available/nexgen <<NGXEOF
server {
    listen 80;
    server_name dashboard.nexgen.local;

    root $PLATFORM_DIR/frontend/dist;
    index index.html;

    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /health {
        proxy_pass http://127.0.0.1:8000;
    }

    location /docs {
        proxy_pass http://127.0.0.1:8000;
    }

    location /redoc {
        proxy_pass http://127.0.0.1:8000;
    }

    location /openapi.json {
        proxy_pass http://127.0.0.1:8000;
    }

    # SPA fallback
    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
NGXEOF

ln -sf /etc/nginx/sites-available/nexgen /etc/nginx/sites-enabled/nexgen
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 7. Database migration
echo "[7/7] Running database initialization..."
cd "$PLATFORM_DIR/backend"
source venv/bin/activate
python -c "
import asyncio
from app.core.database import init_db
asyncio.run(init_db())
print('Database tables created')
"
deactivate

echo ""
echo "=== Platform Deployment Complete ==="
echo ""
echo "Dashboard: http://10.20.0.10 (or https://dashboard.nexgen.local)"
echo "API Docs:  http://10.20.0.10/docs"
echo "Login:     admin@flexworx.io / nexgen2026"
echo ""
echo "Check status: systemctl status nexgen-api"
echo "View logs:    journalctl -u nexgen-api -f"
echo ""
