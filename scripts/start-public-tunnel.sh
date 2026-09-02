#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ ! -f .env ] || ! grep -q '^NGROK_DOMAIN=.' .env || ! grep -q '^NGROK_AUTHTOKEN=.' .env; then
  echo "O ngrok ainda não foi configurado. Rode uma única vez:"
  echo "./scripts/setup-ngrok.sh"
  exit 1
fi

NGROK_DOMAIN_VALUE="$(sed -n 's/^NGROK_DOMAIN=//p' .env | tail -n 1)"

docker compose up -d
docker compose --profile public up -d ngrok

echo "Túnel permanente ativo em https://$NGROK_DOMAIN_VALUE"
echo "Ele está em segundo plano; este terminal pode ser fechado."
