#!/bin/bash
set -euo pipefail

# Usage: ./deploy.sh [image-tag]
# Requires: GITHUB_REPO, POSTGRES_PASSWORD, BETTER_AUTH_SECRET, VAPID_PUBLIC_KEY, SSH_HOST env vars
# Example: GITHUB_REPO=yourusername/restaurant-app SSH_HOST=user@server.com ./deploy.sh

IMAGE_TAG="${1:-$(git rev-parse --short HEAD)}"
GITHUB_REPO="${GITHUB_REPO:?GITHUB_REPO is required}"
SSH_HOST="${SSH_HOST:?SSH_HOST is required}"

echo "→ Building images (tag: $IMAGE_TAG)"

# Build server
docker build \
  -t "ghcr.io/${GITHUB_REPO}/server:${IMAGE_TAG}" \
  -t "ghcr.io/${GITHUB_REPO}/server:latest" \
  -f apps/server/Dockerfile \
  .

# Build web
docker build \
  --build-arg VITE_API_URL="" \
  --build-arg VITE_BASE_PATH="/restaurant/" \
  --build-arg VITE_VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY:-}" \
  -t "ghcr.io/${GITHUB_REPO}/web:${IMAGE_TAG}" \
  -t "ghcr.io/${GITHUB_REPO}/web:latest" \
  -f apps/web/Dockerfile \
  .

echo "→ Pushing to GHCR"
docker push "ghcr.io/${GITHUB_REPO}/server:${IMAGE_TAG}"
docker push "ghcr.io/${GITHUB_REPO}/server:latest"
docker push "ghcr.io/${GITHUB_REPO}/web:${IMAGE_TAG}"
docker push "ghcr.io/${GITHUB_REPO}/web:latest"

echo "→ Deploying to ${SSH_HOST}"
ssh "${SSH_HOST}" bash -s <<EOF
  cd ~/restaurant-app
  export IMAGE_TAG="${IMAGE_TAG}"
  export GITHUB_REPO="${GITHUB_REPO}"
  docker compose -f docker-compose.prod.yml pull
  docker compose -f docker-compose.prod.yml up -d --remove-orphans
  docker image prune -f
  echo "Deployment complete: ${IMAGE_TAG}"
EOF

echo "✓ Deployed restaurant-app:${IMAGE_TAG}"
