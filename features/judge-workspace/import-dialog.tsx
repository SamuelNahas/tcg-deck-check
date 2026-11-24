"use client";

import { useState } from "react";
import { Check, FileText, FileUp, ListChecks, Loader2, RotateCcw, TriangleAlert, Upload } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { Deck, ImportResult, Player } from "./types";
import { fieldClassName } from "../tournaments/constants";

export function ImportDialog({ open, onOpenChange, onSaved, tournamentId, players, initialPlayerId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (players: Player[]) => void;
  tournamentId: string;
  players: Player[];
  initialPlayerId: string | null;
}) {
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [rawDraft, setRawDraft] = useState("");

  function reset() {
    setText("");
    setFiles([]);
    setResults([]);
    setEditIndex(null);
    setRawDraft("");
  }

  async function parseSources() {
    if (!text.trim() && !files.length) {
      toast.error("Cole uma lista ou selecione arquivos.");
      return;
    }
    setBusy(true);
    try {
      const form = new FormData();
      if (text.trim()) form.append("text", text);
      for (const file of files) form.append("files", file);
      const data = await api<{ results: Deck[] }>(`/api/tournaments/${tournamentId}/parse`, { method: "POST", body: form });
      setResults(data.results.map((result) => ({
        ...result,
        include: result.items.length > 0,
        reviewed: !result.extractionMethod?.includes("ocr") && !result.warnings.some((warning) => warning.severity === "critical"),
        targetPlayerId: initialPlayerId ?? players.find((player) => player.status === "awaiting_deck"
          && player.name.localeCompare(result.playerName, "pt-BR", { sensitivity: "base" }) === 0)?.id ?? "",
      })));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao interpretar as listas.");
    } finally {
      setBusy(false);
    }
  }

  async function reprocessRaw() {
    if (editIndex === null) return;
    setBusy(true);
    try {
      const form = new FormData();
      form.append("text", rawDraft);
      const data = await api<{ results: Deck[] }>(`/api/tournaments/${tournamentId}/parse`, { method: "POST", body: form });
      const parsed = data.results[0];
      setResults((current) => current.map((result, index) => index === editIndex ? {
        ...parsed,
        playerName: parsed.playerName || result.playerName,
        sourceName: result.sourceName,
        extractionMethod: result.extractionMethod,
        include: true,
        reviewed: false,
        targetPlayerId: result.targetPlayerId,
      } : result));
      setEditIndex(null);
      toast.success("Texto reprocessado. Revise o resultado.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao reprocessar.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAll() {
    const selected = results.filter((result) => result.include);
    if (!selected.length) {
      toast.error("Selecione ao menos uma lista.");
      return;
    }
    const missingReview = selected.find((result) => !result.reviewed || (!result.targetPlayerId && !result.playerName.trim()));
    if (missingReview) {
      toast.error("Revise e confirme todas as listas selecionadas.");
      return;
    }
    setBusy(true);
    try {
      const payload = selected.map((result) => {
        const target = players.find((player) => player.id === result.targetPlayerId);
        const name = target?.name ?? result.playerName.trim();
        return {
          playerId: target?.id,
          name,
          sourceName: result.sourceName,
          deck: {
          playerName: name,
          items: result.items,
          total: result.total,
          warnings: result.warnings,
          sourceName: result.sourceName,
          rawText: "",
          extractionMethod: result.extractionMethod,
        },
        };
      });
      const data = await api<{ players: Player[] }>(`/api/tournaments/${tournamentId}/players/bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ players: payload }),
      });
      onSaved(data.players);
      onOpenChange(false);
      reset();
      toast.success(`${data.players.length} lista${data.players.length === 1 ? "" : "s"} salva${data.players.length === 1 ? "" : "s"}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao salvar.");
    } finally {
      setBusy(false);
    }
  }

  const selectedCount = results.filter((result) => result.include).length;

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next && !busy) reset(); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl"><FileUp className="text-primary" /> Importar listas</DialogTitle>
            <DialogDescription>
              Selecione vários PDFs/imagens de uma vez ou cole mensagens do WhatsApp. Separe jogadores colados com uma linha de <strong>=====</strong>.
            </DialogDescription>
          </DialogHeader>

          {!results.length ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2 rounded-2xl border bg-muted/40 p-4">
                <label htmlFor="deck-files" className="flex items-center gap-2 font-black"><Upload className="size-5" /> PDFs e imagens</label>
                <p className="text-xs leading-5 text-muted-foreground">RK9 é lido diretamente; formulários oficiais e fotos passam por OCR no seu computador.</p>
                <Input
                  id="deck-files"
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={(event) => setFiles(Array.from(event.target.files || []))}
                  className="h-12 bg-white file:font-bold"
                />
                {files.length > 0 && <p className="text-sm font-bold text-primary">{files.length} arquivo{files.length === 1 ? "" : "s"} selecionado{files.length === 1 ? "" : "s"}</p>}
              </div>
              <div className="space-y-2 rounded-2xl border bg-muted/40 p-4">
                <label htmlFor="deck-text" className="flex items-center gap-2 font-black"><FileText className="size-5" /> Texto do WhatsApp</label>
                <p className="text-xs leading-5 text-muted-foreground">O nome do jogador deve vir antes de Pokémon / Treinador / Energia.</p>
                <Textarea
                  id="deck-text"
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  placeholder={'Luciano\n\nPokémon: 12\n3 Kadabra MEG 55...'}
                  className="min-h-40 bg-white font-mono text-xs"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-muted/40 px-4 py-3">
                <p className="text-sm"><strong>{results.length}</strong> resultado{results.length === 1 ? "" : "s"} · confirme OCR e alertas antes de salvar.</p>
                <Button variant="outline" size="sm" onClick={() => setResults([])}><RotateCcw /> Trocar arquivos</Button>
              </div>
              {results.map((result, index) => {
                const critical = result.warnings.some((warning) => warning.severity === "critical");
                return (
                  <article key={`${result.sourceName}-${index}`} className={cn(
                    "rounded-2xl border bg-card p-4",
                    result.include ? "" : "opacity-55",
                    critical && result.include && "border-red-200",
                  )}>
                    <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-start">
                      <Checkbox
                        checked={result.include}
                        onCheckedChange={(checked) => setResults((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, include: Boolean(checked) } : entry))}
                        className="mt-2 size-6"
                        aria-label={`Incluir ${result.playerName}`}
                      />
                      <div className="min-w-0 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-center">
                          <Input
                            value={result.playerName}
                            onChange={(event) => setResults((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, playerName: event.target.value, reviewed: false } : entry))}
                            className="h-11 text-base font-bold"
                            aria-label="Nome do jogador"
                          />
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className={cn("font-mono font-black", result.total === 60 ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-red-300 bg-red-50 text-red-800")}>{result.total}/60</Badge>
                            <Badge variant="secondary">{result.items.length} pilhas</Badge>
                            {result.extractionMethod?.includes("ocr") && <Badge className="bg-amber-100 text-amber-900">OCR</Badge>}
                          </div>
                        </div>
                        <p className="truncate text-xs text-muted-foreground">{result.sourceName}</p>
                        {players.some((player) => player.status === "awaiting_deck") && (
                          <label className="block space-y-1 text-xs font-bold">
                            <span>Vincular a jogador sem lista</span>
                            <select
                              className={fieldClassName}
                              value={result.targetPlayerId}
                              onChange={(event) => setResults((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, targetPlayerId: event.target.value } : entry))}
                            >
                              <option value="">Criar novo jogador</option>
                              {players.filter((player) => player.status === "awaiting_deck").map((player) => (
                                <option key={player.id} value={player.id}>{player.name}{player.play_id ? ` · ID ${player.play_id}` : ""}</option>
                              ))}
                            </select>
                          </label>
                        )}
                        {result.warnings.map((warning) => (
                          <p key={`${warning.code}-${warning.message}`} className={cn(
                            "flex items-start gap-2 rounded-lg px-3 py-2 text-xs",
                            warning.severity === "critical" ? "bg-red-50 text-red-900" : "bg-amber-50 text-amber-900",
                          )}>
                            <TriangleAlert className="mt-0.5 size-3.5 shrink-0" /> {warning.message}
                          </p>
                        ))}
                        {!result.items.length && <p className="text-sm font-bold text-red-700">Nenhuma carta reconhecida. Revise o texto extraído.</p>}
                        <label className="flex min-h-10 cursor-pointer items-center gap-3 rounded-xl border bg-white px-3 py-2 text-sm font-bold">
                          <Checkbox
                            checked={result.reviewed}
                            onCheckedChange={(checked) => setResults((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, reviewed: Boolean(checked) } : entry))}
                          />
                          Revisei nome, total e cartas reconhecidas
                        </label>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => { setEditIndex(index); setRawDraft(result.rawText); }}
                      >
                        Revisar texto
                      </Button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <DialogFooter className="sticky -bottom-6 -mx-6 -mb-6 border-t bg-card p-4 sm:px-6">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancelar</Button>
            {!results.length ? (
              <Button onClick={parseSources} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <ListChecks />} Interpretar listas
              </Button>
            ) : (
              <Button onClick={saveAll} disabled={busy || !selectedCount}>
                {busy ? <Loader2 className="animate-spin" /> : <Check />} Salvar {selectedCount} lista{selectedCount === 1 ? "" : "s"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editIndex !== null} onOpenChange={(next) => { if (!next) setEditIndex(null); }}>
        <DialogContent className="sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Revisar texto reconhecido</DialogTitle>
            <DialogDescription>Corrija linhas do OCR no formato “quantidade nome coleção número” e reprocese.</DialogDescription>
          </DialogHeader>
          <Textarea value={rawDraft} onChange={(event) => setRawDraft(event.target.value)} className="min-h-[52vh] font-mono text-xs" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditIndex(null)}>Cancelar</Button>
            <Button onClick={reprocessRaw} disabled={busy}>{busy && <Loader2 className="animate-spin" />} Reprocessar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
