#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-$(pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.hostinger.yml}"
COMPOSE_ENV_FILE="${COMPOSE_ENV_FILE:-.env}"
COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-travelcrm-frontend}"
TRAVELCRM_FRONTEND_IMAGE="${TRAVELCRM_FRONTEND_IMAGE:-${IMAGE_TAG:-}}"
PRUNE_OLD_IMAGES="${PRUNE_OLD_IMAGES:-true}"

cd "${APP_DIR}"

if [ -z "${TRAVELCRM_FRONTEND_IMAGE}" ]; then
  echo "TRAVELCRM_FRONTEND_IMAGE is required, for example docker.io/user/travelcrm-frontend:<git-sha>." >&2
  exit 1
fi

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "Missing ${APP_DIR}/${COMPOSE_FILE}." >&2
  exit 1
fi

if [ ! -f "${COMPOSE_ENV_FILE}" ]; then
  echo "Missing ${APP_DIR}/${COMPOSE_ENV_FILE}. Copy deploy/hostinger.compose.env.example and fill it on the VPS." >&2
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "Docker Compose v2 is required. Install the docker-compose-plugin package on the VPS." >&2
  exit 1
fi

if [ -n "${DOCKERHUB_USERNAME:-}" ] && [ -n "${DOCKERHUB_TOKEN:-}" ]; then
  printf '%s' "${DOCKERHUB_TOKEN}" | docker login -u "${DOCKERHUB_USERNAME}" --password-stdin >/dev/null
fi

export TRAVELCRM_FRONTEND_IMAGE
compose=(docker compose --project-name "${COMPOSE_PROJECT_NAME}" --env-file "${COMPOSE_ENV_FILE}" -f "${COMPOSE_FILE}")

echo "Deploying ${TRAVELCRM_FRONTEND_IMAGE}"
"${compose[@]}" pull
"${compose[@]}" up -d --remove-orphans

web_container="$("${compose[@]}" ps -q web)"
if [ -z "${web_container}" ]; then
  echo "Compose did not create a web container." >&2
  "${compose[@]}" ps
  exit 1
fi

echo "Waiting for frontend health check..."
for _ in $(seq 1 30); do
  health="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}unknown{{end}}' "${web_container}" 2>/dev/null || true)"
  if [ "${health}" = "healthy" ]; then
    echo "Deployment healthy."
    "${compose[@]}" ps
    if [ "${PRUNE_OLD_IMAGES}" = "true" ]; then
      docker image prune -f --filter "until=168h" >/dev/null || true
    fi
    exit 0
  fi
  if [ "${health}" = "unhealthy" ]; then
    echo "Frontend container became unhealthy." >&2
    "${compose[@]}" logs --tail=120 web >&2
    exit 1
  fi
  sleep 5
done

echo "Timed out waiting for a healthy frontend container." >&2
"${compose[@]}" ps >&2
"${compose[@]}" logs --tail=120 web >&2
exit 1
