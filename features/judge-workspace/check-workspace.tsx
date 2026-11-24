"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, ShieldAlert, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DeckImageView } from "@/features/cards/deck-image-view";
import { CATEGORY_LABEL, Category } from "@/lib/deck-types";
import { DeckItem, Player } from "./types";
import { PlayerBadge } from "./player-list";
import { DeckItemRow } from "./deck-item-row";

export function CheckWorkspace({ player, onPatch }: {
  player: Player;
  onPatch: (id: string, patch: Partial<Player>) => Promise<void>;
}) {
  const [category, setCategory] = useState<Category>("pokemon");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueNote, setIssueNote] = useState(player.result_note || "");
  const observedTotal = player.deck.items.reduce(
    (sum, item) => sum + Math.min(player.checkState[item.id] ?? 0, item.quantity),
    0,
  );
  const exactItems = player.deck.items.filter(
    (item) => (player.checkState[item.id] ?? 0) === item.quantity,
  ).length;
  const allExact = exactItems === player.deck.items.length && player.deck.items.length > 0;
  const listHasCriticalWarning = player.deck.warnings.some((warning) => warning.severity === "critical");
  const progress = player.deck.total ? Math.round((observedTotal / player.deck.total) * 100) : 0;

  async function setObserved(item: DeckItem, value: number) {
    const checkState = { ...player.checkState, [item.id]: value };
    await onPatch(player.id, {
      checkState,
      status: player.status === "pending" ? "in_progress" : player.status,
    });
  }

  async function finishClean() {
    await onPatch(player.id, { status: "done_clean", result_note: "" } as Partial<Player>);
    toast.success(`${player.name}: deck check concluído.`);
  }

  async function finishWithIssue() {
    if (!issueNote.trim()) {
      toast.error("Descreva a ocorrência antes de concluir.");
      return;
    }
    await onPatch(player.id, { status: "done_issue", result_note: issueNote } as Partial<Player>);
    setIssueOpen(false);
    toast.warning(`${player.name}: ocorrência registrada.`);
  }

  async function reopen() {
    await onPatch(player.id, { status: "in_progress", result_note: "" } as Partial<Player>);
  }

  return (
    <section className="min-w-0 space-y-4">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-5 bg-[#152238] p-5 text-white md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold tracking-[0.16em] text-white/55 uppercase">Conferência ativa</p>
              <PlayerBadge status={player.status} />
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{player.name}</h2>
            <p className="mt-2 text-sm text-white/65">
              {player.deck.items.length} pilhas agrupadas · lista com {player.deck.total} cartas
            </p>
            <DeckImageView
              items={player.deck.items}
              playerName={player.name}
              className="mt-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
            />
          </div>
          <div className="flex items-baseline gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3">
            <strong className="font-mono text-4xl text-[#e0b348]">{observedTotal}</strong>
            <span className="font-mono text-lg text-white/55">/{player.deck.total}</span>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-bold">{exactItems} de {player.deck.items.length} pilhas conferidas</span>
            <span className="font-mono font-black text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          {player.deck.warnings.length > 0 && (
            <div className="grid gap-2 pt-1">
              {player.deck.warnings.map((warning) => (
                <div key={`${warning.code}-${warning.message}`} className={cn(
                  "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
                  warning.severity === "critical"
                    ? "border-red-200 bg-red-50 text-red-900"
                    : "border-amber-200 bg-amber-50 text-amber-900",
                )}>
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Tabs value={category} onValueChange={(value) => setCategory(value as Category)}>
        <TabsList className="grid h-12 w-full grid-cols-3 rounded-xl bg-[#dfe3dc] p-1">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((value) => {
            const count = player.deck.items.filter((item) => item.category === value).length;
            return (
              <TabsTrigger key={value} value={value} className="h-10 rounded-lg text-xs font-black sm:text-sm">
                {CATEGORY_LABEL[value]} <span className="font-mono opacity-55">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((value) => (
          <TabsContent key={value} value={value} className="mt-3 space-y-2.5">
            {player.deck.items.filter((item) => item.category === value).map((item) => (
              <DeckItemRow
                key={item.id}
                item={item}
                observed={player.checkState[item.id] ?? 0}
                onChange={(next) => setObserved(item, next)}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <div className="sticky bottom-3 z-20 grid gap-2 rounded-2xl border bg-card/95 p-3 shadow-[0_12px_40px_rgba(21,34,56,0.18)] backdrop-blur sm:grid-cols-2">
        {player.status.startsWith("done") ? (
          <Button variant="outline" className="h-12 sm:col-span-2" onClick={reopen}>
            <RotateCcw /> Reabrir conferência
          </Button>
        ) : (
          <>
            <Button
              className="h-12 font-bold"
              onClick={finishClean}
              disabled={!allExact || listHasCriticalWarning}
              title={!allExact ? "Conclua todas as pilhas" : listHasCriticalWarning ? "A lista possui alerta crítico" : undefined}
            >
              <CheckCircle2 /> Concluir sem irregularidade
            </Button>
            <Button variant="destructive" className="h-12 font-bold" onClick={() => setIssueOpen(true)}>
              <ShieldAlert /> Registrar ocorrência
            </Button>
          </>
        )}
      </div>

      {player.status === "done_issue" && player.result_note && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
          <p className="font-black">Ocorrência registrada</p>
          <p className="mt-1 whitespace-pre-wrap leading-6">{player.result_note}</p>
        </div>
      )}

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar ocorrência</DialogTitle>
            <DialogDescription>
              Descreva objetivamente a divergência. A ferramenta não substitui investigação nem decisão do Head Judge.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={issueNote}
            onChange={(event) => setIssueNote(event.target.value)}
            placeholder="Ex.: lista contém 3 Ultra Ball; baralho físico contém 4..."
            className="min-h-32"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={finishWithIssue}>Salvar ocorrência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
