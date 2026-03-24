#!/bin/bash
# =============================================================================
# Gitea Installation Script — Run on VM-GIT-01 after Ubuntu 22.04 is installed
# Provides Git hosting for NexGen platform code
# =============================================================================
set -euo pipefail

echo "=== NexGen Gitea Installation ==="
echo "Target: VM-GIT-01 (10.20.0.13)"

GITEA_VERSION="1.22.6"
GITEA_USER="git"
GITEA_HOME="/home/git"
GITEA_WORK="/var/lib/gitea"

# 1. System updates
echo "[1/8] Updating system..."
apt-get update -y
apt-get upgrade -y

# 2. Install dependencies
echo "[2/8] Installing dependencies..."
apt-get install -y \
    git \
    postgresql postgresql-client \
    nginx \
    certbot python3-certbot-nginx \
    wget curl

# 3. Create Gitea database
echo "[3/8] Setting up PostgreSQL database..."
sudo -u postgres psql -c "SELECT 1 FROM pg_user WHERE usename = 'gitea'" | grep -q 1 || {
    sudo -u postgres psql <<SQL
CREATE USER gitea WITH PASSWORD 'gitea_nexgen_2026';
CREATE DATABASE gitea OWNER gitea;
GRANT ALL PRIVILEGES ON DATABASE gitea TO gitea;
SQL
    echo "Database created"
}

# 4. Create Gitea system user
echo "[4/8] Creating git user..."
if ! id "$GITEA_USER" &>/dev/null; then
    adduser --system --shell /bin/bash --group --disabled-password \
        --home "$GITEA_HOME" "$GITEA_USER"
fi

# 5. Download and install Gitea
echo "[5/8] Installing Gitea v${GITEA_VERSION}..."
mkdir -p "$GITEA_WORK"/{custom,data,log}
chown -R "$GITEA_USER:$GITEA_USER" "$GITEA_WORK"

if [ ! -f /usr/local/bin/gitea ]; then
    wget -q -O /usr/local/bin/gitea \
        "https://dl.gitea.com/gitea/${GITEA_VERSION}/gitea-${GITEA_VERSION}-linux-amd64"
    chmod +x /usr/local/bin/gitea
    echo "Gitea binary installed"
else
    echo "Gitea binary already installed"
fi

# 6. Create Gitea configuration
echo "[6/8] Writing Gitea configuration..."
mkdir -p "$GITEA_WORK/custom/conf"
cat > "$GITEA_WORK/custom/conf/app.ini" <<'INIEOF'
APP_NAME = NexGen Git Server
RUN_USER = git
RUN_MODE = prod
WORK_PATH = /var/lib/gitea

[database]
DB_TYPE  = postgres
HOST     = 127.0.0.1:5432
NAME     = gitea
USER     = gitea
PASSWD   = gitea_nexgen_2026
SSL_MODE = disable

[repository]
ROOT = /home/git/gitea-repositories

[server]
DOMAIN           = git.nexgen.local
ROOT_URL         = https://git.nexgen.local/
HTTP_PORT        = 3000
SSH_DOMAIN       = git.nexgen.local
SSH_PORT         = 22
DISABLE_SSH      = false
START_SSH_SERVER = false
LFS_START_SERVER = true

[service]
REGISTER_EMAIL_CONFIRM            = false
ENABLE_NOTIFY_MAIL                = false
DISABLE_REGISTRATION              = true
ALLOW_ONLY_EXTERNAL_REGISTRATION  = false
ENABLE_CAPTCHA                    = false
REQUIRE_SIGNIN_VIEW               = true

[mailer]
ENABLED = false

[log]
MODE      = file
LEVEL     = info
ROOT_PATH = /var/lib/gitea/log

[security]
INSTALL_LOCK = true
SECRET_KEY   = $(openssl rand -hex 32)
INIEOF

chown -R "$GITEA_USER:$GITEA_USER" "$GITEA_WORK"

# 7. Create systemd service
echo "[7/8] Setting up systemd service..."
cat > /etc/systemd/system/gitea.service <<'SVCEOF'
[Unit]
Description=Gitea (Git with a cup of tea)
After=syslog.target
After=network.target
After=postgresql.service

[Service]
Type=simple
User=git
Group=git
WorkingDirectory=/var/lib/gitea/
ExecStart=/usr/local/bin/gitea web --config /var/lib/gitea/custom/conf/app.ini
Restart=always
RestartSec=10
Environment=USER=git HOME=/home/git GITEA_WORK_DIR=/var/lib/gitea

[Install]
WantedBy=multi-user.target
SVCEOF

systemctl daemon-reload
systemctl enable gitea
systemctl start gitea

# 8. Configure Nginx reverse proxy
echo "[8/8] Configuring Nginx..."
cat > /etc/nginx/sites-available/gitea <<'NGXEOF'
server {
    listen 80;
    server_name git.nexgen.local;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        proxy_buffering off;
        client_max_body_size 512M;
    }
}
NGXEOF

ln -sf /etc/nginx/sites-available/gitea /etc/nginx/sites-enabled/gitea
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "=== Gitea Installation Complete ==="
echo ""
echo "Access: http://10.20.0.13:3000 (or https://git.nexgen.local after TLS)"
echo ""
echo "Create admin user:"
echo "  sudo -u git gitea admin user create \\"
echo "    --username admin \\"
echo "    --password nexgen2026 \\"
echo "    --email admin@flexworx.io \\"
echo "    --admin \\"
echo "    --config /var/lib/gitea/custom/conf/app.ini"
echo ""
echo "Then push the Roosk repo:"
echo "  git remote add origin http://10.20.0.13:3000/admin/roosk.git"
echo "  git push -u origin main"
echo ""
