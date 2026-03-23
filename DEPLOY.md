# Deployment Guide

Self-hosted production deployment on a Hetzner (or any Linux) VPS using Docker Compose + nginx + Let's Encrypt.

---

## Architecture

```
Internet
   │
   ▼
nginx (:443 SSL / :80 → redirect)
   ├── /api/*        → backend:3000  (Express + Socket.IO)
   ├── /socket.io/*  → backend:3000  (WebSocket upgrade)
   └── /*            → frontend:80   (nginx serving built React SPA)
                           │
                      postgres:5432  (internal only)
```

All services run in a single Docker Compose stack on one VPS.
Estimated cost: **~$5-6/mo** (Hetzner CX22 or equivalent).

---

## 1. Provision the VPS

**Minimum specs:** 2 vCPU, 4 GB RAM, 40 GB disk, Ubuntu 24.04 LTS

```bash
# On Hetzner: create a CX22 server with Ubuntu 24.04
# Point your domain's A record to the server IP before continuing
```

---

## 2. Server Initial Setup

SSH into your server as root, then:

```bash
# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker

# Install git + make (optional but useful)
apt install -y git

# Create a deploy user (never run as root in prod)
useradd -m -s /bin/bash deploy
usermod -aG docker deploy
passwd deploy

# Switch to deploy user from here
su - deploy
```

---

## 3. Clone and Configure

```bash
# Clone the repo
git clone <your-repo-url> restaurant-pos
cd restaurant-pos

# Create .env from template
cp .env.example .env

# Edit .env — fill in EVERY value
nano .env
```

### Generating secrets

```bash
# Generate JWT_SECRET
openssl rand -base64 48

# Generate JWT_REFRESH_SECRET (different value)
openssl rand -base64 48
```

### Minimum `.env` for production

```dotenv
POSTGRES_USER=restaurant_user
POSTGRES_PASSWORD=<strong random password>
POSTGRES_DB=restaurant_pos

JWT_SECRET=<output of openssl rand -base64 48>
JWT_REFRESH_SECRET=<different output of openssl rand -base64 48>

DOMAIN=yourdomain.com
```

---

## 4. Generate Database Migrations

This step is done **once on your local machine** before the first deploy, then committed:

```bash
# On your local machine (with DB running via docker compose up postgres)
cd backend
npm run db:generate   # generates SQL files in src/db/migrations/

# Commit the generated migrations
git add src/db/migrations/
git commit -m "add: initial database migrations"
git push
```

> The server will auto-apply migrations on every startup via `drizzle-kit migrate`.

---

## 5. First Deploy

```bash
# On the server
chmod +x deploy.sh
./deploy.sh setup
```

This will:
1. Build all Docker images (multi-stage, ~3-5 min)
2. Start PostgreSQL
3. Apply database migrations
4. Start all services
5. Issue an SSL certificate (if `DOMAIN` is set)

---

## 6. Load Demo Data (optional)

```bash
./deploy.sh seed
```

Creates a demo restaurant with:
- `admin@demo.com` / `password123`
- `waiter@demo.com` / `password123`
- `kitchen@demo.com` / `password123`

**Remove or change these credentials before going live.**

---

## 7. Verify

```bash
# Check all containers are running
./deploy.sh status

# Tail logs
./deploy.sh logs

# Health check
curl https://yourdomain.com/api/health
# → {"status":"ok","timestamp":"..."}
```

---

## Updating the App

```bash
# On the server
./deploy.sh update
```

This pulls the latest code, rebuilds only changed images, applies any new migrations, and restarts containers with zero downtime (backend and frontend restart one at a time behind nginx).

---

## SSL Certificate Renewal

Certbot renews automatically every 12 hours (via the `certbot` service in docker-compose.prod.yml). To force a renewal manually:

```bash
./deploy.sh ssl
```

---

## Useful Commands

```bash
./deploy.sh logs backend    # backend logs only
./deploy.sh logs nginx      # nginx access/error logs
./deploy.sh logs postgres   # DB logs

./deploy.sh status          # container health

# Drop into a running container
docker compose -f docker-compose.prod.yml exec backend sh
docker compose -f docker-compose.prod.yml exec postgres psql -U $POSTGRES_USER $POSTGRES_DB

# Manual backup
docker compose -f docker-compose.prod.yml exec postgres \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup_$(date +%Y%m%d).sql
```

---

## Multiple Restaurants (Multi-tenant)

The app already supports multiple restaurants via `restaurant_id` on every table. Each restaurant gets its own admin user. To onboard a new restaurant:

1. Create a restaurant row in the `restaurants` table
2. Create an admin user linked to that restaurant
3. The admin can then create their own staff, menu, and tables from the UI

There's no shared data between restaurants — isolation is enforced at the query level.

---

## Production Checklist

Before going live with a real restaurant:

- [ ] `.env` has strong, unique secrets (not the defaults)
- [ ] Domain points to the VPS and SSL is active
- [ ] Demo seed data removed or credentials changed
- [ ] At least one admin account created with a real password
- [ ] Automatic daily database backups configured (see below)
- [ ] Server firewall allows only ports 22, 80, 443

### Automated Backups (recommended)

```bash
# Add to crontab on the server (crontab -e)
0 3 * * * cd /home/deploy/restaurant-pos && \
  docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U $POSTGRES_USER $POSTGRES_DB \
  | gzip > /home/deploy/backups/backup_$(date +\%Y\%m\%d).sql.gz
```

---

## Reusing This Stack for Other Projects

This deployment setup is intentionally generic. To reuse it:

1. Replace the `backend/` and `frontend/` source with your new project
2. Update `nginx/nginx.conf` if you need different routing rules
3. Update `.env.example` with project-specific variables
4. Run `./deploy.sh setup` on a fresh VPS

The `deploy.sh` script, `docker-compose.prod.yml`, and nginx config work for any Node.js + React + PostgreSQL project.
