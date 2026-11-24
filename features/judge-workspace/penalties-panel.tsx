"use client";

import { useState } from "react";
import { Download, Gavel, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { formatDate, openPdf } from "@/lib/client-api";
import { Penalty, PenaltyCategory, PenaltyType, Player } from "./types";
import { PENALTY_CATEGORY_LABEL, PENALTY_TYPE_LABEL } from "./constants";
import { fieldClassName } from "../tournaments/constants";

export function PenaltiesPanel({ players, penalties, loading, onCreate, onDelete, reportPath, judgeName }: {
  players: Player[];
  penalties: Penalty[];
  loading: boolean;
  onCreate: (input: {
    playerId: string;
    roundLabel: string;
    tableLabel: string;
    category: PenaltyCategory;
    penaltyType: PenaltyType;
    reason: string;
    notes: string;
  }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  reportPath: string;
  judgeName: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [roundLabel, setRoundLabel] = useState("");
  const [tableLabel, setTableLabel] = useState("");
  const [category, setCategory] = useState<PenaltyCategory>("gameplay");
  const [penaltyType, setPenaltyType] = useState<PenaltyType>("warning");
  const [reason, setReason] = useState("");
  const [notes, setNotes] = useState("");

  function reset() {
    setPlayerId("");
    setRoundLabel("");
    setTableLabel("");
    setCategory("gameplay");
    setPenaltyType("warning");
    setReason("");
    setNotes("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!playerId || !reason.trim() || !tableLabel.trim() || !notes.trim()) {
      toast.error("Informe mesa, jogador, fato e fix.");
      return;
    }
    const linkedPlayer = players.find((player) => player.id === playerId);
    if (!linkedPlayer) {
      toast.error("Selecione um jogador inscrito neste torneio.");
      return;
    }
    setBusy(true);
    const input = {
      playerId: linkedPlayer.id,
      roundLabel: roundLabel.trim(),
      tableLabel: tableLabel.trim(),
      category,
      penaltyType,
      reason: reason.trim(),
      notes: notes.trim(),
    };

    // Fecha imediatamente: o registro otimista aparece na lista enquanto o
    // servidor confirma a gravação, evitando travar o juiz em redes lentas.
    reset();
    setOpen(false);
    setBusy(false);
    void onCreate(input).catch(() => undefined);
  }

  return (
    <section className="space-y-4">
      <div className="rounded-3xl border bg-[#152238] p-5 text-white shadow-sm sm:flex sm:items-center sm:justify-between sm:gap-5">
        <div>
          <p className="text-xs font-black tracking-[0.16em] text-[#e0b348] uppercase">Registro do torneio</p>
          <h2 className="mt-2 text-2xl font-black">Ocorrências e penalidades</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            Registre ocorrências de jogo, procedimento, conduta ou deck. A decisão e a investigação continuam sob responsabilidade da equipe de arbitragem.
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:min-w-52">
          <Button className="h-11 bg-[#e0b348] font-black text-[#152238] hover:bg-[#efc760]" onClick={() => setOpen(true)}>
            <Plus /> Nova ocorrência
          </Button>
          <Button variant="outline" className="h-11 border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => openPdf(reportPath)}>
            <Download /> Exportar PDF
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid min-h-52 place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
      ) : penalties.length ? (
        <>
          <div className="grid gap-3 md:hidden">
            {penalties.map((penalty) => (
              <article key={penalty.id} className="rounded-2xl border bg-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-black">{penalty.player_name}</h3>
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(penalty.created_at)}{penalty.table_label ? ` · Mesa ${penalty.table_label}` : ""}{penalty.round_label ? ` · ${penalty.round_label}` : ""}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 font-bold">{PENALTY_TYPE_LABEL[penalty.penalty_type]}</Badge>
                </div>
                <p className="mt-3 text-xs font-black tracking-wide text-primary uppercase">{PENALTY_CATEGORY_LABEL[penalty.category]}</p>
                <p className="mt-2 text-xs font-black uppercase text-muted-foreground">Fato</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{penalty.reason}</p>
                <p className="mt-2 text-xs font-black uppercase text-muted-foreground">Fix</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{penalty.notes || "Não informado"}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">Juiz: {penalty.judge_name || "não informado"}</span>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(penalty.id)} aria-label={`Excluir penalidade de ${penalty.player_name}`}><Trash2 /></Button>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-3xl border bg-card shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Jogador</TableHead>
                  <TableHead>Mesa</TableHead>
                  <TableHead>Rodada</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Penalidade</TableHead>
                  <TableHead>Ocorrência</TableHead>
                  <TableHead className="w-14"><span className="sr-only">Ações</span></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {penalties.map((penalty) => (
                  <TableRow key={penalty.id}>
                    <TableCell>
                      <strong>{penalty.player_name}</strong>
                      <span className="mt-1 block text-xs text-muted-foreground">{formatDate(penalty.created_at)}</span>
                    </TableCell>
                    <TableCell>{penalty.table_label || "-"}</TableCell>
                    <TableCell>{penalty.round_label || "-"}</TableCell>
                    <TableCell>{PENALTY_CATEGORY_LABEL[penalty.category]}</TableCell>
                    <TableCell><Badge variant="outline" className="font-bold">{PENALTY_TYPE_LABEL[penalty.penalty_type]}</Badge></TableCell>
                    <TableCell className="max-w-md whitespace-normal text-sm leading-5"><strong className="block text-xs uppercase text-muted-foreground">Fato</strong>{penalty.reason}<strong className="mt-2 block text-xs uppercase text-muted-foreground">Fix</strong>{penalty.notes || "-"}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(penalty.id)} aria-label={`Excluir penalidade de ${penalty.player_name}`}><Trash2 /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="rounded-3xl border bg-card px-6 py-16 text-center shadow-sm">
          <Gavel className="mx-auto size-11 text-muted-foreground/40" />
          <h3 className="mt-4 text-xl font-black">Nenhuma ocorrência registrada</h3>
          <p className="mt-2 text-sm text-muted-foreground">Use “Nova ocorrência” para criar o primeiro registro do torneio.</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>Nova ocorrência</DialogTitle>
              <DialogDescription>Toda ocorrência deve ficar vinculada a um jogador inscrito neste torneio.</DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-bold sm:col-span-2">
                <span>Jogador *</span>
                <select className={fieldClassName} value={playerId} onChange={(event) => setPlayerId(event.target.value)} required>
                  <option value="">Selecione o jogador</option>
                  {players.map((player) => <option key={player.id} value={player.id}>{player.name}{player.play_id ? ` · ID ${player.play_id}` : ""}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-bold">
                <span>Mesa *</span>
                <Input value={tableLabel} onChange={(event) => setTableLabel(event.target.value)} placeholder="Ex.: 12" required />
              </label>
              <label className="space-y-2 text-sm font-bold">
                <span>Rodada</span>
                <Input value={roundLabel} onChange={(event) => setRoundLabel(event.target.value)} placeholder="Ex.: Rodada 3" />
              </label>
              <div className="rounded-xl border bg-muted/50 px-3 py-3 text-sm sm:col-span-2">
                <span className="font-bold">Relatada por:</span> {judgeName}
              </div>
              <label className="space-y-2 text-sm font-bold">
                <span>Categoria *</span>
                <select className={fieldClassName} value={category} onChange={(event) => setCategory(event.target.value as PenaltyCategory)}>
                  {(Object.keys(PENALTY_CATEGORY_LABEL) as PenaltyCategory[]).map((value) => <option key={value} value={value}>{PENALTY_CATEGORY_LABEL[value]}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-bold">
                <span>Penalidade *</span>
                <select className={fieldClassName} value={penaltyType} onChange={(event) => setPenaltyType(event.target.value as PenaltyType)}>
                  {(Object.keys(PENALTY_TYPE_LABEL) as PenaltyType[]).map((value) => <option key={value} value={value}>{PENALTY_TYPE_LABEL[value]}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-bold sm:col-span-2">
                <span>Fato *</span>
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-28" placeholder="Descreva o fato observado e a razão da penalidade..." required />
              </label>
              <label className="space-y-2 text-sm font-bold sm:col-span-2">
                <span>Fix *</span>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20" placeholder="Como o estado foi corrigido ou qual ação foi aplicada..." required />
              </label>
            </div>
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Gavel />} Salvar ocorrência</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
