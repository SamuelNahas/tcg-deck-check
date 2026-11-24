"use client";

import { Archive, CircleAlert, ExternalLink, Gavel, ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

import { OFFICIAL_PENALTIES_URL, OFFICIAL_RULES_URL, OFFICIAL_TCG_URL } from "./constants";

export function RulesPanel({ playerCount, completedCount }: { playerCount: number; completedCount: number }) {
  const target = playerCount ? Math.ceil(playerCount * 0.1) : 0;
  return (
    <section>
      <Tabs defaultValue="lists">
        <TabsList className="mb-5 grid h-12 w-full grid-cols-2 rounded-xl bg-[#dfe3dc] p-1 sm:max-w-xl">
          <TabsTrigger value="lists" className="h-10 font-black"><ListChecks /> Listas e deck check</TabsTrigger>
          <TabsTrigger value="game" className="h-10 font-black"><Gavel /> Jogo</TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-3xl border bg-[#152238] p-6 text-white shadow-sm">
          <div className="flex items-center gap-2 text-[#e0b348]"><Gavel className="size-5" /><span className="text-xs font-black tracking-[0.16em] uppercase">Referência rápida</span></div>
          <h2 className="mt-4 text-2xl font-black">Deck check: quatro verificações</h2>
          <ol className="mt-5 grid gap-3 text-sm leading-6 text-white/80 sm:grid-cols-2">
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">1. Lista</strong><br />Completa e legível.</li>
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">2. Legalidade</strong><br />O baralho descrito é legal.</li>
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">3. Correspondência</strong><br />Baralho físico igual à lista.</li>
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">4. Marcas</strong><br />Cartas e sleeves sem padrão identificável.</li>
          </ol>
        </div>
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.14em] text-muted-foreground uppercase">Meta oficial</p>
          <div className="mt-4 flex items-baseline gap-2"><strong className="font-mono text-5xl text-primary">{completedCount}</strong><span className="font-mono text-xl text-muted-foreground">/{target}</span></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Espera-se conferir ao menos 10% dos baralhos em eventos da Championship Series, mantendo a qualidade.</p>
          <Progress value={target ? Math.min(100, Math.round((completedCount / target) * 100)) : 0} className="mt-4 h-3" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-xl font-black">Legalidade do baralho — penalidade inicial recomendada</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Resumo da seção 5.6.1 do Guia de Penalidades. Investigue contexto e intenção; o documento oficial e a decisão do Head Judge prevalecem.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Grau</TableHead>
              <TableHead className="w-40">Inicial</TableHead>
              <TableHead>Quando se aplica / exemplos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell><Badge className="bg-amber-100 text-amber-900">Menor</Badge></TableCell>
              <TableCell className="font-black">Advertência</TableCell>
              <TableCell className="min-w-80 text-sm leading-6">Pouca ou nenhuma oportunidade de vantagem: desgaste sem padrão; número de coleção ausente, mas a carta ainda é identificável; variante de raridade diferente da mesma carta.</TableCell>
            </TableRow>
            <TableRow>
              <TableCell><Badge className="bg-red-100 text-red-900">Grave</Badge></TableCell>
              <TableCell className="font-black">Game Loss</TableCell>
              <TableCell className="min-w-80 text-sm leading-6">Há oportunidade de vantagem por ambiguidade ou divergência: lista/baralho não tem 60; quantidades não batem; impressão de Pokémon diferente; mais de 4 Energias Especiais do mesmo nome; padrão relevante de cartas marcadas.</TableCell>
            </TableRow>
            <TableRow>
              <TableCell><Badge variant="destructive">Gravíssima</Badge></TableCell>
              <TableCell className="font-black">Desqualificação</TableCell>
              <TableCell className="min-w-80 text-sm leading-6">Manipulação intencional, cartas não registradas que geram vantagem ou marcações intencionais/repetidas. Investigue cuidadosamente antes de concluir intenção.</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-black"><CircleAlert className="text-amber-600" /> Como corrigir divergências</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            <li>• A lista registrada tem prioridade sobre o baralho físico; em regra, ajuste o baralho para corresponder à lista.</li>
            <li>• Se a lista tiver menos de 60, carta ilegal ou impossível de identificar, complete-a com Energias Básicas escolhidas pelo jogador e depois ajuste o baralho físico.</li>
            <li>• Cartas ilegais por condição, idioma ou formato devem ser substituídas.</li>
            <li>• Cartas adicionais na deck box podem exigir revisão; aparência distinta e ausência de intenção importam.</li>
          </ul>
        </article>
        <article className="rounded-3xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-black"><Archive className="text-primary" /> Documentos oficiais</h3>
          <div className="mt-3 grid gap-2">
            {[
              ["Tournament Rules Handbook", OFFICIAL_RULES_URL],
              ["TCG Tournament Handbook", OFFICIAL_TCG_URL],
              ["Penalty Guidelines", OFFICIAL_PENALTIES_URL],
            ].map(([label, url]) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between rounded-xl border bg-white px-3 text-sm font-bold transition hover:border-primary hover:text-primary">
                {label}<ExternalLink className="size-4" />
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Referência revisada contra os documentos oficiais publicados em Q2 de 2026. Verifique atualizações antes de eventos futuros.</p>
        </article>
      </div>
        </TabsContent>

        <TabsContent value="game" className="space-y-5">
          <div className="rounded-3xl border bg-[#152238] p-6 text-white shadow-sm">
            <div className="flex items-center gap-2 text-[#e0b348]"><Gavel className="size-5" /><span className="text-xs font-black tracking-[0.16em] uppercase">Referência rápida de jogo</span></div>
            <h2 className="mt-4 text-2xl font-black">Investigue, preserve e corrija o estado</h2>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-white/80 sm:grid-cols-2 lg:grid-cols-4">
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">1. Pare a ação</strong><br />Evite que novas decisões agravem o erro.</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">2. Ouça ambos</strong><br />Reconstrua ações, informação vista e vantagem.</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">3. Reverta se possível</strong><br />Para erros menores e graves, preserve o jogo quando a correção for confiável.</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">4. Registre</strong><br />Informe o Head Judge e documente fato, penalidade e fix.</p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black">Penalidades recorrentes</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Penalidades iniciais recomendadas. Reversibilidade, repetição, idade, experiência e impacto real podem justificar desvio.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-2xl border bg-card p-4 shadow-sm md:col-span-2 xl:col-span-3">
                <h3 className="font-black">Erro de jogo</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Escolha o grau pelo impacto e pela possibilidade de reconstruir o estado da partida.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    ["Menor", "Warning", "Correção simples, com impacto limitado."],
                    ["Grave", "Double Prize Card", "Houve vantagem ou efeito relevante, mas a partida ainda pode ser corrigida."],
                    ["Gravíssimo", "Game Loss", "O estado da partida não pode ser reconstruído com segurança."],
                  ].map(([grade, penalty, description]) => (
                    <div key={grade} className="rounded-xl border bg-muted/35 p-3">
                      <p className="text-xs font-black tracking-wide text-muted-foreground uppercase">{grade}</p>
                      <p className="mt-1 font-black text-primary">{penalty}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6"><strong>Exemplos:</strong> ataque sem Energia, Prêmios não preparados, carta extra, Prêmio tomado incorretamente ou segunda Energia anexada sem efeito.</p>
              </article>
              {[
                ["Ritmo de jogo", "Menor: Warning · Grave: Double Prize Card", "Decisões isoladamente lentas, buscas repetidas e demora habitual que não melhora após penalidade."],
                ["Erro de procedimento", "Menor: Caution · Grave: Warning · Gravíssimo: Game Loss", "Resultado não confirmado, instrução da equipe ignorada, marcadores ausentes ou atraso causado ao evento."],
                ["Atraso", "<5 min: Warning · 5-10 min: Game Loss · >10 min: Match Loss e drop", "O jogador deve chegar ao local correto no início da rodada; o atraso começa a contar quando a rodada começa."],
                ["Conduta antidesportiva", "Menor: Warning · Grave: Match Loss · Gravíssima: Disqualification", "Perturbar partidas, intimidação, recusa de política, ameaças, insultos ou manipulação imprópria do resultado."],
                ["Cheating", "Disqualification", "Exige conhecimento e tentativa de vantagem: comprar cartas de propósito, alterar contadores, empilhar ou embaralhar insuficientemente de forma deliberada."],
              ].map(([title, penalty, detail]) => (
                <article key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm font-bold text-primary">{penalty}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black">Rulings operacionais frequentes</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ["Carta comprada a mais", "Normalmente erro grave e Double Prize Card. Se a carta correta ainda for identificável e sua face não tiver sido vista, pode ser totalmente revertido e tratado como Warning."],
                ["Prêmios não preparados", "Warning quando percebido cedo e facilmente corrigido; pode chegar a Double Prize Card após uma ou duas buscas com acesso potencial às seis cartas, ou Game Loss após três ou mais buscas."],
                ["Ataque sem Energia suficiente", "Começa como Warning quando corrigido imediatamente. Se houve Nocaute e várias ações/turnos ocorreram, avalie Double/Quadruple Prize Card ou Game Loss conforme a reparabilidade."],
                ["Prêmio tomado sem Nocaute ou em excesso", "Erro grave com Double Prize Card como ponto inicial, considerando informação revelada e possibilidade de reconstruir o estado."],
                ["Mais de uma Energia anexada no turno", "Sem efeito permitindo, é exemplo de erro grave de jogo e começa em Double Prize Card."],
                ["Tempos de referência", "Setup e embaralhamento inicial: 3 min; primeira busca: 45 s; buscas seguintes: 15 s; ação/ataque: 15 s; decisão antes de jogar carta: 10 s; iniciar turno: 5 s."],
              ].map(([title, detail]) => (
                <article key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <strong>Importante:</strong> a tela é referência rápida, não decisão automática. Confirme a seção aplicável no Penalty Guidelines e consulte o Head Judge antes de penalidades acima de Warning.
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
