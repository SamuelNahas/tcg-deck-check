# TCG Deck Check

Ferramenta centralizada para apoiar conferências de baralho em torneios de Pokémon TCG. O computador do evento mantém o banco e processa as listas; o iPad acessa a mesma aplicação pela rede privada.

## Versão 2.0

- Importa várias listas de uma vez em PDF, imagem, TXT ou texto copiado do WhatsApp.
- Extrai PDFs com camada de texto, como RK9, e usa OCR local em formulários oficiais digitalizados.
- Agrupa linhas duplicadas.
  - Pokémon: nome + coleção + número de coleção.
  - Treinador e Energia: somente nome, independentemente da impressão.
- Alerta total diferente de 60, mais de quatro cópias pelo nome e Pokémon sem impressão identificável.
- Permite qualquer quantidade de uma Energia Básica até o limite prático de 59 cartas.
- Confere se a lista contém ao menos um Pokémon Básico, consultando a base pública do Pokémon TCG quando possível e pedindo revisão manual se ela estiver indisponível.
- Mantém no servidor o status de cada jogador, contagens físicas, conclusão e ocorrências.
- Registra ocorrências de todo o torneio com Mesa, Jogador, Fato, Penalidade e Fix.
- Exporta as ocorrências do deck check e todas as penalidades em PDFs separados.
- Mostra a meta de 10% de deck checks e separa as referências rápidas em **Listas e deck check** e **Jogo**.
- Adapta a conferência, formulários e tabelas para celular, iPad e desktop sem sobreposição.
- Protege o evento com uma senha compartilhada e permite baixar backup JSON.
- Não armazena data de nascimento nem Player ID extraídos dos formulários.

> OCR nunca deve ser aceito sem revisão. A tela exige confirmação para listas reconhecidas por imagem e para resultados com alertas.

## Instalar e iniciar no computador

Clone o repositório e entre na pasta:

```bash
git clone https://github.com/SamuelNahas/tcg-deck-check.git
cd tcg-deck-check
```

### Windows

Requisitos: Docker Desktop aberto e configurado para usar contêineres Linux.

No PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-deckcheck.ps1
```

### Linux ou macOS

Requisitos: Docker Engine ou Docker Desktop com Docker Compose e `openssl`.

```bash
chmod +x scripts/start-deckcheck.sh
./scripts/start-deckcheck.sh
```

Na primeira execução, o script cria uma senha e inicia a aplicação em:

```text
http://localhost:8080
```

Para acompanhar os logs:

```bash
docker compose logs -f
```

Para parar sem apagar o banco:

```bash
docker compose down
```

Não use `docker compose down -v`, pois `-v` remove o volume que contém os dados do evento.

## Atualizar para a versão mais recente

Dentro da pasta do projeto:

```bash
git pull
docker compose up -d --build
```

O banco e os jogadores existentes são mantidos. Ainda assim, baixe um backup JSON antes de atualizar.

## Acessar com o iPad usando Tailscale

Esta é a opção recomendada: o servidor não precisa ficar publicamente exposto.

1. Instale e conecte o Tailscale no computador.
2. Instale o aplicativo Tailscale no iPad e entre na mesma rede Tailscale.
3. No computador, descubra o IP privado:

   ```bash
   tailscale ip -4
   ```

4. No Safari do iPad, abra `http://IP-EXIBIDO:8080` e use a senha criada pelo script.
5. Opcionalmente, use **Adicionar à Tela de Início** no Safari.

Não abra a porta 8080 no roteador. O Tailscale faz o acesso remoto privado sem redirecionamento de porta.

O computador precisa permanecer ligado, sem suspensão, com Docker e o túnel em execução durante o uso remoto.

## Fluxo recomendado no evento

1. No computador, entre em **Importar listas**.
2. Selecione todos os PDFs/imagens de uma vez ou cole blocos do WhatsApp separados por `=====`.
3. Revise nome, total, alertas e o texto de qualquer OCR; confirme e salve em lote.
4. No iPad, abra **Jogadores**, selecione o jogador e faça a contagem em **Conferência**.
5. Use o toque na caixa para marcar a quantidade exata ou os botões `–`/`+` para registrar divergência.
6. Conclua sem irregularidade somente quando todas as pilhas baterem; caso contrário, registre a ocorrência.
7. Use **Ocorrências** para registrar infrações e correções do torneio inteiro, mesmo quando não forem de deck check.
8. Ao final, exporte os PDFs pelos botões de cada área.

## Dados e backup

O banco SQLite fica no volume Docker `deckcheck_data`. O botão de arquivo no cabeçalho baixa um backup JSON. Faça ao menos um backup antes do torneio e outro ao final.

## Regras oficiais usadas como referência

- [Play! Pokémon Tournament Rules Handbook](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tournament-rules-handbook-en.pdf)
- [Play! Pokémon TCG Tournament Handbook](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tcg-tournament-handbook-en.pdf)
- [Play! Pokémon Penalty Guidelines](https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-penalty-guidelines-en.pdf)

O resumo dentro da ferramenta é apoio operacional. A documentação oficial vigente, a investigação do caso e a decisão do Head Judge prevalecem.

## Verificação de Pokémon Básico

A verificação automática usa a API pública do Pokémon TCG. Ela funciona sem chave com limites menores. Para eventos com muitas importações, uma chave opcional pode ser colocada no arquivo `.env`:

```text
POKEMON_TCG_API_KEY=sua-chave
```

Se a consulta externa falhar, a lista não é bloqueada silenciosamente: a interface cria um alerta para revisão manual.

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

O proxy Docker é a forma suportada de servir frontend e API na mesma origem durante o uso real.

Testes e validação:

```bash
npm test
npm run lint
npm run build
docker compose config
```
