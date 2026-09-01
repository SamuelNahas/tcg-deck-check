#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v ssh >/dev/null 2>&1; then
  echo "Instale o SSH com: sudo apt install -y openssh-client"
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Instale o curl com: sudo apt install -y curl"
  exit 1
fi

if ! curl --fail --silent http://127.0.0.1:8080/api/health >/dev/null; then
  echo "A aplicação não está ativa. Rode primeiro: ./scripts/start-deckcheck.sh"
  exit 1
fi

echo "Copie a URL HTTPS mostrada abaixo e abra-a no iPhone e no iPad."
echo "Mantenha este terminal aberto; Ctrl+C encerra o túnel."

exec ssh \
  -o ServerAliveInterval=30 \
  -o ServerAliveCountMax=3 \
  -o ExitOnForwardFailure=yes \
  -o StrictHostKeyChecking=accept-new \
  -R 80:127.0.0.1:8080 \
  nokey@localhost.run
