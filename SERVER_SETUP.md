# Server Setup Guide — BBLM on Windows Server

## Overview

This guide covers running **three isolated environments** (Production, Staging, Development) on a single Windows Server machine with one external IP address.

```
Internet
    │
    ▼
[Router] — NAT ports 80+443 → Windows Server
    │
    ▼
[Caddy]  — reverse proxy, auto-HTTPS via Let's Encrypt
    ├── bblm.yourdomain.com      → localhost:3000  (Production)
    ├── staging.yourdomain.com   → localhost:3001  (Staging)
    └── dev.yourdomain.com       → localhost:3002  (Development)
         │                (dev subdomain can be IP-restricted)
[PM2]    — three Node.js processes, one per environment
    │
[PostgreSQL] — three separate databases
    ├── bblm_prod
    ├── bblm_staging
    └── bblm_dev
```

**Cost:** Free software stack. Only cost is the Windows Server license you already have.

---

## 1. Prerequisites

### Software to install

| Software | Version | Download |
|---|---|---|
| Node.js | LTS (22.x) | nodejs.org |
| PostgreSQL | 16.x | postgresql.org |
| Caddy | Latest stable | caddyserver.com/download |
| Git | Latest | git-scm.com |

### Folder structure

```
C:\apps\
    ├── bblm-prod\       ← production checkout
    ├── bblm-staging\    ← staging checkout
    ├── bblm-dev\        ← development checkout
    └── caddy\
            caddy.exe
            Caddyfile
```

---

## 2. DNS Configuration

At your domain registrar, add three A records, all pointing to your external IP:

```
bblm.yourdomain.com         →  YOUR.EXTERNAL.IP
staging.yourdomain.com      →  YOUR.EXTERNAL.IP
dev.yourdomain.com          →  YOUR.EXTERNAL.IP
```

On your router: forward **ports 80 and 443** to the Windows Server's internal IP address. Leave all other ports closed externally.

---

## 3. PostgreSQL Setup

Open **psql** or **pgAdmin** and create three isolated databases, each with its own user:

```sql
-- Production
CREATE USER bblm_prod_user WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE bblm_prod OWNER bblm_prod_user;

-- Staging
CREATE USER bblm_staging_user WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE bblm_staging OWNER bblm_staging_user;

-- Development
CREATE USER bblm_dev_user WITH PASSWORD 'choose-a-strong-password';
CREATE DATABASE bblm_dev OWNER bblm_dev_user;
```

PostgreSQL listens only on `localhost` by default — do **not** change this. It should never be reachable from the internet.

---

## 4. Code Deployment

### Initial setup (do once per environment)

```powershell
# Production
cd C:\apps
git clone https://github.com/YOUR_USER/BBLM bblm-prod
cd bblm-prod
npm install
copy .env.example .env.production   # then edit it (see section 5)

# Staging
cd C:\apps
git clone https://github.com/YOUR_USER/BBLM bblm-staging
cd bblm-staging
npm install
copy .env.example .env.staging

# Development
cd C:\apps
git clone https://github.com/YOUR_USER/BBLM bblm-dev
cd bblm-dev
npm install
copy .env.example .env.development
```

### Run the database migrations for each environment

```powershell
# From each app folder, using its own .env file:
$env:DATABASE_URL="postgresql://bblm_prod_user:password@localhost:5432/bblm_prod"
npx prisma migrate deploy
npx prisma db seed   # if you want seed data
```

### Build

```powershell
# Production
cd C:\apps\bblm-prod
npm run build

# Staging
cd C:\apps\bblm-staging
npm run build

# Development (can run in dev mode if preferred)
cd C:\apps\bblm-dev
npm run build
```

---

## 5. Environment Files

Each checkout has its own `.env` file. **Never commit these.**

### `C:\apps\bblm-prod\.env`

