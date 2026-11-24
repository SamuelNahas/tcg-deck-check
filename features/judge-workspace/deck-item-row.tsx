"use client";

import { Check, Minus, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";
import { CardArtwork } from "@/features/cards/card-artwork";
import { DeckItem } from "./types";

/** One deck entry as a large tile: tap the artwork to mark all copies as seen, or use −/+ to count them. */
export function DeckItemRow({ item, observed, onChange }: {
  item: DeckItem;
  observed: number;
  onChange: (value: number) => void;
}) {
  const t = useT();
  const exact = observed === item.quantity;
  const tooMany = observed > item.quantity;
  return (
    <article className={cn(
      "flex flex-col overflow-hidden rounded-2xl border bg-card shadow-sm transition",
      exact && "border-emerald-400 bg-emerald-50/70 ring-2 ring-emerald-300",
      tooMany && "border-red-400 bg-red-50 ring-2 ring-red-300",
    )}>
      <button
        type="button"
        onClick={() => onChange(exact ? 0 : item.quantity)}
        aria-pressed={exact}
        aria-label={t("judge.item.markChecked", { name: item.name })}
        className="relative block bg-muted/40 p-1.5 outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <CardArtwork item={item} linked={false} prefer="large" className="aspect-[5/7] h-auto w-full rounded-lg border-0 object-contain shadow-md" />
        <span className="absolute left-2.5 top-2.5 rounded-md bg-[#152238] px-2 py-0.5 font-mono text-base font-black text-white shadow-lg">{item.quantity}×</span>
        {exact && (
          <span className="absolute right-2.5 top-2.5 grid size-7 place-items-center rounded-full bg-emerald-600 text-white shadow-lg">
            <Check className="size-4" aria-hidden="true" />
          </span>
        )}
      </button>
      <div className="flex flex-1 flex-col gap-2 p-2">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-sm font-black leading-tight">{item.name}</h3>
          {item.category === "pokemon" ? (
            <div className="mt-1 flex items-center gap-2 text-[11px]">
              {item.setCode && item.collectorNumber ? (
                <span className="rounded-md bg-[#152238] px-2 py-1 font-mono font-bold text-white">
                  {item.setCode} · {item.collectorNumber}
                </span>
              ) : (
                <span className="flex items-center gap-1 font-bold text-amber-700">
                  <TriangleAlert className="size-3.5" /> {t("judge.item.missingSetNumber")}
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">{t("judge.item.nameAndQuantityOnly")}</p>
          )}
        </div>
        <div className="mt-auto grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-1 rounded-xl border bg-white p-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            onClick={() => onChange(Math.max(0, observed - 1))}
            aria-label={t("judge.item.decrease", { name: item.name })}
          >
            <Minus />
          </Button>
          <span className={cn(
            "text-center font-mono text-xl font-black",
            exact ? "text-emerald-700" : tooMany ? "text-red-700" : "text-foreground",
          )}>{observed}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            onClick={() => onChange(observed + 1)}
            aria-label={t("judge.item.increase", { name: item.name })}
          >
            <Plus />
          </Button>
        </div>
      </div>
    </article>
  );
}
