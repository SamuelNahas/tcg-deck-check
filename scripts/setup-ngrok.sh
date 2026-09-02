#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker não foi encontrado. Instale o Docker Engine e tente novamente."
  exit 1
fi

echo "Abra https://dashboard.ngrok.com/get-started/your-authtoken"
echo "No painel, copie o Authtoken e o domínio gratuito atribuído à sua conta."
echo "Exemplo de domínio: exemplo-123.ngrok-free.app"
echo ""

read -r -p "Domínio fixo do ngrok: " NGROK_DOMAIN_INPUT
NGROK_DOMAIN_INPUT="${NGROK_DOMAIN_INPUT#http://}"
NGROK_DOMAIN_INPUT="${NGROK_DOMAIN_INPUT#https://}"
NGROK_DOMAIN_INPUT="${NGROK_DOMAIN_INPUT%%/*}"

if [[ ! "$NGROK_DOMAIN_INPUT" =~ ^[A-Za-z0-9.-]+$ ]] || [[ "$NGROK_DOMAIN_INPUT" != *.* ]]; then
  echo "Domínio inválido. Cole somente o endereço, sem caminho."
  exit 1
fi

read -r -s -p "Authtoken do ngrok (não aparecerá na tela): " NGROK_TOKEN_INPUT
echo ""

if [ -z "$NGROK_TOKEN_INPUT" ]; then
  echo "O Authtoken não pode ficar vazio."
  exit 1
fi

touch .env
chmod 600 .env

upsert_env() {
  local key="$1"
  local value="$2"
  local temporary_file
  temporary_file="$(mktemp)"

  awk -v key="$key" -v value="$value" '
    BEGIN { found = 0 }
    index($0, key "=") == 1 { print key "=" value; found = 1; next }
    { print }
    END { if (!found) print key "=" value }
  ' .env > "$temporary_file"

  install -m 600 "$temporary_file" .env
  rm -f "$temporary_file"
}

upsert_env "NGROK_DOMAIN" "$NGROK_DOMAIN_INPUT"
upsert_env "NGROK_AUTHTOKEN" "$NGROK_TOKEN_INPUT"
upsert_env "NGROK_AGENT_DOMAIN" "default.internal"
unset NGROK_TOKEN_INPUT

echo "Ativando o Docker na inicialização do Linux..."
sudo systemctl enable --now docker

echo "Iniciando a aplicação e o túnel permanente..."
docker compose up -d --build
docker compose restart proxy
docker compose --profile public up -d ngrok

APPLICATION_READY=false
for _attempt in $(seq 1 60); do
  if curl --fail --silent --max-time 2 http://127.0.0.1:8080/api/health >/dev/null; then
    APPLICATION_READY=true
    break
  fi
  sleep 1
done

if [ "$APPLICATION_READY" != "true" ]; then
  echo "A aplicação local não respondeu após 60 segundos."
  echo "Confira: docker compose logs --tail=100 proxy api frontend"
  exit 1
fi

if ! docker compose --profile public ps --status running ngrok | grep -q ngrok; then
  echo "O túnel não iniciou. Confira: docker compose --profile public logs --tail=100 ngrok"
  exit 1
fi

echo ""
echo "Configuração concluída. Endereço público fixo:"
echo "https://$NGROK_DOMAIN_INPUT"
echo ""
echo "O app e o túnel agora reiniciam automaticamente com o Docker."
