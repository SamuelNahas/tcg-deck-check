#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não foi encontrado. Instale o Docker Engine e tente novamente."
  exit 1
fi

if [ ! -f .env ]; then
  DECKCHECK_GENERATED_PASSWORD="$(openssl rand -hex 10)"
  printf 'DECKCHECK_APP_PASSWORD=%s\nDECKCHECK_SECURE_COOKIES=false\n' "$DECKCHECK_GENERATED_PASSWORD" > .env
  chmod 600 .env
  echo "Senha criada: $DECKCHECK_GENERATED_PASSWORD"
  echo "Guarde-a para entrar pelo computador e pelo iPad."
fi

docker compose up -d --build
# Recarrega o DNS dos serviços quando API ou frontend foram recriados.
docker compose restart proxy

if grep -q '^NGROK_DOMAIN=.' .env && grep -q '^NGROK_AUTHTOKEN=.' .env; then
  docker compose --profile public up -d ngrok
fi

echo ""
echo "TCG Deck Check está iniciando em http://localhost:8080"
if grep -q '^NGROK_DOMAIN=.' .env; then
  NGROK_DOMAIN_VALUE="$(sed -n 's/^NGROK_DOMAIN=//p' .env | tail -n 1)"
  echo "Endereço público fixo: https://$NGROK_DOMAIN_VALUE"
else
  echo "Para configurar um endereço público fixo, rode: ./scripts/setup-ngrok.sh"
fi
