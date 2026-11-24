"use client";

import { storedLabel } from "@/lib/i18n/stored-labels";
import { useState } from "react";
import { Check, ChevronRight, Search, Trash2, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { localeOf, useT } from "@/lib/i18n";
import { Player, PlayerStatus } from "./types";
import { STATUS_CLASS_NAME } from "./constants";

export function PlayerBadge({ status }: { status: PlayerStatus }) {
  const t = useT();
  return <Badge variant="outline" className={cn("font-bold", STATUS_CLASS_NAME[status])}>{t(`status.${status}`)}</Badge>;
}

export function PlayerList({
  players,
  selectedId,
  onSelect,
  onDelete,
}: {
  players: Player[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const t = useT();
  const locale = localeOf();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const filtered = players.filter((player) => {
    const matchesQuery = player.name.toLocaleLowerCase(locale).includes(query.toLocaleLowerCase(locale));
    const matchesStatus = filter === "all"
      || (filter === "open" && !player.status.startsWith("done"))
      || (filter === "done" && player.status.startsWith("done"));
    return matchesQuery && matchesStatus;
  });

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className="space-y-3 border-b p-4 sm:flex sm:items-center sm:justify-between sm:space-y-0">
        <div className="relative min-w-0 sm:max-w-xs sm:flex-1">
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("judge.players.search")}
            className="h-10 pl-9"
          />
        </div>
        <div className="flex rounded-xl bg-muted p-1">
          {(["all", "open", "done"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "min-h-9 flex-1 rounded-lg px-2 text-xs font-bold transition sm:flex-none sm:px-3",
                filter === value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {value === "all" ? t("judge.players.filterAll") : value === "open" ? t("judge.players.filterOpen") : t("judge.players.filterDone")}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y">
        {filtered.length ? filtered.map((player) => (
          <div
            key={player.id}
            className={cn(
              "group flex items-center gap-3 px-4 py-3 transition hover:bg-accent/40",
              selectedId === player.id && "bg-accent/65",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(player.id)}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl border font-mono text-sm font-black",
                player.status.startsWith("done") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-white",
              )}>
                {player.status.startsWith("done") ? <Check className="size-5" /> : player.deck.total}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="truncate text-[15px]">{player.name}</strong>
                  <PlayerBadge status={player.status} />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {t("judge.players.stacks", { count: player.deck.items.length })} · {player.source_name ? storedLabel(t, player.source_name) : t("judge.players.importedList")}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={t("judge.players.deleteAria", { name: player.name })}>
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t("judge.players.deleteTitle", { name: player.name })}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("judge.players.deleteDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>{t("judge.players.cancel")}</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(player.id)} className="bg-destructive text-white hover:bg-destructive/90">
                    {t("judge.players.delete")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )) : (
          <div className="px-6 py-14 text-center">
            <Users className="mx-auto size-9 text-muted-foreground/50" />
            <p className="mt-3 font-bold">{t("judge.players.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted-foreground">{t("judge.players.emptyHint")}</p>
          </div>
        )}
      </div>
    </section>
  );
}
