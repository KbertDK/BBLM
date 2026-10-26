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
    ├── bbliga.bbgames.dk         → localhost:3000  (Production)
    ├── bbliga-staging.bbgames.dk → localhost:3001  (Staging)
    └── bbliga-dev.bbgames.dk     → localhost:3002  (Development)
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

At your domain registrar, add these A records, all pointing to your external IP:

```
bbliga.bbgames.dk          →  YOUR.EXTERNAL.IP
bbliga-staging.bbgames.dk  →  YOUR.EXTERNAL.IP
bbliga-dev.bbgames.dk      →  YOUR.EXTERNAL.IP
```

> These are all subdomains of `bbgames.dk` — no change needed to the apex/root domain itself, so whatever else may be running there (or planned for it) is unaffected.

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

> **Schema changes going forward:** the repo now has a baseline migration (`prisma/migrations/`)
> covering the full schema as of today, so `prisma migrate deploy` works on a fresh database.
> For any *future* schema change, generate a new migration on your dev machine and commit it —
> `prisma migrate dev` needs an interactive terminal, so from a script/CI shell use:
> `npx prisma migrate dev --create-only --name describe_the_change`, review the generated SQL in
> `prisma/migrations/`, then run it normally (`npx prisma migrate dev`) once, commit the folder,
> and `prisma migrate deploy` will pick it up on staging/prod. Don't go back to `prisma db push`
> once migrations exist — it bypasses migration history and the three databases will drift apart.

### Initial setup (do once per environment)

```powershell
# Production
cd C:\apps
git clone https://github.com/YOUR_USER/BBLM bblm-prod
cd bblm-prod
npm install
copy .env.example .env   # then edit it (see section 5)

# Staging
cd C:\apps
git clone https://github.com/YOUR_USER/BBLM bblm-staging
cd bblm-staging
npm install
copy .env.example .env

# Development
cd C:\apps
git clone https://github.com/YOUR_USER/BBLM bblm-dev
cd bblm-dev
npm install
copy .env.example .env
```

> Each checkout gets its own plain `.env` (not `.env.production`/`.env.staging`) — they're three separate directories, so there's no need for Next.js's environment-suffixed file names. `.env.example` is tracked in the repo as a template; the real `.env` files are gitignored.

### Run the database migrations for each environment

Run these from inside each app folder. Prisma reads `DATABASE_URL` from the `.env` file in that
folder automatically — no need to set it manually.

```powershell
cd C:\apps\bblm-prod
npx prisma migrate deploy   # applies prisma/migrations/ — safe to re-run, no-ops if already applied
npx prisma generate         # regenerate Prisma client after migrations
npx prisma db seed          # required — seeds skills/races/player types + the Weather/Casualty/
                             # Kick-off and Special Play Card reference tables the app depends on.
                             # This does NOT create any sample league/teams/coaches.

# Repeat for bblm-staging and bblm-dev
```

> For local development only, `npx ts-node prisma/seed-demo.ts` additionally creates a sample
> league with 3 demo coach accounts — all sharing the password `password123`. **Never run this
> against staging or production.**

#### If a migration shows as failed

If `prisma migrate deploy` reports a failed migration (P3009 error), check whether any tables
were created, then resolve it:

```powershell
# If no tables were created (migration fully failed — try again):
npx prisma migrate resolve --rolled-back "MIGRATION_NAME"
npx prisma migrate deploy

# If tables already exist (migration partially succeeded — mark as done):
npx prisma migrate resolve --applied "MIGRATION_NAME"
npx prisma migrate deploy

# For dev only — nuclear option, wipes everything and starts fresh:
npx prisma migrate reset
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

> **Note:** this app does not use NextAuth — it has its own JWT session (`lib/auth.ts`), which
> reads a single `AUTH_SECRET` variable. There is no `*_URL` variable to set.

### `C:\apps\bblm-prod\.env`

```env
DATABASE_URL="postgresql://bblm_prod_user:STRONG_PASSWORD@localhost:5432/bblm_prod"
AUTH_SECRET="generate-with-openssl-rand-base64-32"
NODE_ENV=production
PORT=3000
GEMINI_API_KEY="your-gemini-api-key"
```

### `C:\apps\bblm-staging\.env`

```env
DATABASE_URL="postgresql://bblm_staging_user:STRONG_PASSWORD@localhost:5432/bblm_staging"
AUTH_SECRET="a-different-secret-here"
NODE_ENV=production
PORT=3001
GEMINI_API_KEY="your-gemini-api-key"
```

### `C:\apps\bblm-dev\.env`

```env
DATABASE_URL="postgresql://bblm_dev_user:STRONG_PASSWORD@localhost:5432/bblm_dev"
AUTH_SECRET="another-different-secret"
NODE_ENV=production
PORT=3002
GEMINI_API_KEY="your-gemini-api-key"
```

> Generate a secret with PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Max 256 }))`
> Use a **different** `AUTH_SECRET` per environment — this signs the session cookie, so sharing
> one would let a prod session JWT be replayed against staging/dev (and vice versa).

