"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Loader2, LockKeyhole, Minus, Plus, Search, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { CardArtwork } from "@/features/cards/card-artwork";
import { DeckImageView } from "@/features/cards/deck-image-view";
import { api, formatDate } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { CATEGORY_LABEL, DeckWarning } from "@/lib/deck-types";
import { fieldClassName } from "./constants";
import { CardEntry, CatalogCard, Registration, Tournament } from "./types";

export function DeckBuilder({ tournament, onSubmitted }: {
  tournament: Tournament;
  onSubmitted: (registration: Registration) => void;
}) {
  const [items, setItems] = useState<CardEntry[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"all" | "pokemon" | "trainer" | "energy">("all");
  const [results, setResults] = useState<CatalogCard[]>([]);
  const [searching, setSearching] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [warnings, setWarnings] = useState<DeckWarning[]>([]);
  const [now] = useState(() => Date.now());
  const deadlineClosed = Date.parse(tournament.decklist_deadline) < now;
  const total = items.reduce((sum, item) => sum + item.quantity, 0);

  useEffect(() => {
    if (query.trim().length < 2) return;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query.trim(), category });
      api<{ cards: CatalogCard[] }>(`/api/cards/search?${params}`)
        .then((data) => setResults(data.cards))
        .catch((error) => toast.error(error instanceof Error ? error.message : "Falha ao buscar cartas."))
        .finally(() => setSearching(false));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [category, query]);

  function changeQuery(value: string) {
    setQuery(value);
    setWarnings([]);
    if (value.trim().length < 2) {
      setResults([]);
      setSearching(false);
    } else {
      setSearching(true);
    }
  }

  function changeSearchCategory(value: typeof category) {
    setCategory(value);
    if (query.trim().length >= 2) setSearching(true);
  }

  function itemKey(item: Pick<CardEntry, "category" | "name" | "setCode" | "collectorNumber">) {
    return item.category === "pokemon"
      ? `${item.category}|${item.name.toLocaleLowerCase()}|${item.setCode}|${item.collectorNumber}`
      : `${item.category}|${item.name.toLocaleLowerCase()}`;
  }

  function addCard(card: CatalogCard) {
    setItems((current) => {
      const key = itemKey(card);
      const found = current.find((item) => itemKey(item) === key);
      if (found) return current.map((item) => itemKey(item) === key ? { ...item, quantity: Math.min(60, item.quantity + 1) } : item);
      return [...current, {
        ...card,
        setCode: card.category === "pokemon" ? card.setCode : "",
        collectorNumber: card.category === "pokemon" ? card.collectorNumber : "",
        quantity: 1,
      }];
    });
    setWarnings([]);
  }

  function setQuantity(target: CardEntry, quantity: number) {
    setItems((current) => quantity <= 0
      ? current.filter((item) => itemKey(item) !== itemKey(target))
      : current.map((item) => itemKey(item) === itemKey(target) ? { ...item, quantity: Math.min(60, quantity) } : item));
    setWarnings([]);
  }

  async function importLiveList() {
    setImporting(true);
    try {
      const data = await api<{ deck: { items: CardEntry[]; warnings: DeckWarning[] } }>(`/api/tournaments/${tournament.id}/player/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText }),
      });
      setItems(data.deck.items);
      setWarnings(data.deck.warnings);
      setImportOpen(false);
      setImportText("");
      toast.success("Lista importada. Confira as impressões dos Pokémon.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao importar a lista.");
    } finally {
      setImporting(false);
    }
  }

  async function submitDeck() {
    setSubmitting(true);
    try {
      const data = await api<{ player: Registration }>(`/api/tournaments/${tournament.id}/deck`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      onSubmitted(data.player);
      toast.success("Decklist enviada e bloqueada.");
    } catch (error) {
      const details = (error as Error & { details?: { warnings?: DeckWarning[] } }).details;
      if (details?.warnings) setWarnings(details.warnings);
      toast.error(error instanceof Error ? error.message : "Não foi possível enviar a lista.");
    } finally {
      setSubmitting(false);
    }
  }

  const grouped = useMemo(() => (Object.keys(CATEGORY_LABEL) as Array<keyof typeof CATEGORY_LABEL>).map((value) => ({
    category: value,
    items: items.filter((item) => item.category === value),
    quantity: items.filter((item) => item.category === value).reduce((sum, item) => sum + item.quantity, 0),
  })), [items]);

  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-5 bg-[#152238] p-5 text-white md:grid-cols-[1fr_auto] md:items-center">
          <div><p className="text-xs font-black tracking-[0.16em] text-[#e0b348] uppercase">Editor de decklist</p><h2 className="mt-2 text-2xl font-black">Monte e envie sua lista</h2><p className="mt-2 text-sm leading-6 text-white/65">Busque a carta e toque na imagem para adicionar. Pokémon precisam da coleção e do número exatos.</p><DeckImageView items={items} playerName="Prévia da sua decklist" className="mt-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" /></div>
          <div className={cn("rounded-2xl border px-5 py-3 text-center", total === 60 ? "border-emerald-300 bg-emerald-400/10" : "border-white/15 bg-white/10")}><strong className={cn("font-mono text-4xl", total === 60 ? "text-emerald-300" : "text-[#e0b348]")}>{total}</strong><span className="ml-1 text-white/55">/60</span></div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">{grouped.map((group) => <div key={group.category} className="rounded-xl bg-muted/60 p-3"><strong>{CATEGORY_LABEL[group.category]}</strong><span className="float-right font-mono font-black">{group.quantity}</span></div>)}</div>
      </div>

      {deadlineClosed && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-900">O prazo encerrou em {formatDate(tournament.decklist_deadline)}. Novos envios estão bloqueados.</div>}

      <div className="rounded-3xl border bg-card p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1"><Search className="pointer-events-none absolute top-3.5 left-3.5 size-5 text-muted-foreground" /><Input value={query} onChange={(event) => changeQuery(event.target.value)} placeholder="Buscar carta pelo nome..." className="h-12 pl-11 text-base" disabled={deadlineClosed} /></div>
          <select className={cn(fieldClassName, "h-12 sm:w-44")} value={category} onChange={(event) => changeSearchCategory(event.target.value as typeof category)} disabled={deadlineClosed}><option value="all">Todas</option><option value="pokemon">Pokémon</option><option value="trainer">Treinadores</option><option value="energy">Energias</option></select>
          <Button type="button" variant="outline" className="h-12" onClick={() => setImportOpen(true)} disabled={deadlineClosed}><Upload /> Importar PTCG Live</Button>
        </div>
        {searching && <div className="grid min-h-32 place-items-center"><Loader2 className="size-7 animate-spin text-primary" /></div>}
        {!searching && results.length > 0 && <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">{results.map((card) => <button type="button" key={card.cardId} onClick={() => addCard(card)} className="group overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"><CardArtwork item={card} linked={false} className="aspect-[2.5/3.5] h-auto w-full rounded-none border-0 bg-muted shadow-none" /><div className="p-2"><p className="line-clamp-2 text-xs font-black">{card.name}</p><p className="mt-1 truncate font-mono text-[10px] text-muted-foreground">{card.setCode} · {card.collectorNumber}</p></div></button>)}</div>}
        {!searching && query.trim().length >= 2 && results.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Nenhuma carta encontrada. Confira o nome ou importe a lista do PTCG Live.</p>}
      </div>

      {warnings.length > 0 && <div className="grid gap-2">{warnings.map((warning) => <p key={`${warning.code}-${warning.message}`} className={cn("rounded-xl border px-4 py-3 text-sm", warning.severity === "critical" ? "border-red-200 bg-red-50 text-red-900" : "border-amber-200 bg-amber-50 text-amber-900")}>{warning.message}</p>)}</div>}

      {items.length ? grouped.map((group) => group.items.length ? (
        <div key={group.category}>
          <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-black">{CATEGORY_LABEL[group.category]}</h3><Badge variant="outline" className="font-mono">{group.quantity}</Badge></div>
          <div className="grid gap-3 md:grid-cols-2">{group.items.map((item) => <article key={itemKey(item)} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm"><CardArtwork item={item} /><div className="min-w-0 flex-1"><p className="font-black leading-tight">{item.name}</p>{item.category === "pokemon" ? <p className="mt-1 font-mono text-xs text-muted-foreground">{item.setCode} · {item.collectorNumber}</p> : <p className="mt-1 text-xs text-muted-foreground">Impressão não diferencia a pilha</p>}<button type="button" className="mt-2 flex items-center gap-1 text-xs font-bold text-destructive" onClick={() => setQuantity(item, 0)}><Trash2 className="size-3.5" /> Remover</button></div><div className="flex shrink-0 items-center rounded-xl border bg-white p-1"><Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => setQuantity(item, item.quantity - 1)}><Minus /></Button><strong className="min-w-8 text-center font-mono text-lg">{item.quantity}</strong><Button type="button" variant="ghost" size="icon" className="size-9" onClick={() => setQuantity(item, item.quantity + 1)}><Plus /></Button></div></article>)}</div>
        </div>
      ) : null) : <div className="rounded-3xl border border-dashed bg-card/60 px-6 py-14 text-center"><Search className="mx-auto size-10 text-muted-foreground/40" /><h3 className="mt-3 font-black">A lista ainda está vazia</h3><p className="mt-1 text-sm text-muted-foreground">Busque cartas ou importe o texto exportado pelo Pokémon TCG Live.</p></div>}

      <div className="sticky bottom-3 z-20 rounded-2xl border bg-card/95 p-3 shadow-[0_12px_40px_rgba(21,34,56,0.18)] backdrop-blur sm:flex sm:items-center sm:justify-between sm:gap-4">
        <div className="mb-3 sm:mb-0"><p className="font-black">Revisão final</p><p className="text-xs text-muted-foreground">Depois do envio, esta lista não poderá ser editada.</p></div>
        <AlertDialog>
          <AlertDialogTrigger asChild><Button className="h-12 w-full font-black sm:w-auto" disabled={total !== 60 || deadlineClosed || submitting}>{submitting ? <Loader2 className="animate-spin" /> : <LockKeyhole />} Enviar lista definitiva</Button></AlertDialogTrigger>
          <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Enviar e bloquear esta decklist?</AlertDialogTitle><AlertDialogDescription>Confira as 60 cartas, principalmente coleção e número de cada Pokémon. Após confirmar, sua conta não poderá substituir nem editar a lista neste torneio.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar e revisar</AlertDialogCancel><AlertDialogAction onClick={submitDeck}>Confirmar envio</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
        </AlertDialog>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-2xl"><DialogHeader><DialogTitle>Importar do Pokémon TCG Live</DialogTitle><DialogDescription>No jogo, exporte o baralho e cole todo o texto. Depois, confira visualmente cada impressão de Pokémon.</DialogDescription></DialogHeader><Textarea value={importText} onChange={(event) => setImportText(event.target.value)} className="min-h-72 font-mono text-xs" placeholder={'Pokémon: 12\n3 Abra MEG 54\n...'} /><DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>Cancelar</Button><Button onClick={importLiveList} disabled={importing || !importText.trim()}>{importing ? <Loader2 className="animate-spin" /> : <FileText />} Importar e revisar</Button></DialogFooter></DialogContent>
      </Dialog>
    </section>
  );
}
