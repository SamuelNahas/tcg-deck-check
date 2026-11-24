"use client";

import { Minus, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { CardArtwork } from "@/features/cards/card-artwork";
import { DeckItem } from "./types";

export function DeckItemRow({ item, observed, onChange }: {
  item: DeckItem;
  observed: number;
  onChange: (value: number) => void;
}) {
  const exact = observed === item.quantity;
  const tooMany = observed > item.quantity;
  return (
    <article className={cn(
      "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm transition sm:grid-cols-[auto_minmax(0,1fr)_auto]",
      exact && "border-emerald-300 bg-emerald-50/70",
      tooMany && "border-red-300 bg-red-50",
    )}>
      <Checkbox
        checked={exact}
        onCheckedChange={(checked) => onChange(checked ? item.quantity : 0)}
        className="size-7 rounded-lg"
        aria-label={`Marcar ${item.name} como conferido`}
      />
      <div className="flex min-w-0 items-center gap-3">
        <CardArtwork item={item} className="h-16 w-12" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-lg font-black text-primary">{item.quantity}×</span>
            <h3 className="font-bold leading-tight">{item.name}</h3>
          </div>
          {item.category === "pokemon" ? (
            <div className="mt-1 flex items-center gap-2 text-xs">
              {item.setCode && item.collectorNumber ? (
                <span className="rounded-md bg-[#152238] px-2 py-1 font-mono font-bold text-white">
                  {item.setCode} · {item.collectorNumber}
                </span>
              ) : (
                <span className="flex items-center gap-1 font-bold text-amber-700">
                  <TriangleAlert className="size-3.5" /> coleção/número ausente
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Conferir somente nome e quantidade</p>
          )}
        </div>
      </div>
      <div className="col-span-2 grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-1 rounded-xl border bg-white p-1 sm:col-span-1 sm:flex">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10"
          onClick={() => onChange(Math.max(0, observed - 1))}
          aria-label={`Diminuir contagem de ${item.name}`}
        >
          <Minus />
        </Button>
        <span className={cn(
          "min-w-8 text-center font-mono text-xl font-black",
          exact ? "text-emerald-700" : tooMany ? "text-red-700" : "text-foreground",
        )}>{observed}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10"
          onClick={() => onChange(observed + 1)}
          aria-label={`Aumentar contagem de ${item.name}`}
        >
          <Plus />
        </Button>
      </div>
    </article>
  );
}