> **Note on `PORT`:** The `PORT` variable in `.env` is not used by PM2 on Windows — the port is
> controlled by the `-p` flag in `ecosystem.config.js` instead. You can leave it in the `.env` for
> documentation purposes, but it has no effect at runtime.

> `GEMINI_API_KEY` powers the auto-generated post-match news recap (`lib/recap.ts`). Get a free
> key at https://aistudio.google.com. It's optional — if unset, match completion just skips
> generating a recap, with no error shown to coaches.

> Use a **different** `AUTH_SECRET` per environment — this signs the session cookie, so sharing
> one would let a prod session JWT be replayed against staging/dev (and vice versa).

> **Note on `PORT`:** The `PORT` variable in `.env` is not used by PM2 on Windows — the port is
> controlled by the `-p` flag in `ecosystem.config.js` instead. You can leave it in the `.env` for
> documentation purposes, but it has no effect at runtime.

> `GEMINI_API_KEY` powers the auto-generated post-match news recap (`lib/recap.ts`). Get a free
> key at https://aistudio.google.com. It's optional — if unset, match completion just skips
> generating a recap, with no error shown to coaches.

---

## 6. PM2 Process Manager

Install PM2 globally:

```powershell
npm install -g pm2
```

> **Do not install `pm2-windows-service`.** It is unmaintained and crashes immediately on Node.js 22+.
> Windows Task Scheduler (section 6b) is used instead to start PM2 on boot.

Create a single PM2 ecosystem config at `C:\apps\ecosystem.config.js`:

```js
module.exports = {
  apps: [
    {
      name: 'bblm-prod',
      cwd: 'C:/apps/bblm-prod',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3000',
      env_file: 'C:/apps/bblm-prod/.env',
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
    },
    {
      name: 'bblm-staging',
      cwd: 'C:/apps/bblm-staging',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3001',
      env_file: 'C:/apps/bblm-staging/.env',
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
    },
    {
      name: 'bblm-dev',
      cwd: 'C:/apps/bblm-dev',
      script: 'node_modules/next/dist/bin/next',
      args: 'start -p 3002',
      env_file: 'C:/apps/bblm-dev/.env',
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
    },
  ],
}
```

> **Windows gotcha:** Do not use `script: 'npm'` or `script: 'node_modules/.bin/next'` on Windows.
> Both resolve to `.cmd` batch files, which PM2 tries to execute as JavaScript — causing an
> immediate `SyntaxError: Unexpected token ':'` crash. `node_modules/next/dist/bin/next` is the
> actual JavaScript entry point and works correctly. The port is passed via `-p` in `args` rather
> than relying on the `PORT` env var, which PM2 did not reliably forward on Windows.

Start all three and save the process list:

```powershell
pm2 start C:\apps\ecosystem.config.js
pm2 save
```

---

## 6b. Auto-start PM2 on Reboot (Task Scheduler)

Run this once to register a scheduled task that runs `pm2 resurrect` every time Windows starts:

```powershell
$node = "C:\Program Files\nodejs\node.exe"
$pm2  = "C:\Users\Administrator\AppData\Roaming\npm\node_modules\pm2\bin\pm2"

$action = New-ScheduledTaskAction -Execute $node -Argument "$pm2 resurrect"

$trigger = New-ScheduledTaskTrigger -AtStartup

$principal = New-ScheduledTaskPrincipal `
    -UserId "SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

Register-ScheduledTask `
    -TaskName "PM2 Startup" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Force
```

Test it without rebooting:

```powershell
Start-ScheduledTask -TaskName "PM2 Startup"
Start-Sleep -Seconds 5
pm2 list   # all three apps should show as online
```

If you ever need to remove it:

```powershell
Unregister-ScheduledTask -TaskName "PM2 Startup" -Confirm:$false
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

### Install Caddy

**Option A — winget (recommended, adds Caddy to PATH system-wide):**

```powershell
winget install CaddyServer.Caddy
```

**Option B — Scoop:**

```powershell
scoop install caddy
```

**Option C — manual download** (if neither package manager is available):

```powershell
# Create the folder
New-Item -ItemType Directory -Force -Path C:\apps\caddy

