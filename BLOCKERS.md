# BLOCKERS — RooskAI Platform Deployment

All blockers resolved as of 2026-03-18 05:17 UTC.

## [RESOLVED] Prometheus cross-VLAN scraping
**Fix:** `ufw allow from 10.0.0.0/8` on all 10 VMs. 12/12 targets UP.

## [RESOLVED] AWS Bedrock credentials
**Fix:** Credentials from Proxmox host `~/.aws/credentials` deployed to VM-APP-01 `.env` and Vault. Health: "healthy".

## [RESOLVED] Cloudflare Tunnel authentication
**Fix:** Tunnel `rooskai-tunnel` (ID: 5edfa4d2-8f52-4c78-9cab-27c92b79aa56) created with 10 DNS CNAME records. All subdomains live via Cloudflare.
