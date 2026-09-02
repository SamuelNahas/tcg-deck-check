# TCG Tournament Check

Aplicação web centralizada para gerir torneios, receber decklists de Pokémon TCG e apoiar a equipe de arbitragem durante deck checks. O computador do evento roda o servidor e mantém o banco SQLite; jogadores, juízes, celulares e iPads acessam a mesma instalação pela rede ou por túnel HTTPS.

## Versão 3.0

### Torneios e contas

- O juiz cria cada torneio com nome, data, prazo de envio e senha.
- O sistema gera um código curto de inscrição para compartilhar com os jogadores.
- Cada jogador cria uma conta com nome, Play! Pokémon ID e senha, sem verificação por e-mail.
- Cada juiz usa sua própria conta; a conta inicial tem login `admin` e usa `DECKCHECK_APP_PASSWORD`.
- Juízes adicionais são criados pelo menu **Juízes**.
- Listas, deck checks, penalidades e PDFs ficam isolados por torneio.
- Dados anteriores à atualização aparecem automaticamente no torneio **Dados anteriores à versão 3**.

### Envio de decklist pelo jogador

- Editor inspirado no fluxo do RK9: busca pelo nome e toque na imagem para adicionar cópias.
- Importação do texto exportado pelo Pokémon TCG Live.
- Contagem separada de Pokémon, Treinadores e Energias e validação do total de 60.
- Pokémon são diferenciados por nome, coleção e número; Treinadores e Energias são agrupados por nome.
- Energias Básicas podem ultrapassar quatro cópias, respeitando o limite prático de 59 cartas.
- Verificação de pelo menos um Pokémon Básico.
- O prazo é validado no servidor. Depois do envio, a decklist fica bloqueada e o jogador não pode substituí-la nem editá-la.
- Imagens são consultadas na API pública do Pokémon TCG e têm fallback visual quando a base estiver indisponível.

### Operação da arbitragem

- Mantém importação em lote por PDF, imagem, TXT ou texto do WhatsApp.
- Extrai PDFs do RK9 e usa OCR local em formulários digitalizados.
- Agrupa linhas duplicadas e preserva as validações existentes.
- Registra progresso, contagem física, conclusão e ocorrências de deck check.
- Ocorrências gerais exigem **Mesa, Jogador, Fato, Penalidade e Fix**.
- O jogador deve pertencer ao torneio e o juiz é identificado automaticamente pela sessão.
- Exporta ocorrências de deck check e penalidades em PDFs separados por torneio.
- Mantém referências rápidas de **Listas e deck check** e **Jogo**.
- Interface responsiva para celular, iPad e desktop.

> OCR e correspondências automáticas de cartas devem ser revisados. A ferramenta apoia o trabalho da equipe, mas não substitui a investigação nem a decisão do Head Judge.

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

O runner deve ser instalado uma única vez em **Settings → Actions → Runners → New self-hosted runner**, com Linux, arquitetura x64 e o rótulo adicional `deckcheck`. Instale-o como serviço seguindo os comandos exibidos pelo próprio GitHub. O serviço deve executar como o usuário `samuca`, que precisa ter acesso ao Docker e ao arquivo `/home/samuca/tcg-deck-check/.env`.

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

A busca usa a API pública do Pokémon TCG. Sem chave ela funciona com limites menores. Uma chave opcional pode ser colocada no `.env`:

```text
POKEMON_TCG_API_KEY=sua-chave
```

Se a base externa falhar, a interface mantém a carta na lista, mostra um fallback de imagem e solicita revisão quando não puder confirmar automaticamente um Pokémon Básico.

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