# Download the latest Windows amd64 binary
Invoke-WebRequest -Uri "https://caddyserver.com/api/download?os=windows&arch=amd64" `
    -OutFile "C:\apps\caddy\caddy.exe"
```

> With winget or Scoop, `caddy` is available everywhere in PowerShell. With the manual download,
> prefix every command below with `C:\apps\caddy\` or `cd C:\apps\caddy` first.

Create the config folder if it doesn't exist yet:

```powershell
New-Item -ItemType Directory -Force -Path C:\apps\caddy
```

### `C:\apps\caddy\Caddyfile`

### `C:\apps\caddy\Caddyfile`

```
bbliga.bbgames.dk {
    reverse_proxy localhost:3000
    encode gzip
}

bbliga-staging.bbgames.dk {
    # Optional: restrict access to your office/home IP
    # @blocked not remote_ip 1.2.3.4
    # respond @blocked 403

    reverse_proxy localhost:3001
    encode gzip
}

bbliga-dev.bbgames.dk {
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

### Branch → environment mapping

| Git branch | Server folder | URL | Purpose |
|---|---|---|---|
| `dev` | `C:\apps\bblm-dev` | dev.yourdomain.com | Active development, first to receive changes |
| `staging` | `C:\apps\bblm-staging` | staging.yourdomain.com | Pre-production verification |
| `main` | `C:\apps\bblm-prod` | yourdomain.com | Live production |

Each server folder tracks its own branch. **New code always enters `dev` first, then promotes to `staging`, then to `main`/production.**

### Step 1 — Push your changes to dev

On your development machine, commit to the `dev` branch and push:

```powershell
git checkout dev
git add <files>
git commit -m "describe the change"
git push origin dev
```

### Step 2 — Deploy to dev environment (on the server)

```powershell
cd C:\apps\bblm-dev
git pull origin dev
npm install
npx prisma migrate deploy   # apply any new migrations (no-op if none)
npx prisma generate         # regenerate Prisma client
npm run build
pm2 restart bblm-dev
```

Test at **dev.yourdomain.com**. When satisfied, promote to staging.

### Step 3 — Promote to staging (on your machine)

```powershell
git checkout staging
git merge dev              # bring all dev changes across
git push origin staging
```

Then deploy on the server:

```powershell
cd C:\apps\bblm-staging
git pull origin staging
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart bblm-staging
```

Test at **staging.yourdomain.com**. When approved, promote to production.

### Step 4 — Promote to production (on your machine)

```powershell
git checkout main
git merge staging          # staging is now the source of truth for what goes live
git push origin main
```

Then deploy on the server:

```powershell
cd C:\apps\bblm-prod
git pull origin main
npm install
npx prisma migrate deploy
npx prisma generate
npm run build
pm2 restart bblm-prod
```

> **Important for team logos:** The `public\team-logos\` folder is NOT tracked by git and lives only inside each server folder. It survives `git pull` + `npm run build` because neither command touches it. **Never** `rm -rf` an app folder and re-clone — always pull in place or you will lose uploaded logos.

### Promotion flow at a glance

```
Local machine
  │  git push origin dev
  ▼
GitHub (dev branch)
  │  git pull origin dev  →  npm install + build  →  pm2 restart bblm-dev
  ▼
dev.yourdomain.com  ──── test ────┐
                                  │ pass
                             git merge dev → staging
                             git push origin staging
                                  │
                             git pull origin staging  →  build  →  pm2 restart bblm-staging
                                  ▼
                        staging.yourdomain.com  ──── approve ────┐
                                                                  │ pass
                                                             git merge staging → main
                                                             git push origin main
                                                                  │
                                                             git pull origin main  →  build  →  pm2 restart bblm-prod
                                                                  ▼
                                                             yourdomain.com  (production)
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

### First admin login

The seed script creates one admin account:

| Field | Value |
|---|---|
| Email | `admin@bbgames.dk` |
| Password | `Admin123` |
| Role | ADMIN |

**Change this password immediately after first login** via League Management → Coaches.

Additional coaches and admins are created in the app under **League Management → Coaches** once you are logged in as ADMIN.

#### If you are locked out (forgotten admin password)

Generate a new bcrypt hash and update it directly in the database:

```powershell
# Step 1 — generate a hash for your new password
cd C:\apps\bblm-prod
node -e "require('bcryptjs').hash('YourNewPassword', 10, (e,h) => console.log(h))"

# Step 2 — paste the printed hash into this psql command
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -d bblm_prod -c `
  "UPDATE ""Coach"" SET ""passwordHash"" = 'PASTE_HASH_HERE' WHERE email = 'admin@bbgames.dk';"
```

---

### Commands

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
