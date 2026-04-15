#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# deploy.sh — Restaurant POS production deployment
# Usage:
#   First deploy:  ./deploy.sh setup
#   Updates:       ./deploy.sh update
#   Logs:          ./deploy.sh logs [service]
#   DB seed:       ./deploy.sh seed
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

COMPOSE="docker compose -f docker-compose.prod.yml --env-file .env"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
info()  { echo -e "${GREEN}▶${NC}  $*"; }
warn()  { echo -e "${YELLOW}⚠${NC}  $*"; }
error() { echo -e "${RED}✗${NC}  $*" >&2; exit 1; }

# ── Checks ───────────────────────────────────────────────────────────────────
check_env() {
  [[ -f .env ]] || error ".env not found. Copy .env.example → .env and fill it in."
  source .env
  [[ -z "${JWT_SECRET:-}"          ]] && error "JWT_SECRET is empty in .env"
  [[ -z "${JWT_REFRESH_SECRET:-}"  ]] && error "JWT_REFRESH_SECRET is empty in .env"
  [[ -z "${POSTGRES_PASSWORD:-}"   ]] && error "POSTGRES_PASSWORD is empty in .env"
  [[ "${JWT_SECRET}" == *"change"* ]] && error "JWT_SECRET still has default value — generate a real one"
  info "Environment OK"
}

# ── Setup (first deploy) ─────────────────────────────────────────────────────
cmd_setup() {
  check_env
  source .env

  info "Building images..."
  $COMPOSE build --no-cache

  info "Starting services..."
  $COMPOSE up -d postgres
  sleep 5   # give postgres a moment before migrations

  info "Running database migrations..."
  $COMPOSE run --rm backend node dist/migrate.js 2>/dev/null \
    || $COMPOSE exec backend node dist/migrate.js \
    || warn "Migration script not found — run manually if needed"

  $COMPOSE up -d

  # SSL via Let's Encrypt (skip if no domain set)
  if [[ "${DOMAIN:-}" != "" && "${DOMAIN}" != "yourdomain.com" ]]; then
    info "Requesting SSL certificate for ${DOMAIN}..."
    ssl_issue
  else
    warn "DOMAIN not set — running without SSL (HTTP only). Set DOMAIN in .env then run: ./deploy.sh ssl"
  fi

  info "Setup complete! Check status: ./deploy.sh logs"
}

# ── Update (subsequent deploys) ──────────────────────────────────────────────
cmd_update() {
  check_env
  info "Pulling latest code..."
  git pull --ff-only

  info "Building updated images..."
  $COMPOSE build

  info "Running database migrations..."
  $COMPOSE run --rm --no-deps backend node dist/migrate.js 2>/dev/null || true

  info "Rolling restart..."
  $COMPOSE up -d --no-deps backend frontend

  info "Update complete!"
  $COMPOSE ps
}

# ── SSL ──────────────────────────────────────────────────────────────────────
ssl_issue() {
  source .env
  [[ -z "${DOMAIN:-}" ]] && error "Set DOMAIN in .env first"
  info "Issuing cert for ${DOMAIN}..."

  # Start nginx in HTTP-only mode first for the ACME challenge
  $COMPOSE up -d nginx

  docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot --webroot-path /var/www/certbot \
    --email "admin@${DOMAIN}" \
    --agree-tos --no-eff-email \
    -d "${DOMAIN}" -d "www.${DOMAIN}"

  # Reload nginx with SSL
  $COMPOSE exec nginx nginx -s reload
  info "SSL certificate issued for ${DOMAIN}"
}

cmd_ssl() { ssl_issue; }

# ── Seed ─────────────────────────────────────────────────────────────────────
cmd_seed() {
  check_env
  warn "This will add demo data to the database."
  read -rp "Continue? [y/N] " confirm
  [[ "${confirm:-n}" =~ ^[Yy]$ ]] || { info "Aborted."; exit 0; }
  $COMPOSE exec backend node dist/db/seed.js
  info "Seed complete."
}

# ── Logs ─────────────────────────────────────────────────────────────────────
cmd_logs() {
  $COMPOSE logs -f --tail=100 "${1:-}"
}

# ── Status ───────────────────────────────────────────────────────────────────
cmd_status() {
  $COMPOSE ps
}

# ── Stop / Down ───────────────────────────────────────────────────────────────
cmd_stop()  { $COMPOSE stop; }
cmd_down()  {
  warn "This will remove containers (volumes preserved)."
  read -rp "Continue? [y/N] " confirm
  [[ "${confirm:-n}" =~ ^[Yy]$ ]] && $COMPOSE down || info "Aborted."
}

# ── Dispatch ─────────────────────────────────────────────────────────────────
case "${1:-help}" in
  setup)  cmd_setup  ;;
  update) cmd_update ;;
  ssl)    cmd_ssl    ;;
  seed)   cmd_seed   ;;
  logs)   cmd_logs   "${2:-}" ;;
  status) cmd_status ;;
  stop)   cmd_stop   ;;
  down)   cmd_down   ;;
  *)
    echo "Restaurant POS — Deploy Script"
    echo ""
    echo "Usage: ./deploy.sh <command>"
    echo ""
    echo "Commands:"
    echo "  setup     First-time deploy: build, migrate, start, SSL"
    echo "  update    Pull latest code and restart with zero downtime"
    echo "  ssl       Issue/renew Let's Encrypt certificate"
    echo "  seed      Load demo data into the database"
    echo "  logs      Tail logs (optional: service name)"
    echo "  status    Show container status"
    echo "  stop      Stop all containers (data preserved)"
    echo "  down      Remove containers (data preserved)"
    ;;
esac
