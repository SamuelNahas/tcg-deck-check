"use client";

import { storedLabel } from "@/lib/i18n/stored-labels";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, Check, ChevronRight, KeyRound, Loader2, Plus, Trophy } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { api, formatDate } from "@/lib/client-api";
import { useT } from "@/lib/i18n";
import { Session, Tournament } from "./types";
import { deadlineLabel } from "./format";
import { AppHeader } from "./app-header";
import { PlayerTournamentView } from "./player-tournament-view";

export function PlayerDashboard({ session, onLogout }: {
  session: Extract<Session, { role: "player" }>;
  onLogout: () => void;
}) {
  const t = useT();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selected, setSelected] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [joinOpen, setJoinOpen] = useState(false);
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ tournaments: Tournament[] }>("/api/tournaments");
      setTournaments(data.tournaments);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tournaments.player.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function join(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api<{ tournament: Tournament }>("/api/tournaments/join", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, password }),
      });
      setJoinOpen(false);
      setCode("");
      setPassword("");
      await load();
      setSelected(data.tournament);
      toast.success(t("tournaments.player.joined"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tournaments.player.joinFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    return <PlayerTournamentView session={session} tournament={selected} onBack={() => { setSelected(null); void load(); }} onLogout={onLogout} />;
  }

  return (
    <main className="min-h-screen">
      <AppHeader title={t("tournaments.player.title")} subtitle={`${session.user.name} · Play! ID ${session.user.play_id}`} role="player" onLogout={onLogout} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div><p className="text-xs font-black tracking-[0.16em] text-primary uppercase">{t("tournaments.player.area")}</p><h2 className="mt-1 text-2xl font-black">{t("tournaments.player.heading")}</h2></div>
          <Button className="h-11 font-black" onClick={() => setJoinOpen(true)}><Plus /> {t("tournaments.player.join")}</Button>
        </div>
        {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div> : tournaments.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {tournaments.map((tournament) => (
              <button key={tournament.id} type="button" onClick={() => setSelected(tournament)} className="rounded-3xl border bg-card p-5 text-left shadow-sm transition hover:border-primary/40 hover:bg-accent/25">
                <div className="flex items-start justify-between gap-3"><Badge className={tournament.submission_locked ? "bg-emerald-700" : "bg-amber-600"}>{tournament.submission_locked ? t("tournaments.player.listSubmitted") : t("tournaments.player.listPending")}</Badge><ChevronRight className="size-5 text-muted-foreground" /></div>
                <h3 className="mt-4 text-xl font-black">{storedLabel(t, tournament.name)}</h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="size-4" /> {deadlineLabel(t, tournament.decklist_deadline)}</p>
                {tournament.deck_submitted_at && <p className="mt-3 text-xs font-bold text-emerald-700">{t("tournaments.player.submittedAt", { date: formatDate(tournament.deck_submitted_at) })}</p>}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border bg-card px-6 py-20 text-center shadow-sm"><Trophy className="mx-auto size-12 text-muted-foreground/40" /><h3 className="mt-4 text-xl font-black">{t("tournaments.player.notRegistered")}</h3><p className="mt-2 text-sm text-muted-foreground">{t("tournaments.player.askJudge")}</p><Button className="mt-5" onClick={() => setJoinOpen(true)}><KeyRound /> {t("tournaments.player.useCode")}</Button></div>
        )}
      </div>
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={join}>
            <DialogHeader><DialogTitle>{t("tournaments.player.joinTitle")}</DialogTitle><DialogDescription>{t("tournaments.player.joinDesc")}</DialogDescription></DialogHeader>
            <div className="mt-5 space-y-4">
              <label className="block space-y-2 text-sm font-bold"><span>{t("tournaments.player.code")}</span><Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="h-12 text-center font-mono text-xl tracking-[0.2em] uppercase" maxLength={8} required /></label>
              <label className="block space-y-2 text-sm font-bold"><span>{t("tournaments.player.password")}</span><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            </div>
            <DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => setJoinOpen(false)}>{t("tournaments.player.cancel")}</Button><Button disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Check />} {t("tournaments.player.confirm")}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
