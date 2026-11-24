# Operação e deploy (pt-BR)

Guia de instalação, túnel público, deploy automático, backup e atualização. Visão geral do projeto no [README](../README.md).

## Instalar e iniciar

Clone o repositório e entre na pasta:

```bash
git clone https://github.com/SamuelNahas/tcg-deck-check.git
cd tcg-deck-check
```

### Linux ou macOS

Requisitos: Docker Engine ou Docker Desktop com Docker Compose e `openssl`.

```bash
chmod +x scripts/start-deckcheck.sh scripts/start-public-tunnel.sh scripts/setup-ngrok.sh
./scripts/start-deckcheck.sh
```

A aplicação ficará disponível em:

```text
http://localhost:8080
```

Primeiro login de juiz:

```text
Login: admin
Senha: valor de DECKCHECK_APP_PASSWORD no arquivo .env
```

### Windows

Com o Docker Desktop aberto e configurado para contêineres Linux:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-deckcheck.ps1
```

### Acesso público fixo e gratuito com ngrok

Crie uma conta gratuita em [ngrok.com](https://ngrok.com), copie o domínio de desenvolvimento atribuído à conta e o Authtoken. Depois, execute uma única vez:

```bash
cd ~/tcg-deck-check
./scripts/setup-ngrok.sh
```

O script pede os dois valores sem gravá-los no GitHub, conecta o app ao Agent Endpoint `default.internal`, inicia o túnel e habilita o Docker na inicialização do Linux. O Cloud Endpoint público criado pelo painel encaminha as requisições para esse Agent Endpoint. O container do ngrok usa `restart: unless-stopped`, portanto reconecta depois de reinicializações do Docker, quedas do agente ou retorno da internet. O terminal pode ser fechado.

Para conferir ou reiniciar manualmente depois da configuração:

```bash
./scripts/start-public-tunnel.sh
docker compose --profile public ps
docker compose --profile public logs --tail=100 ngrok
```

O domínio gratuito atribuído pelo ngrok permanece o mesmo, mas está sujeito às franquias do plano gratuito. O computador não pode entrar em suspensão.

### Deploy automático pelo GitHub Actions

O workflow `.github/workflows/ci.yml` testa cada alteração. Depois de um commit aprovado entrar na branch `main`, o job de deploy usa um runner auto-hospedado no Linux de casa para reconstruir os containers, preservar o volume do banco e verificar tanto a API local quanto o endereço público do ngrok.

O runner deve ser instalado uma única vez em **Settings → Actions → Runners → New self-hosted runner**, com Linux e arquitetura x64. Instale-o como serviço seguindo os comandos exibidos pelo próprio GitHub. O serviço deve executar como o usuário `samuca`, que precisa ter acesso ao Docker e ao arquivo `/home/samuca/tcg-deck-check/.env`.

O deploy não roda em pull requests. O workflow usa segredos somente do `.env` que já está no servidor; o Authtoken e as senhas não são enviados ao GitHub.

## Atualizar sem apagar o banco

Faça um backup pela aplicação antes da atualização. Depois:

```bash
cd ~/tcg-deck-check
git pull
docker compose up -d --build
```

Se o Git informar alteração local apenas em `scripts/start-public-tunnel.sh`, guarde-a antes:

```bash
git stash push -m "permissao-local-tunnel" -- scripts/start-public-tunnel.sh
git pull
docker compose up -d --build
```

Não execute `docker compose down -v`: a opção `-v` remove o volume que contém o banco.

## Fluxo recomendado

1. Entre como juiz (`admin` no primeiro acesso).
2. Crie o torneio e informe o código e a senha aos jogadores.
3. Crie contas individuais para os outros juízes.
4. Cada jogador cria a própria conta, usa o código, monta ou importa a lista e confirma o envio antes do prazo.
5. No evento, abra o torneio e use **Jogadores**, **Conferência**, **Ocorrências** e **Regras**.
6. Exporte os PDFs e baixe o backup JSON ao final.

O botão **Importar listas** continua disponível para listas recebidas fora do portal do jogador.

## Dados e backup

O banco fica no volume Docker `deckcheck_data`. A migração da versão 2 para a 3 é automática e não altera o conteúdo das listas antigas.

Para acompanhar o servidor:

```bash
docker compose ps
docker compose logs -f
curl http://127.0.0.1:8080/api/health
```

Para parar sem apagar dados:

```bash
docker compose down
```

## Imagens e verificação de Pokémon Básico

Quando coleção e número estão disponíveis, a interface tenta primeiro as imagens em português e inglês do CDN usado pelo Limitless. Se uma delas não existir, troca automaticamente para a Pokémon TCG API e depois para a API aberta TCGdex. Para Treinadores e Energias agrupados apenas pelo nome, as duas APIs de catálogo fazem a resolução da impressão.

A busca textual continua usando a API pública do Pokémon TCG. Sem chave ela funciona com limites menores. Uma chave opcional pode ser colocada no `.env`:

```text
POKEMON_TCG_API_KEY=sua-chave
```

Se todas as fontes externas falharem, a interface mantém a carta na lista, mostra o estado de imagem indisponível e solicita revisão quando não puder confirmar automaticamente um Pokémon Básico.

## Regras oficiais usadas como referência

- [Play! Pokémon Tournament Rules Handbook](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tournament-rules-handbook-en.pdf)
- [Play! Pokémon TCG Tournament Handbook](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tcg-tournament-handbook-en.pdf)
- [Play! Pokémon Penalty Guidelines](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-penalty-guidelines-en.pdf)

O documento oficial vigente, a investigação do caso e a decisão do Head Judge prevalecem.

## Desenvolvimento

```bash
npm ci
DECKCHECK_APP_PASSWORD='uma-senha-de-teste' \
DECKCHECK_DB_PATH='./data/deckcheck.sqlite' \
npm run api
```

Em outro terminal:

```bash
npm run dev
```

Validação completa:

```bash
npm test
npm run lint
docker compose config
```
