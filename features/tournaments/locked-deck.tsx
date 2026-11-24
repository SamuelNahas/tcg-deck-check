"use client";

import { LockKeyhole, ShieldCheck } from "lucide-react";
import { CardArtwork } from "@/features/cards/card-artwork";
import { DeckImageView } from "@/features/cards/deck-image-view";
import { formatDate } from "@/lib/client-api";
import { useT } from "@/lib/i18n";
import { Registration, Tournament } from "./types";

const CATEGORIES = ["pokemon", "trainer", "energy"] as const;

export function LockedDeck({ registration, tournament }: { registration: Registration; tournament: Tournament }) {
  const t = useT();
  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="bg-[#152238] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div><p className="flex items-center gap-2 text-xs font-black tracking-[0.16em] text-[#e0b348] uppercase"><LockKeyhole className="size-4" /> {t("tournaments.locked.done")}</p><h2 className="mt-2 text-2xl font-black">{t("tournaments.locked.title")}</h2><p className="mt-2 text-sm text-white/65">{t("tournaments.locked.submittedAt", { date: registration.deck_submitted_at ? formatDate(registration.deck_submitted_at) : t("tournaments.locked.noDate") })}</p><DeckImageView items={registration.deck.items} playerName={registration.name} className="mt-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" /></div>
          <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center sm:mt-0"><strong className="font-mono text-4xl text-[#e0b348]">{registration.deck.total}</strong><span className="ml-1 text-white/60">/60</span></div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          {CATEGORIES.map((category) => <div key={category} className="rounded-xl bg-muted/60 p-3"><strong>{t(`card.category.${category}`)}</strong><span className="float-right font-mono font-black">{registration.deck.items.filter((item) => item.category === category).reduce((sum, item) => sum + item.quantity, 0)}</span></div>)}
        </div>
      </div>
      {CATEGORIES.map((category) => {
        const cards = registration.deck.items.filter((item) => item.category === category);
        if (!cards.length) return null;
        return <div key={category}><h3 className="mb-3 text-lg font-black">{t(`card.category.${category}`)}</h3><div className="grid gap-3 md:grid-cols-2">{cards.map((item) => <article key={item.id || `${item.name}-${item.setCode}-${item.collectorNumber}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm"><CardArtwork item={item} /><div className="min-w-0 flex-1"><p className="font-black"><span className="font-mono text-primary">{item.quantity}×</span> {item.name}</p>{category === "pokemon" ? <p className="mt-1 font-mono text-xs text-muted-foreground">{item.setCode} · {item.collectorNumber}</p> : <p className="mt-1 text-xs text-muted-foreground">{t("tournaments.locked.nameQty")}</p>}</div></article>)}</div></div>;
      })}
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><ShieldCheck className="mr-2 inline size-5" />{t("tournaments.locked.preserved", { name: tournament.name })}</p>
    </section>
  );
}
