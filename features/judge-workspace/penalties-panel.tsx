"use client";

import { storedLabel } from "@/lib/i18n/stored-labels";
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
import { useT } from "@/lib/i18n";
import { fieldClassName } from "../tournaments/constants";

const CATEGORIES: PenaltyCategory[] = ["deck", "gameplay", "procedure", "conduct", "other"];
const TYPES: PenaltyType[] = ["caution", "warning", "double_prize", "quadruple_prize", "game_loss", "match_loss", "disqualification", "other"];

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
  const t = useT();
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
      toast.error(t("panels.penalties.errRequired"));
      return;
    }
    const linkedPlayer = players.find((player) => player.id === playerId);
    if (!linkedPlayer) {
      toast.error(t("panels.penalties.errPlayer"));
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
          <p className="text-xs font-black tracking-[0.16em] text-[#e0b348] uppercase">{t("panels.penalties.kicker")}</p>
          <h2 className="mt-2 text-2xl font-black">{t("panels.penalties.title")}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
            {t("panels.penalties.intro")}
          </p>
        </div>
        <div className="mt-4 flex flex-col gap-2 sm:mt-0 sm:min-w-52">
          <Button className="h-11 bg-[#e0b348] font-black text-[#152238] hover:bg-[#efc760]" onClick={() => setOpen(true)}>
            <Plus /> {t("panels.penalties.new")}
          </Button>
          <Button variant="outline" className="h-11 border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white" onClick={() => openPdf(reportPath)}>
            <Download /> {t("panels.penalties.exportPdf")}
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
                    <p className="mt-1 text-xs text-muted-foreground">{formatDate(penalty.created_at)}{penalty.table_label ? ` · ${t("panels.penalties.tableInline", { table: penalty.table_label })}` : ""}{penalty.round_label ? ` · ${penalty.round_label}` : ""}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0 font-bold">{t(`penalty.type.${penalty.penalty_type}`)}</Badge>
                </div>
                <p className="mt-3 text-xs font-black tracking-wide text-primary uppercase">{t(`penalty.category.${penalty.category}`)}</p>
                <p className="mt-2 text-xs font-black uppercase text-muted-foreground">{t("panels.penalties.fact")}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{penalty.reason}</p>
                <p className="mt-2 text-xs font-black uppercase text-muted-foreground">{t("panels.penalties.fix")}</p>
                <p className="mt-1 whitespace-pre-wrap text-sm leading-6">{penalty.notes || t("panels.penalties.notProvided")}</p>
                <div className="mt-3 flex items-center justify-between gap-3">
                  <span className="text-xs text-muted-foreground">{t("panels.penalties.judge", { name: penalty.judge_name ? storedLabel(t, penalty.judge_name) : t("panels.penalties.notProvidedLower") })}</span>
                  <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(penalty.id)} aria-label={t("panels.penalties.deleteAria", { name: penalty.player_name })}><Trash2 /></Button>
                </div>
              </article>
            ))}
          </div>
          <div className="hidden overflow-hidden rounded-3xl border bg-card shadow-sm md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("panels.penalties.colPlayer")}</TableHead>
                  <TableHead>{t("panels.penalties.colTable")}</TableHead>
                  <TableHead>{t("panels.penalties.colRound")}</TableHead>
                  <TableHead>{t("panels.penalties.colCategory")}</TableHead>
                  <TableHead>{t("panels.penalties.colPenalty")}</TableHead>
                  <TableHead>{t("panels.penalties.colIncident")}</TableHead>
                  <TableHead className="w-14"><span className="sr-only">{t("panels.penalties.colActions")}</span></TableHead>
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
                    <TableCell>{t(`penalty.category.${penalty.category}`)}</TableCell>
                    <TableCell><Badge variant="outline" className="font-bold">{t(`penalty.type.${penalty.penalty_type}`)}</Badge></TableCell>
                    <TableCell className="max-w-md whitespace-normal text-sm leading-5"><strong className="block text-xs uppercase text-muted-foreground">{t("panels.penalties.fact")}</strong>{penalty.reason}<strong className="mt-2 block text-xs uppercase text-muted-foreground">{t("panels.penalties.fix")}</strong>{penalty.notes || "-"}</TableCell>
                    <TableCell><Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(penalty.id)} aria-label={t("panels.penalties.deleteAria", { name: penalty.player_name })}><Trash2 /></Button></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ) : (
        <div className="rounded-3xl border bg-card px-6 py-16 text-center shadow-sm">
          <Gavel className="mx-auto size-11 text-muted-foreground/40" />
          <h3 className="mt-4 text-xl font-black">{t("panels.penalties.emptyTitle")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">{t("panels.penalties.emptyHint")}</p>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={submit}>
            <DialogHeader>
              <DialogTitle>{t("panels.penalties.new")}</DialogTitle>
              <DialogDescription>{t("panels.penalties.dialogDesc")}</DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-bold sm:col-span-2">
                <span>{t("panels.penalties.fieldPlayer")}</span>
                <select className={fieldClassName} value={playerId} onChange={(event) => setPlayerId(event.target.value)} required>
                  <option value="">{t("panels.penalties.selectPlayer")}</option>
                  {players.map((player) => <option key={player.id} value={player.id}>{player.name}{player.play_id ? ` · ID ${player.play_id}` : ""}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-bold">
                <span>{t("panels.penalties.fieldTable")}</span>
                <Input value={tableLabel} onChange={(event) => setTableLabel(event.target.value)} placeholder={t("panels.penalties.tablePlaceholder")} required />
              </label>
              <label className="space-y-2 text-sm font-bold">
                <span>{t("panels.penalties.fieldRound")}</span>
                <Input value={roundLabel} onChange={(event) => setRoundLabel(event.target.value)} placeholder={t("panels.penalties.roundPlaceholder")} />
              </label>
              <div className="rounded-xl border bg-muted/50 px-3 py-3 text-sm sm:col-span-2">
                <span className="font-bold">{t("panels.penalties.reportedBy")}</span> {storedLabel(t, judgeName)}
              </div>
              <label className="space-y-2 text-sm font-bold">
                <span>{t("panels.penalties.fieldCategory")}</span>
                <select className={fieldClassName} value={category} onChange={(event) => setCategory(event.target.value as PenaltyCategory)}>
                  {CATEGORIES.map((value) => <option key={value} value={value}>{t(`penalty.category.${value}`)}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-bold">
                <span>{t("panels.penalties.fieldPenalty")}</span>
                <select className={fieldClassName} value={penaltyType} onChange={(event) => setPenaltyType(event.target.value as PenaltyType)}>
                  {TYPES.map((value) => <option key={value} value={value}>{t(`penalty.type.${value}`)}</option>)}
                </select>
              </label>
              <label className="space-y-2 text-sm font-bold sm:col-span-2">
                <span>{t("panels.penalties.fieldFact")}</span>
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} className="min-h-28" placeholder={t("panels.penalties.factPlaceholder")} required />
              </label>
              <label className="space-y-2 text-sm font-bold sm:col-span-2">
                <span>{t("panels.penalties.fieldFix")}</span>
                <Textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20" placeholder={t("panels.penalties.fixPlaceholder")} required />
              </label>
            </div>
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>{t("panels.penalties.cancel")}</Button>
              <Button type="submit" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Gavel />} {t("panels.penalties.save")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