```env
DATABASE_URL="postgresql://bblm_prod_user:STRONG_PASSWORD@localhost:5432/bblm_prod"
NEXTAUTH_URL="https://bblm.yourdomain.com"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"
NODE_ENV=production
PORT=3000
```

### `C:\apps\bblm-staging\.env`

```env
DATABASE_URL="postgresql://bblm_staging_user:STRONG_PASSWORD@localhost:5432/bblm_staging"
NEXTAUTH_URL="https://staging.yourdomain.com"
NEXTAUTH_SECRET="a-different-secret-here"
NODE_ENV=production
PORT=3001
```

### `C:\apps\bblm-dev\.env`

```env
DATABASE_URL="postgresql://bblm_dev_user:STRONG_PASSWORD@localhost:5432/bblm_dev"
NEXTAUTH_URL="https://dev.yourdomain.com"
NEXTAUTH_SECRET="another-different-secret"
NODE_ENV=production
PORT=3002
```

> Generate a secret with PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))`

---

## 6. PM2 Process Manager

Install PM2 and the Windows service wrapper globally:

```powershell
npm install -g pm2 pm2-windows-service
```

Create a single PM2 ecosystem config at `C:\apps\ecosystem.config.js`:

```js
module.exports = {
  apps: [
    {
      name: 'bblm-prod',
      cwd: 'C:/apps/bblm-prod',
      script: 'node_modules/.bin/next',
      args: 'start',
      env_file: 'C:/apps/bblm-prod/.env',
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'bblm-staging',
      cwd: 'C:/apps/bblm-staging',
      script: 'node_modules/.bin/next',
      args: 'start',
      env_file: 'C:/apps/bblm-staging/.env',
      instances: 1,
      autorestart: true,
      watch: false,
    },
    {
      name: 'bblm-dev',
      cwd: 'C:/apps/bblm-dev',
      script: 'node_modules/.bin/next',
      args: 'start',
      env_file: 'C:/apps/bblm-dev/.env',
      instances: 1,
      autorestart: true,
      watch: false,
    },
  ],
}
```

Start all three and save the process list:

```powershell
pm2 start C:\apps\ecosystem.config.js
pm2 save
```

Install PM2 as a Windows Service so it survives reboots:

```powershell
pm2-service-install
```

### Useful PM2 commands

```powershell
pm2 list                        # show all processes and status
pm2 logs bblm-prod              # tail production logs
pm2 restart bblm-staging        # restart staging after a deploy
pm2 stop bblm-dev               # stop dev without removing it
```

---

## 7. Caddy — Reverse Proxy + Automatic HTTPS

Place `caddy.exe` and a `Caddyfile` in `C:\apps\caddy\`.

### `C:\apps\caddy\Caddyfile`

```
bblm.yourdomain.com {
    reverse_proxy localhost:3000
    encode gzip
}

staging.yourdomain.com {
    # Optional: restrict access to your office/home IP
    # @blocked not remote_ip 1.2.3.4
    # respond @blocked 403

    reverse_proxy localhost:3001
    encode gzip
}

dev.yourdomain.com {
    # Restrict dev to your IP only — no public access
    @allowed remote_ip 1.2.3.4
    reverse_proxy @allowed localhost:3002
    respond 403

    encode gzip
}
```

Replace `1.2.3.4` with your office/home IP for staging/dev restrictions.

### Test the config

```powershell
cd C:\apps\caddy
.\caddy.exe validate --config Caddyfile
.\caddy.exe run --config Caddyfile   # Ctrl+C to stop after testing
```

### Install Caddy as a Windows Service

```powershell
cd C:\apps\caddy
.\caddy.exe windows-service install
Start-Service caddy

