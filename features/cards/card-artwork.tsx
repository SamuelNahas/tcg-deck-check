"use client";

import { useEffect, useRef, useState } from "react";
import { ImageOff } from "lucide-react";

import { api } from "@/lib/client-api";
import { type ArtworkCard, uniqueArtworkUrls } from "./artwork";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n";

type ResolvedArtwork = ArtworkCard & {
  imageFallbacks?: string[];
};

function orderedSources(card: ArtworkCard, prefer: "small" | "large") {
  const [first, second] = prefer === "large" ? [card.imageLarge, card.imageSmall] : [card.imageSmall, card.imageLarge];
  return uniqueArtworkUrls([first, second, ...(card.imageFallbacks || [])]);
}

export function CardArtwork({
  item,
  className = "h-20 w-14",
  linked = true,
  prefer = "small",
}: {
  item: ArtworkCard;
  className?: string;
  linked?: boolean;
  /** "large" loads the high-resolution image first, for cards shown big. */
  prefer?: "small" | "large";
}) {
  const t = useT();
  const [sources, setSources] = useState(() => orderedSources(item, prefer));
  const [sourceIndex, setSourceIndex] = useState(0);
  const [shouldResolve, setShouldResolve] = useState(() => orderedSources(item, prefer).length === 0);
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
        setSources((current) => uniqueArtworkUrls([...current, ...orderedSources(card, prefer)]));
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [item.category, item.collectorNumber, item.name, item.setCode, prefer, shouldResolve]);

  function tryNextSource() {
    const nextIndex = sourceIndex + 1;
    setSourceIndex(nextIndex);
    if (nextIndex >= sources.length - 1) setShouldResolve(true);
  }

  if (!image) {
    return (
      <div className={cn("grid shrink-0 place-items-center rounded-lg border bg-muted text-muted-foreground", className)} title={t("cards.artwork.notFoundFor", { name: item.name })}>
        <ImageOff className="size-4" aria-hidden="true" />
        <span className="sr-only">{t("cards.artwork.notFound")}</span>
      </div>
    );
  }

  const artwork = (
    // External providers are selected at runtime and automatically retried on error.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={image}
      alt={t("cards.artwork.alt", { name: item.name })}
      className={cn("shrink-0 rounded-lg border object-cover shadow-sm", className)}
      loading="lazy"
      onError={tryNextSource}
    />
  );

  if (!linked) return artwork;
  return (
    <a href={image} target="_blank" rel="noreferrer" className="shrink-0" aria-label={t("cards.artwork.open", { name: item.name })}>
      {artwork}
    </a>
  );
}
