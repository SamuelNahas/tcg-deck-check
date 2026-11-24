"use client";

import { storedLabel } from "@/lib/i18n/stored-labels";
import { useCallback, useEffect, useState } from "react";
import { CalendarClock, ChevronRight, Copy, Loader2, Plus, ShieldCheck, Trophy, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { api, localDateTimeValue } from "@/lib/client-api";
import { localeOf, useT } from "@/lib/i18n";
import { Judge, Session, Tournament } from "./types";
import { deadlineLabel } from "./format";
import { AppHeader } from "./app-header";

export function JudgeDashboard({ session, onOpen, onLogout }: {
  session: Extract<Session, { role: "judge" }>;
  onOpen: (tournament: Tournament) => void;
  onLogout: () => void;
}) {
  const t = useT();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [judgesOpen, setJudgesOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [deadline, setDeadline] = useState(() => localDateTimeValue(new Date(Date.now() + 24 * 60 * 60 * 1000)));
  const [now] = useState(() => Date.now());
  const [tournamentPassword, setTournamentPassword] = useState("");
  const [newJudgeName, setNewJudgeName] = useState("");
  const [newJudgeLogin, setNewJudgeLogin] = useState("");
  const [newJudgePassword, setNewJudgePassword] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tournamentData, judgeData] = await Promise.all([
        api<{ tournaments: Tournament[] }>("/api/tournaments"),
        api<{ judges: Judge[] }>("/api/judges"),
      ]);
      setTournaments(tournamentData.tournaments);
      setJudges(judgeData.judges);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tournaments.judge.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function createTournament(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api<{ tournament: Tournament }>("/api/tournaments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          eventDate,
          decklistDeadline: new Date(deadline).toISOString(),
          password: tournamentPassword,
        }),
      });
      setTournaments((current) => [data.tournament, ...current]);
      setCreateOpen(false);
      setName("");
      setEventDate("");
      setTournamentPassword("");
      toast.success(t("tournaments.judge.createdToast", { code: data.tournament.access_code }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tournaments.judge.createFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function createJudge(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const data = await api<{ judge: Judge }>("/api/judges", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newJudgeName, login: newJudgeLogin, password: newJudgePassword }),
      });
      setJudges((current) => [...current, data.judge].sort((left, right) => left.name.localeCompare(right.name, localeOf())));
      setNewJudgeName("");
      setNewJudgeLogin("");
      setNewJudgePassword("");
      toast.success(t("tournaments.judge.judgeCreated"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("tournaments.judge.judgeCreateFailed"));
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success(t("tournaments.judge.codeCopied"));
    } catch {
      toast.info(t("tournaments.judge.codeInfo", { code }));
    }
  }

  return (
    <main className="min-h-screen">
      <AppHeader title={t("tournaments.judge.title")} subtitle={t("tournaments.judge.subtitle", { name: storedLabel(t, session.user.name) })} role="judge" onLogout={onLogout} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-primary uppercase">{t("tournaments.judge.panel")}</p>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">{t("tournaments.judge.chooseOrCreate")}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="h-11" onClick={() => setJudgesOpen(true)}><ShieldCheck /> {t("tournaments.judge.judges")}</Button>
            <Button className="h-11 font-black" onClick={() => setCreateOpen(true)}><Plus /> {t("tournaments.judge.newTournament")}</Button>
          </div>
        </div>

        {loading ? (
          <div className="grid min-h-64 place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
        ) : tournaments.length ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {tournaments.map((tournament) => {
              const submitted = Number(tournament.submitted_count || 0);
              const players = Number(tournament.player_count || 0);
              return (
                <article key={tournament.id} className="overflow-hidden rounded-3xl border bg-card shadow-sm">
                  <button type="button" onClick={() => onOpen(tournament)} className="block w-full p-5 text-left transition hover:bg-accent/30">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Badge variant="outline" className={Date.parse(tournament.decklist_deadline) < now ? "border-slate-300" : "border-emerald-300 bg-emerald-50 text-emerald-800"}>
                          {Date.parse(tournament.decklist_deadline) < now ? t("tournaments.judge.deadlinePassed") : t("tournaments.judge.receiving")}
                        </Badge>
                        <h3 className="mt-3 text-xl font-black leading-tight">{storedLabel(t, tournament.name)}</h3>
                      </div>
                      <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
                    </div>
                    <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="size-4" /> {deadlineLabel(t, tournament.decklist_deadline)}</p>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-muted/70 p-3"><strong className="block font-mono text-2xl">{players}</strong><span className="text-xs text-muted-foreground">{t("tournaments.judge.registered")}</span></div>
                      <div className="rounded-xl bg-muted/70 p-3"><strong className="block font-mono text-2xl">{submitted}</strong><span className="text-xs text-muted-foreground">{t("tournaments.judge.lists")}</span></div>
                      <div className="rounded-xl bg-muted/70 p-3"><strong className="block font-mono text-2xl">{Number(tournament.checked_count || 0)}</strong><span className="text-xs text-muted-foreground">{t("tournaments.judge.checks")}</span></div>
                    </div>
                    {players > 0 && <Progress value={Math.round((submitted / players) * 100)} className="mt-4 h-2" />}
                  </button>
                  <div className="flex items-center justify-between border-t bg-muted/35 px-5 py-3">
                    <div><span className="block text-[10px] font-black tracking-wider text-muted-foreground uppercase">{t("tournaments.judge.code")}</span><strong className="font-mono text-lg tracking-[0.18em]">{tournament.access_code}</strong></div>
                    <Button variant="ghost" size="sm" onClick={() => copyCode(tournament.access_code)}><Copy /> {t("tournaments.judge.copy")}</Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border bg-card px-6 py-20 text-center shadow-sm">
            <Trophy className="mx-auto size-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-xl font-black">{t("tournaments.judge.noTournaments")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{t("tournaments.judge.noTournamentsHint")}</p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}><Plus /> {t("tournaments.judge.createTournament")}</Button>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={createTournament}>
            <DialogHeader>
              <DialogTitle>{t("tournaments.judge.newTournament")}</DialogTitle>
              <DialogDescription>{t("tournaments.judge.newTournamentDesc")}</DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-bold sm:col-span-2"><span>{t("tournaments.judge.tournamentName")}</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t("tournaments.judge.namePlaceholder")} required /></label>
              <label className="space-y-2 text-sm font-bold"><span>{t("tournaments.judge.eventDate")}</span><Input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
              <label className="space-y-2 text-sm font-bold"><span>{t("tournaments.judge.decklistDeadline")}</span><Input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label>
              <label className="space-y-2 text-sm font-bold sm:col-span-2"><span>{t("tournaments.judge.tournamentPassword")}</span><Input type="password" value={tournamentPassword} onChange={(event) => setTournamentPassword(event.target.value)} minLength={4} autoComplete="new-password" required /></label>
            </div>
            <DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>{t("tournaments.judge.cancel")}</Button><Button disabled={busy}>{busy && <Loader2 className="animate-spin" />} {t("tournaments.judge.createTournament")}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={judgesOpen} onOpenChange={setJudgesOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{t("tournaments.judge.teamAccounts")}</DialogTitle><DialogDescription>{t("tournaments.judge.teamAccountsDesc")}</DialogDescription></DialogHeader>
          <div className="mt-4 grid gap-2">
            {judges.map((judge) => <div key={judge.id} className="flex items-center justify-between rounded-xl border px-4 py-3"><div><strong>{judge.name}</strong><p className="text-xs text-muted-foreground">{t("tournaments.judge.loginLabel", { login: judge.login })}</p></div>{judge.id === session.user.id && <Badge>{t("tournaments.judge.you")}</Badge>}</div>)}
          </div>
          <form onSubmit={createJudge} className="mt-5 rounded-2xl border bg-muted/40 p-4">
            <h3 className="font-black">{t("tournaments.judge.addJudge")}</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input value={newJudgeName} onChange={(event) => setNewJudgeName(event.target.value)} placeholder={t("tournaments.judge.judgeName")} required />
              <Input value={newJudgeLogin} onChange={(event) => setNewJudgeLogin(event.target.value)} placeholder={t("tournaments.judge.loginNoSpaces")} required />
              <Input type="password" value={newJudgePassword} onChange={(event) => setNewJudgePassword(event.target.value)} placeholder={t("tournaments.judge.passwordMin")} minLength={8} className="sm:col-span-2" required />
            </div>
            <Button className="mt-3 w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />} {t("tournaments.judge.createJudgeAccount")}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}
