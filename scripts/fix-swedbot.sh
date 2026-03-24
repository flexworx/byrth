#!/usr/bin/env bash
# fix-swedbot.sh — Deploy Clawdbot config to 10.20.0.40 and restart gateway
# Run this from a machine with SSH access to 10.20.0.40
set -euo pipefail

TARGET="10.20.0.40"
SSH_USER="${1:-deploy}"
SSH_OPTS="-o StrictHostKeyChecking=no -o ConnectTimeout=10"

echo "=== SwedBot Gateway Fix ==="
echo "Target: ${SSH_USER}@${TARGET}"
echo ""

# 1. Test SSH connectivity
echo "[1/5] Testing SSH connection..."
if ! ssh $SSH_OPTS "${SSH_USER}@${TARGET}" 'echo "OK"' >/dev/null 2>&1; then
  echo "ERROR: Cannot SSH to ${SSH_USER}@${TARGET}"
  echo "Usage: $0 [ssh-user]  (default: deploy)"
  exit 1
fi
echo "  Connected."

# 2. Create config directory and write clawdbot.json
echo "[2/5] Writing ~/.clawdbot/clawdbot.json..."
ssh $SSH_OPTS "${SSH_USER}@${TARGET}" 'mkdir -p ~/.clawdbot && cat > ~/.clawdbot/clawdbot.json' <<'CONFIGEOF'
{
  "identity": {
    "name": "SwedBot",
    "emoji": "☘️"
  },
  "gateway": {
    "mode": "local",
    "port": 18789,
    "bind": "lan",
    "trustedProxies": [
      "172.67.162.107",
      "104.21.58.181",
      "127.0.0.1",
      "10.20.0.0/24",
      "172.17.0.0/16"
    ],
    "auth": {
      "mode": "token",
      "token": "swedbot-rooskai-2026"
    },
    "controlUi": {
      "enabled": true,
      "basePath": "",
      "allowedOrigins": [
        "https://agent.roosk.ai",
        "https://roosk.ai",
        "https://www.roosk.ai"
      ],
      "allowInsecureAuth": true,
      "dangerouslyDisableDeviceAuth": true
    }
  },
  "agent": {
    "workspace": "~/.clawdbot/workspace"
  }
}
CONFIGEOF
echo "  Config written."

# 3. Verify the config is valid JSON
echo "[3/5] Validating config..."
ssh $SSH_OPTS "${SSH_USER}@${TARGET}" 'python3 -c "import json; json.load(open(\"/home/${USER}/.clawdbot/clawdbot.json\")); print(\"  Valid JSON.\")" 2>/dev/null || cat ~/.clawdbot/clawdbot.json | python3 -m json.tool >/dev/null && echo "  Valid JSON."'

# 4. Restart the gateway
echo "[4/5] Restarting Clawdbot gateway..."
ssh $SSH_OPTS "${SSH_USER}@${TARGET}" bash <<'RESTARTEOF'
# Try multiple restart methods
if command -v clawdbot >/dev/null 2>&1; then
  echo "  Using: clawdbot gateway restart"
  clawdbot gateway restart 2>&1 || true
elif command -v openclaw >/dev/null 2>&1; then
  echo "  Using: openclaw gateway restart"
  openclaw gateway restart 2>&1 || true
elif systemctl is-active --quiet clawdbot 2>/dev/null; then
  echo "  Using: systemctl restart clawdbot"
  sudo systemctl restart clawdbot 2>&1 || true
elif systemctl is-active --quiet openclaw-gateway 2>/dev/null; then
  echo "  Using: systemctl restart openclaw-gateway"
  sudo systemctl restart openclaw-gateway 2>&1 || true
else
  # Find and restart the process directly
  echo "  No CLI found. Looking for running gateway process..."
  PID=$(pgrep -f "clawdbot.*gateway" 2>/dev/null || pgrep -f "openclaw.*gateway" 2>/dev/null || true)
  if [ -n "$PID" ]; then
    echo "  Sending SIGHUP to PID $PID (config reload)..."
    kill -HUP "$PID" 2>/dev/null || true
    sleep 2
    if kill -0 "$PID" 2>/dev/null; then
      echo "  Gateway still running (PID $PID) — config reloaded."
    else
      echo "  WARNING: Process exited after SIGHUP. Check logs."
    fi
  else
    echo "  No gateway process found. Checking Docker..."
    CONTAINER=$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE "clawd|openclaw|gateway|swedbot" | head -1)
    if [ -n "$CONTAINER" ]; then
      echo "  Restarting Docker container: $CONTAINER"
      docker restart "$CONTAINER" 2>&1
    else
      echo "  ERROR: Cannot find gateway process or container."
      echo "  Listing possibly relevant processes:"
      ps aux | grep -iE "clawd|openclaw|gateway|node.*18789" | grep -v grep || echo "  (none found)"
      echo ""
      echo "  Listing Docker containers:"
      docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}' 2>/dev/null || echo "  Docker not available"
    fi
  fi
fi
RESTARTEOF

# 5. Verify gateway is responding
echo "[5/5] Verifying gateway..."
sleep 3
if curl -s --connect-timeout 5 -o /dev/null -w "%{http_code}" "http://${TARGET}:18789" | grep -q "200"; then
  echo "  Gateway is serving on ${TARGET}:18789"
else
  echo "  WARNING: Gateway not responding on port 18789"
fi

# Test WebSocket
WS_TEST=$(curl -s --connect-timeout 5 -i \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  -H "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==" \
  -H "Sec-WebSocket-Version: 13" \
  "http://${TARGET}:18789/" 2>&1 | head -1)

if echo "$WS_TEST" | grep -q "101"; then
  echo "  WebSocket upgrade: OK"
else
  echo "  WebSocket upgrade: FAILED ($WS_TEST)"
fi

echo ""
echo "=== Done ==="
echo "Open https://agent.roosk.ai/overview and click Connect."
echo "If still failing, check logs: ssh ${SSH_USER}@${TARGET} 'clawdbot logs --follow'"
