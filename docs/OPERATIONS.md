# Operação (pt-BR)

Guia de instalação, túnel público, backup e atualização. Visão geral do projeto no [README](../README.md).

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

### Integração contínua

O workflow `.github/workflows/ci.yml` roda build, testes e lint em cada push na `main` e em cada pull request. Não há deploy automático: para atualizar o servidor, siga a seção abaixo.

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

## Catálogo de cartas, imagens e verificação de Pokémon Básico

Todas as consultas de carta passam por um único módulo (`server/catalog/`) que usa o [TCGdex](https://tcgdex.dev) como base: busca por nome, resolução exata por coleção e número, imagens em português e inglês e a verificação de Pokémon Básico (campo `stage`). O código da coleção (OBF, PAL, SVP…) é traduzido para o id do TCGdex pelo próprio catálogo, sem tabela manual. As imagens do CDN do Limitless ficam apenas como último recurso, quando o TCGdex não conhece a carta.

Nenhuma chave de API é necessária. Se o TCGdex estiver indisponível, a interface mantém a carta na lista, mostra o estado de imagem indisponível e solicita revisão quando não puder confirmar automaticamente um Pokémon Básico.

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
