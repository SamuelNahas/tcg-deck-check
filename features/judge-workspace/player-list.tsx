"use client";

import { useState } from "react";
import { Check, ChevronRight, Search, Trash2, Users } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Player, PlayerStatus } from "./types";
import { STATUS_META } from "./constants";

export function PlayerBadge({ status }: { status: PlayerStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant="outline" className={cn("font-bold", meta.className)}>{meta.label}</Badge>;
}

export function PlayerList({
  players,
  selectedId,
  onSelect,
  onDelete,
  compact = false,
}: {
  players: Player[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const filtered = players.filter((player) => {
    const matchesQuery = player.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"));
    const matchesStatus = filter === "all"
      || (filter === "open" && !player.status.startsWith("done"))
      || (filter === "done" && player.status.startsWith("done"));
    return matchesQuery && matchesStatus;
  });

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className={cn("space-y-3 border-b p-4", !compact && "sm:flex sm:items-center sm:justify-between sm:space-y-0")}>
        <div className={cn("relative min-w-0", !compact && "sm:max-w-xs sm:flex-1")}>
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar jogador"
            className="h-10 pl-9"
          />
        </div>
        <div className={cn(
          "rounded-xl bg-muted p-1",
          compact ? "grid w-full min-w-0 grid-cols-3" : "flex",
        )}>
          {(["all", "open", "done"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "min-h-9 flex-1 rounded-lg px-2 text-xs font-bold transition",
                !compact && "sm:flex-none sm:px-3",
                filter === value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {value === "all" ? "Todos" : value === "open" ? "Pendentes" : "Concluídos"}
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
                  {player.deck.items.length} pilhas · {player.source_name || "lista importada"}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Excluir ${player.name}`}>
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir {player.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A lista e todo o progresso de conferência serão removidos do servidor.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(player.id)} className="bg-destructive text-white hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )) : (
          <div className="px-6 py-14 text-center">
            <Users className="mx-auto size-9 text-muted-foreground/50" />
            <p className="mt-3 font-bold">Nenhum jogador encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Importe as listas ou altere o filtro.</p>
          </div>
        )}
      </div>
    </section>
  );
}
