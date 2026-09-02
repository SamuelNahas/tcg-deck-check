#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_NAME="${COMPOSE_PROJECT_NAME:-tcg-deck-check}"
ENV_FILE="${DECKCHECK_ENV_FILE:-/home/samuca/tcg-deck-check/.env}"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não está disponível para o usuário do runner."
  exit 1
fi

if [ ! -r "$ENV_FILE" ]; then
  echo "Arquivo de configuração não encontrado ou sem permissão: $ENV_FILE"
  exit 1
fi

if ! grep -q '^DECKCHECK_APP_PASSWORD=.' "$ENV_FILE"; then
  echo "DECKCHECK_APP_PASSWORD não está definido no arquivo de configuração."
  exit 1
fi

COMPOSE=(
  docker compose
  --project-name "$PROJECT_NAME"
  --env-file "$ENV_FILE"
  --profile public
)

"${COMPOSE[@]}" config --quiet
"${COMPOSE[@]}" build
"${COMPOSE[@]}" up -d --remove-orphans

APPLICATION_READY=false
for _attempt in $(seq 1 90); do
  if curl --fail --silent --max-time 3 http://127.0.0.1:8080/api/health >/dev/null; then
    APPLICATION_READY=true
    break
  fi
  sleep 2
done

if [ "$APPLICATION_READY" != "true" ]; then
  echo "A nova versão não respondeu após 180 segundos."
  "${COMPOSE[@]}" ps
  "${COMPOSE[@]}" logs --tail=100 proxy api frontend
  exit 1
fi

NGROK_DOMAIN_VALUE="$(sed -n 's/^NGROK_DOMAIN=//p' "$ENV_FILE" | tail -n 1)"
if [ -n "$NGROK_DOMAIN_VALUE" ]; then
  PUBLIC_READY=false
  for _attempt in $(seq 1 30); do
    if curl --fail --silent --max-time 5 \
      -H 'ngrok-skip-browser-warning: 1' \
      "https://$NGROK_DOMAIN_VALUE/api/health" >/dev/null; then
      PUBLIC_READY=true
      break
    fi
    sleep 2
  done

  if [ "$PUBLIC_READY" != "true" ]; then
    echo "O app está saudável localmente, mas o endereço público não respondeu."
    "${COMPOSE[@]}" logs --tail=100 ngrok
    exit 1
  fi
fi

"${COMPOSE[@]}" ps
echo "Deploy concluído e verificado."
