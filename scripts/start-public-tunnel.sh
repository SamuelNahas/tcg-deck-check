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

health_url="http://127.0.0.1:8080/api/health"
application_ready=false

echo "Aguardando a aplicação ficar pronta..."
for _attempt in $(seq 1 30); do
  if curl --fail --silent --max-time 2 "$health_url" >/dev/null; then
    application_ready=true
    break
  fi
  sleep 1
done

if [[ "$application_ready" != "true" ]]; then
  echo "A aplicação não respondeu em http://localhost:8080 após 30 segundos."
  echo "Confira os serviços com: docker compose ps"
  echo "Confira os logs com: docker compose logs --tail=50 proxy api frontend"
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
