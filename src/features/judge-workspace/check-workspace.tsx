"use client";

import { useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, RotateCcw, ShieldAlert, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { DeckImageView } from "@/features/cards/deck-image-view";
import { Category } from "@/lib/deck-types";
import { useT } from "@/lib/i18n";
import { warningMessage } from "@/lib/i18n/warnings";
import { DeckItem, Player } from "./types";
import { PlayerBadge } from "./player-list";
import { DeckItemRow } from "./deck-item-row";

const CATEGORIES: Category[] = ["pokemon", "trainer", "energy"];

export function CheckWorkspace({ player, onPatch, queue }: {
  player: Player;
  onPatch: (id: string, patch: Partial<Player>) => Promise<void>;
  /** Position among the players still to check, with handlers to move through them. */
  queue: { position: number; total: number; onPrevious?: () => void; onNext?: () => void };
}) {
  const t = useT();
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
    toast.success(t("judge.check.cleanDone", { name: player.name }));
  }

  async function finishWithIssue() {
    if (!issueNote.trim()) {
      toast.error(t("judge.check.describeFirst"));
      return;
    }
    await onPatch(player.id, { status: "done_issue", result_note: issueNote } as Partial<Player>);
    setIssueOpen(false);
    toast.warning(t("judge.check.issueRecorded", { name: player.name }));
  }

  async function reopen() {
    await onPatch(player.id, { status: "in_progress", result_note: "" } as Partial<Player>);
  }

  return (
    <section className="min-w-0 space-y-2 pb-20">
      <div className="overflow-hidden rounded-2xl border bg-[#152238] text-white shadow-sm">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 sm:px-4">
          <div className="min-w-0 flex-1 basis-44">
            <div className="flex items-center gap-2">
              <h2 className="truncate text-lg font-black leading-tight tracking-tight sm:text-xl">{player.name}</h2>
              <PlayerBadge status={player.status} />
            </div>
            <p className="truncate text-[11px] text-white/60">{t("judge.check.summary", { stacks: player.deck.items.length, cards: player.deck.total })}</p>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" disabled={!queue.onPrevious} onClick={queue.onPrevious} aria-label={t("judge.check.previous")} className="size-9 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <ChevronLeft />
            </Button>
            <span className="min-w-12 text-center font-mono text-xs text-white/70">{t("judge.check.queuePosition", { position: queue.position, total: queue.total })}</span>
            <Button variant="outline" size="icon" disabled={!queue.onNext} onClick={queue.onNext} aria-label={t("judge.check.next")} className="size-9 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
              <ChevronRight />
            </Button>
          </div>
          <DeckImageView
            items={player.deck.items}
            playerName={player.name}
            className="h-9 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
          />
          <div className="flex items-baseline gap-1 rounded-xl border border-white/15 bg-white/10 px-3 py-1">
            <strong className="font-mono text-2xl text-[#e0b348]">{observedTotal}</strong>
            <span className="font-mono text-sm text-white/55">/{player.deck.total}</span>
          </div>
        </div>
        <div className="flex items-center gap-3 bg-card px-3 py-1.5 text-xs text-foreground sm:px-4">
          <span className="font-bold">{t("judge.check.progress", { done: exactItems, total: player.deck.items.length })}</span>
          <Progress value={progress} className="h-2 flex-1" />
          <span className="font-mono font-black text-primary">{progress}%</span>
        </div>
      </div>
      {player.deck.warnings.length > 0 && (
        <div className="grid gap-1.5">
          {player.deck.warnings.map((warning) => (
            <div key={`${warning.code}-${warning.message}`} className={cn(
              "flex items-start gap-2 rounded-xl border px-3 py-1.5 text-xs",
              warning.severity === "critical"
                ? "border-red-200 bg-red-50 text-red-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}>
              <TriangleAlert className="mt-0.5 size-3.5 shrink-0" />
              <span>{warningMessage(t, warning)}</span>
            </div>
          ))}
        </div>
      )}

      <Tabs value={category} onValueChange={(value) => setCategory(value as Category)}>
        <TabsList className="grid h-10 w-full grid-cols-3 rounded-xl bg-[#dfe3dc] p-1">
          {CATEGORIES.map((value) => {
            const count = player.deck.items.filter((item) => item.category === value).length;
            return (
              <TabsTrigger key={value} value={value} className="h-8 rounded-lg text-xs font-black sm:text-sm">
                {t(`card.category.${value}`)} <span className="font-mono opacity-55">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {CATEGORIES.map((value) => (
          <TabsContent key={value} value={value} className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(8.5rem,1fr))] gap-2.5">
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

      <div className="sticky bottom-2 z-20 grid grid-cols-2 gap-2 rounded-2xl border bg-card/95 p-2 shadow-[0_12px_40px_rgba(21,34,56,0.18)] backdrop-blur">
        {player.status.startsWith("done") ? (
          <Button variant="outline" className="h-11 col-span-2" onClick={reopen}>
            <RotateCcw /> {t("judge.check.reopen")}
          </Button>
        ) : (
          <>
            <Button
              className="h-11 whitespace-normal px-2 text-xs leading-tight font-bold sm:text-sm"
              onClick={finishClean}
              disabled={!allExact || listHasCriticalWarning}
              title={!allExact ? t("judge.check.titleFinishAll") : listHasCriticalWarning ? t("judge.check.titleCritical") : undefined}
            >
              <CheckCircle2 /> {t("judge.check.finishClean")}
            </Button>
            <Button variant="destructive" className="h-11 whitespace-normal px-2 text-xs leading-tight font-bold sm:text-sm" onClick={() => setIssueOpen(true)}>
              <ShieldAlert /> {t("judge.check.recordIssue")}
            </Button>
          </>
        )}
      </div>

      {player.status === "done_issue" && player.result_note && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
          <p className="font-black">{t("judge.check.issueRecordedTitle")}</p>
          <p className="mt-1 whitespace-pre-wrap leading-6">{player.result_note}</p>
        </div>
      )}

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("judge.check.recordIssue")}</DialogTitle>
            <DialogDescription>
              {t("judge.check.dialogDescription")}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={issueNote}
            onChange={(event) => setIssueNote(event.target.value)}
            placeholder={t("judge.check.placeholder")}
            className="min-h-32"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>{t("judge.check.cancel")}</Button>
            <Button variant="destructive" onClick={finishWithIssue}>{t("judge.check.saveIssue")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
