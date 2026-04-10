#!/bin/bash
# QA environment deploy — called by webhook after git reset --hard origin/qa
set -euo pipefail

COMPOSE="docker compose -f docker-compose.qa.yml --env-file .env"

info() { echo "▶  $*"; }

[[ -f .env ]] || { echo "✗  .env not found"; exit 1; }
source .env
[[ -z "${JWT_SECRET:-}" ]] && { echo "✗  JWT_SECRET missing"; exit 1; }

info "Building images..."
$COMPOSE build

info "Running migrations..."
$COMPOSE run --rm --no-deps backend node dist/migrate.js 2>/dev/null || true

info "Restarting services..."
$COMPOSE up -d --remove-orphans

info "QA deploy complete!"
$COMPOSE ps