# Set to auto-start on boot
Set-Service -Name caddy -StartupType Automatic
```

On first browser visit, Caddy automatically fetches a free Let's Encrypt certificate for each domain. Port 80 is kept open only to complete the certificate challenge; all traffic is then redirected to HTTPS.

---

## 8. Windows Firewall

Only ports 80 and 443 should be reachable from the internet. All other ports (3000, 3001, 3002, 5432) stay local-only.

```powershell
# Allow HTTP and HTTPS inbound
New-NetFirewallRule -DisplayName "HTTP"  -Direction Inbound -Protocol TCP -LocalPort 80  -Action Allow
New-NetFirewallRule -DisplayName "HTTPS" -Direction Inbound -Protocol TCP -LocalPort 443 -Action Allow

# Block direct Node.js access from outside (redundant but explicit)
New-NetFirewallRule -DisplayName "Block Node Direct" -Direction Inbound -Protocol TCP -LocalPort 3000,3001,3002 -RemoteAddress Internet -Action Block

# PostgreSQL: localhost only (default — do not add a firewall rule for it)
```

On your router, **only forward ports 80 and 443** to the server. Do not forward 3000–3002 or 5432.

---

## 9. Deployment Workflow

### Promoting a change to an environment

```powershell
# Example: deploy the main branch to staging
cd C:\apps\bblm-staging
git pull origin main
npm install --omit=dev
npx prisma migrate deploy   # run any new DB migrations
npx prisma generate         # regenerate Prisma client
npm run build
pm2 restart bblm-staging
```

> **Important for team logos:** The `public\team-logos\` folder is inside each app directory and is NOT tracked by git. It is preserved across `git pull` + `npm run build` because neither command touches it. Never `rm -rf` the app folder and re-clone — always pull in place.

### Typical promotion flow

```
[Developer machine] → git push → GitHub
                                   │
                           git pull on dev env
                           test on dev.yourdomain.com
                                   │
                        (approved) ▼
                           git pull on staging
                           test on staging.yourdomain.com
                                   │
                        (approved) ▼
                           git pull on production
                           zero-downtime via PM2 restart
```

---

## 10. Backups

Schedule both tasks in **Windows Task Scheduler** (daily, off-peak hours).

### Database backup script — `C:\apps\backup\backup-db.ps1`

```powershell
$date = Get-Date -Format "yyyyMMdd"
$backupDir = "C:\apps\backup\db"
New-Item -ItemType Directory -Force -Path $backupDir

& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" `
    -U postgres bblm_prod | Out-File "$backupDir\prod-$date.sql" -Encoding utf8

& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" `
    -U postgres bblm_staging | Out-File "$backupDir\staging-$date.sql" -Encoding utf8

# Keep 14 days of backups
Get-ChildItem $backupDir -Filter "*.sql" |
    Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-14) } |
    Remove-Item -Force
```

### Logo backup script — `C:\apps\backup\backup-logos.ps1`

```powershell
$date = Get-Date -Format "yyyyMMdd"
$dest = "C:\apps\backup\logos\$date"
Copy-Item "C:\apps\bblm-prod\public\team-logos" -Destination $dest -Recurse -Force
```

### Offsite backup

Copy `C:\apps\backup\` to a NAS, external drive, or a free-tier cloud bucket (e.g. Backblaze B2) weekly. The folder is small (SQL dumps + a handful of images).

---

## 11. Keeping Things Up to Date

```powershell
# Update Node.js: download installer from nodejs.org and re-run it
# PM2 updates itself:
npm install -g pm2@latest
pm2 update

# Windows updates: run normally — PM2 service restarts automatically on reboot
```

---

## 12. Quick Reference

| What | Command |
|---|---|
| See all running apps | `pm2 list` |
| Tail prod logs | `pm2 logs bblm-prod` |
| Restart production | `pm2 restart bblm-prod` |
| Restart all | `pm2 restart all` |
| Check Caddy status | `Get-Service caddy` |
| Reload Caddy config | `& 'C:\apps\caddy\caddy.exe' reload --config C:\apps\caddy\Caddyfile` |
| Test DB connection | `psql -U bblm_prod_user -d bblm_prod -h localhost -c "\l"` |
| Manual DB backup | `.\backup-db.ps1` |
