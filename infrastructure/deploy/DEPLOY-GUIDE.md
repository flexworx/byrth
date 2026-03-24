# Roosk NexGen Platform — Deployment Guide
## Dell PowerEdge R7625 + Proxmox VE

Your server: 192.168.254.58 (nic3), Gateway: 192.168.254.1 (was 192.168.4.58)

---

## OVERVIEW

There are 3 phases:

| Phase | What | Where you run it | Time |
|-------|------|-------------------|------|
| Phase 0 | Fix Proxmox networking | Server console | 5 min |
| Phase 1 | Configure Proxmox (repos, packages, ZFS, API token) | SSH from your laptop | 10 min |
| Phase 2 | Deploy Roosk platform directly on Proxmox | SSH from your laptop | 15 min |

Phase 2 runs Roosk directly on Proxmox (no VMs needed yet). VMs come later once the platform is running.

---

## PHASE 0: Fix Proxmox Networking (Server Console)

You must do this on the physical server console (keyboard + monitor attached to R7625).

### Step 1: Log in at the console
```
Login: root
Password: (the one you set)
```

### Step 2: Fix /etc/network/interfaces

The installer configured the wrong NIC. Your working NIC is `nic3`.

Run this command:
```bash
cat > /etc/network/interfaces <<'EOF'
auto lo
iface lo inet loopback

auto nic3
iface nic3 inet manual

auto vmbr0
iface vmbr0 inet static
    address 192.168.4.58/24
    gateway 192.168.4.1
    bridge-ports nic3
    bridge-stp off
    bridge-fd 0
EOF
```

### Step 3: Restart networking
```bash
systemctl restart networking
```

### Step 4: Test connectivity
```bash
ping -c 3 192.168.4.1
```
You should see 3 replies. If not, reboot: `reboot`

### Step 5: Test from your laptop
Open Windows Command Prompt on your laptop:
```
ping 192.168.4.58
```
Should get replies.

### Step 6: Access Proxmox Web UI
Open browser: https://192.168.4.58:8006
- Username: root
- Password: (your password)
- Realm: Linux PAM
- Click through the certificate warning (Advanced > Proceed)

If port 8006 doesn't connect, run on the server:
```bash
systemctl restart pveproxy
```

Then try the browser again.

### Step 7: Set up SSH access from your laptop
On the server console:
```bash
sed -i 's/^#*PermitRootLogin.*/PermitRootLogin yes/' /etc/ssh/sshd_config
sed -i 's/^#*PasswordAuthentication.*/PasswordAuthentication yes/' /etc/ssh/sshd_config
systemctl restart sshd
```

Now from your Windows laptop, open a terminal (PowerShell or Git Bash):
```
ssh root@192.168.4.58
```
Enter your root password when prompted. If this works, you can do everything from your laptop now.

---

## PHASE 1: Configure Proxmox (Run from SSH)

SSH into the server from your laptop:
```
ssh root@192.168.4.58
```

### Step 1: Copy the setup script to the server

From your laptop (Git Bash or WSL), in the Roosk project directory:
```bash
scp infrastructure/deploy/01-setup-proxmox.sh root@192.168.4.58:/root/
```

### Step 2: Run it on the server
```bash
ssh root@192.168.4.58
bash /root/01-setup-proxmox.sh
```

This script will:
- Remove enterprise repo, add free repo
- Update all packages
- Install required tools (git, curl, docker, etc.)
- Set up ZFS storage pool (if 3 NVMe disks available)
- Create Proxmox API token
- Download Ubuntu cloud image

**Time: ~5-10 minutes** (depends on internet speed)

---

## PHASE 2: Deploy Roosk Platform (Run from SSH)

### Step 1: Copy the deploy script to the server
From your laptop:
```bash
scp infrastructure/deploy/02-deploy-roosk.sh root@192.168.4.58:/root/
```

### Step 2: Run it on the server
```bash
ssh root@192.168.4.58
bash /root/02-deploy-roosk.sh
```

The script will ask you for:
- **GitHub repo URL**: https://github.com/flexworx/byrth.git
- **AWS Access Key ID**: (for Bedrock AI — press Enter to skip if you don't have one yet)
- **AWS Secret Key**: (same, press Enter to skip)

The script will:
1. Install Node.js 20, Python 3.11, PostgreSQL 16 + pgvector
2. Clone the Roosk repo from GitHub
3. Set up the database (create user, database, extensions)
4. Install backend dependencies (FastAPI + Python packages)
5. Build the Next.js frontend
6. Create systemd services (auto-start on boot)
7. Configure Nginx reverse proxy
8. Start everything

**Time: ~10-15 minutes**

### Step 3: Access Roosk
Open your browser:
- **Dashboard**: http://192.168.4.58
- **API Docs**: http://192.168.4.58/docs
- **Proxmox UI**: https://192.168.4.58:8006

---

## TROUBLESHOOTING

### Can't access web UI from browser
```bash
# On the server, check services:
systemctl status roosk-api
systemctl status roosk-web
systemctl status nginx

# Restart everything:
systemctl restart roosk-api roosk-web nginx
```

### Check logs
```bash
journalctl -u roosk-api -f    # Backend logs (live)
journalctl -u roosk-web -f    # Frontend logs (live)
journalctl -u nginx -f        # Nginx logs (live)
```

### Database issues
```bash
sudo -u postgres psql -l                    # List databases
sudo -u postgres psql -d roosk_platform     # Connect to DB
```

### Service won't start
```bash
# Test backend manually:
cd /opt/roosk/api-server
source venv/bin/activate
uvicorn app.main:app --host 127.0.0.1 --port 8000

# Test frontend manually:
cd /opt/roosk
node .next/standalone/server.js
```

---

## WHAT'S NEXT (After Roosk is Running)

1. **Set up VMs** — Use the Roosk dashboard AI terminal to create VMs
2. **Enable SSL** — Point your domain to the server's public IP, then:
   ```bash
   certbot --nginx -d roosk.ai -d www.roosk.ai
   ```
3. **Configure AWS Bedrock** — Add your AWS credentials to `/opt/roosk/api-server/.env`
4. **Deploy services** — Use the Service Catalog to deploy WireGuard VPN, Windows Desktop, etc.
