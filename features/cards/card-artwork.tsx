"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

import { api } from "@/lib/client-api";
import { type ArtworkCard, uniqueArtworkUrls } from "./artwork";
import { cn } from "@/lib/utils";

type ResolvedArtwork = ArtworkCard & {
  imageFallbacks?: string[];
};

function initialSources(item: ArtworkCard) {
  return uniqueArtworkUrls([
    item.imageSmall,
    ...(item.imageFallbacks || []),
    item.imageLarge,
  ]);
}

export function CardArtwork({
  item,
  className = "h-20 w-14",
  linked = true,
}: {
  item: ArtworkCard;
  className?: string;
  linked?: boolean;
}) {
  const [sources, setSources] = useState(() => initialSources(item));
  const [sourceIndex, setSourceIndex] = useState(0);
  const [shouldResolve, setShouldResolve] = useState(() => initialSources(item).length === 0);
  const requested = useRef(false);
  const image = sources[sourceIndex] || "";

  useEffect(() => {
    if (!shouldResolve || requested.current || !item.name) return;
    requested.current = true;
    const params = new URLSearchParams({ name: item.name });
    if (item.category) params.set("category", item.category);
    if (item.setCode) params.set("setCode", item.setCode);
    if (item.collectorNumber) params.set("number", item.collectorNumber);
    let active = true;
    api<{ card: ResolvedArtwork | null }>(`/api/cards/resolve?${params}`)
      .then(({ card }) => {
        if (!active || !card) return;
        setSources((current) => uniqueArtworkUrls([
          ...current,
          card.imageSmall,
          ...(card.imageFallbacks || []),
          card.imageLarge,
        ]));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [item.category, item.collectorNumber, item.name, item.setCode, shouldResolve]);

  function tryNextSource() {
    const nextIndex = sourceIndex + 1;
    setSourceIndex(nextIndex);
    if (nextIndex >= sources.length - 1) setShouldResolve(true);
  }

  if (!image) {
    return (
      <div className={cn("grid shrink-0 place-items-center rounded-lg border bg-muted text-muted-foreground", className)} title={`Imagem não encontrada para ${item.name}`}>
        <ImageOff className="size-4" aria-hidden="true" />
        <span className="sr-only">Imagem não encontrada</span>
      </div>
    );
  }

  const artwork = (
    // External providers are selected at runtime and automatically retried on error.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt={`Carta ${item.name}`}
      className={cn("shrink-0 rounded-lg border object-cover shadow-sm", className)}
      loading="lazy"
      onError={tryNextSource}
    />
  );

  if (!linked) return artwork;
  return (
    <a href={image} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`Abrir imagem de ${item.name}`}>
      {artwork}
    </a>
  );
}
