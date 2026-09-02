"use client";

import { Images } from "lucide-react";

import { CardArtwork } from "@/components/card-artwork";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

type DeckImageItem = {
  id?: string;
  cardId?: string;
  category: "pokemon" | "trainer" | "energy";
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
  imageSmall?: string;
  imageLarge?: string;
  imageFallbacks?: string[];
};

const sections = [
  { category: "pokemon", label: "Pokémon" },
  { category: "trainer", label: "Treinadores" },
  { category: "energy", label: "Energias" },
] as const;

function cardKey(item: DeckImageItem) {
  return item.id || item.cardId || `${item.category}-${item.name}-${item.setCode}-${item.collectorNumber}`;
}

export function DeckImageView({
  items,
  playerName,
  className,
}: {
  items: DeckImageItem[];
  playerName: string;
  className?: string;
}) {
  const total = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("font-bold", className)}
          disabled={!items.length}
        >
          <Images /> Ver como imagem
        </Button>
      </DialogTrigger>
      <DialogContent className="grid h-[calc(100dvh-1rem)] w-[calc(100%-1rem)] grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden rounded-2xl p-0 [&_[data-slot=dialog-close]]:text-white sm:h-[min(92dvh,900px)] sm:w-[calc(100%-2rem)] sm:max-w-7xl sm:rounded-3xl">
        <DialogHeader className="bg-[#152238] px-5 py-5 pr-14 text-left text-white sm:px-7 sm:py-6">
          <DialogTitle className="flex items-center gap-2 text-xl font-black sm:text-2xl">
            <Images className="size-5 text-[#e0b348]" /> Decklist em imagens
          </DialogTitle>
          <DialogDescription className="text-white/65">
            {playerName} · {total} cartas · {items.length} impressões distintas
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 overflow-y-auto overscroll-contain bg-[#f7f5ed] p-3 sm:p-5 md:p-6">
          <div className="space-y-6">
            {sections.map(({ category, label }) => {
              const categoryItems = items.filter((item) => item.category === category);
              if (!categoryItems.length) return null;
              const quantity = categoryItems.reduce((sum, item) => sum + item.quantity, 0);

              return (
                <section key={category}>
                  <div className="mb-3 flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-black text-[#152238]">{label}</h3>
                    <span className="font-mono text-sm font-black text-primary">{quantity} cartas</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3 md:grid-cols-5 lg:grid-cols-7 xl:grid-cols-8">
                    {categoryItems.map((item) => (
                      <figure key={cardKey(item)} className="min-w-0">
                        <div className="relative">
                          <CardArtwork
                            item={item}
                            linked={false}
                            className="aspect-[2.5/3.5] h-auto w-full rounded-lg border-0 bg-muted object-cover shadow-md sm:rounded-xl"
                          />
                          <span className="absolute top-1.5 left-1.5 grid min-w-7 place-items-center rounded-full border border-white/40 bg-[#152238]/95 px-1.5 py-1 font-mono text-xs font-black text-white shadow-lg sm:top-2 sm:left-2 sm:min-w-8 sm:text-sm">
                            {item.quantity}×
                          </span>
                        </div>
                        <figcaption className="mt-1.5 min-w-0 px-0.5">
                          <p className="truncate text-[11px] font-black text-[#152238] sm:text-xs" title={item.name}>{item.name}</p>
                          {item.setCode && item.collectorNumber && (
                            <p className="truncate font-mono text-[9px] text-muted-foreground sm:text-[10px]">
                              {item.setCode} · {item.collectorNumber}
                            </p>
                          )}
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
