"use client";

import { storedLabel } from "@/lib/i18n/stored-labels";
import { useCallback, useEffect, useState } from "react";
import { Archive, ArrowLeft, ClipboardCheck, Download, FileUp, Gavel, Loader2, LogOut, Plus, ShieldAlert, Users, Wifi } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, openPdf } from "@/lib/client-api";
import { localeOf, useT } from "@/lib/i18n";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Penalty, PenaltyCategory, PenaltyType, Player } from "./types";
import { StatCard } from "./stat-card";
import { PlayerList } from "./player-list";
import { CheckWorkspace } from "./check-workspace";
import { ImportDialog } from "./import-dialog";
import { PenaltiesPanel } from "./penalties-panel";
import { RulesPanel } from "./rules-panel";

export type JudgeSession = {
  role: "judge";
  user: { id: string; name: string; login: string };
};

export type TournamentSummary = {
  id: string;
  name: string;
  event_date: string;
  decklist_deadline: string;
  access_code: string;
};

export function JudgeTournamentWorkspace({ tournament, session, onBack, onLogout }: {
  tournament: TournamentSummary;
  session: JudgeSession;
  onBack: () => void;
  onLogout: () => void;
}) {
  const t = useT();
  const [players, setPlayers] = useState<Player[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState("players");
  const [importOpen, setImportOpen] = useState(false);
  const [importPlayerId, setImportPlayerId] = useState<string | null>(null);
  const [addPlayerOpen, setAddPlayerOpen] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [newPlayerPlayId, setNewPlayerPlayId] = useState("");
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [loading, setLoading] = useState(true);
  const [penaltiesLoading, setPenaltiesLoading] = useState(true);

  const loadPlayers = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try {
      const data = await api<{ players: Player[] }>(`/api/tournaments/${tournament.id}/players`);
      setPlayers(data.players);
      setSelectedId((current) => current && data.players.some((player) => player.id === current)
        ? current
        : data.players.find((player) => player.status !== "awaiting_deck" && !player.status.startsWith("done"))?.id
          ?? data.players.find((player) => player.status !== "awaiting_deck")?.id
          ?? null);
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) onLogout();
      else if (!quiet) toast.error(error instanceof Error ? error.message : t("judge.workspace.serverUnavailable"));
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [onLogout, t, tournament.id]);

  const loadPenalties = useCallback(async (quiet = false) => {
    if (!quiet) setPenaltiesLoading(true);
    try {
      const data = await api<{ penalties: Penalty[] }>(`/api/tournaments/${tournament.id}/penalties`);
      setPenalties(data.penalties);
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) onLogout();
      else if (!quiet) toast.error(error instanceof Error ? error.message : t("judge.workspace.loadPenaltiesFailed"));
    } finally {
      if (!quiet) setPenaltiesLoading(false);
    }
  }, [onLogout, t, tournament.id]);

  useEffect(() => {
    void Promise.resolve().then(() => Promise.all([loadPlayers(), loadPenalties()]));
  }, [loadPenalties, loadPlayers]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadPlayers(true);
      loadPenalties(true);
    }, 8_000);
    return () => window.clearInterval(timer);
  }, [loadPenalties, loadPlayers]);

  const selected = players.find((player) => player.id === selectedId) ?? null;
  const completed = players.filter((player) => player.status.startsWith("done")).length;
  const issues = players.filter((player) => player.status === "done_issue").length;
  const pending = players.length - completed;

  async function patchPlayer(id: string, patch: Partial<Player>) {
    setPlayers((current) => current.map((player) => player.id === id ? { ...player, ...patch, updated_at: new Date().toISOString() } : player));
    try {
      const data = await api<{ player: Player }>(`/api/tournaments/${tournament.id}/players/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: patch.status,
          checkState: patch.checkState,
          notes: patch.notes,
          resultNote: patch.result_note,
        }),
      });
      setPlayers((current) => current.map((player) => player.id === id ? data.player : player));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("judge.workspace.saveProgressFailed"));
      await loadPlayers(true);
    }
  }

  async function deletePlayer(id: string) {
    try {
      await api(`/api/tournaments/${tournament.id}/players/${id}`, { method: "DELETE" });
      setPlayers((current) => current.filter((player) => player.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast.success(t("judge.workspace.playerRemoved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("judge.workspace.deleteFailed"));
    }
  }

  async function addPlayer(event: React.FormEvent) {
    event.preventDefault();
    setAddingPlayer(true);
    try {
      const data = await api<{ player: Player }>(`/api/tournaments/${tournament.id}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newPlayerName, playId: newPlayerPlayId }),
      });
      setPlayers((current) => [...current, data.player].sort((left, right) => left.name.localeCompare(right.name, localeOf())));
      setNewPlayerName("");
      setNewPlayerPlayId("");
      setAddPlayerOpen(false);
      toast.success(t("judge.workspace.playerAddedNoList"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("judge.workspace.addPlayerFailed"));
    } finally {
      setAddingPlayer(false);
    }
  }

  async function createPenalty(input: {
    playerId: string;
    roundLabel: string;
    tableLabel: string;
    category: PenaltyCategory;
    penaltyType: PenaltyType;
    reason: string;
    notes: string;
  }) {
    const linkedPlayer = players.find((player) => player.id === input.playerId);
    if (!linkedPlayer) throw new Error(t("judge.workspace.playerNotFound"));
    const optimisticId = `pending-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const now = new Date().toISOString();
    const optimisticPenalty: Penalty = {
      id: optimisticId,
      player_id: input.playerId,
      player_name: linkedPlayer.name,
      round_label: input.roundLabel,
      table_label: input.tableLabel,
      category: input.category,
      penalty_type: input.penaltyType,
      reason: input.reason,
      notes: input.notes,
      judge_name: session.user.name,
      created_at: now,
      updated_at: now,
    };
    setPenalties((current) => [optimisticPenalty, ...current]);

    try {
      const data = await api<{ penalty: Penalty }>(`/api/tournaments/${tournament.id}/penalties`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      setPenalties((current) => current.map((penalty) => penalty.id === optimisticId ? data.penalty : penalty));
      toast.success(t("judge.workspace.occurrenceRecorded"));
    } catch (error) {
      setPenalties((current) => current.filter((penalty) => penalty.id !== optimisticId));
      toast.error(error instanceof Error ? error.message : t("judge.workspace.createPenaltyFailed"));
      throw error;
    }
  }

  async function deletePenalty(id: string) {
    try {
      await api(`/api/tournaments/${tournament.id}/penalties/${id}`, { method: "DELETE" });
      setPenalties((current) => current.filter((penalty) => penalty.id !== id));
      toast.success(t("judge.workspace.penaltyRemoved"));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("judge.workspace.deletePenaltyFailed"));
    }
  }

  async function logout() {
    await api("/api/logout", { method: "POST" }).catch(() => undefined);
    setPlayers([]);
    setPenalties([]);
    onLogout();
  }

  return (
    <main className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#152238] text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white/70 hover:bg-white/10 hover:text-white" aria-label={t("judge.workspace.backToTournaments")}>
            <ArrowLeft />
          </Button>
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-[#e0b348]">
            <ClipboardCheck className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black tracking-tight sm:text-lg">{storedLabel(t, tournament.name)}</h1>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300"><Wifi className="size-3" /> {storedLabel(t, session.user.name)} · {t("judge.workspace.serverConnected")}</p>
          </div>
          <LanguageSwitcher />
          <Button variant="ghost" size="icon" onClick={() => window.location.assign("/api/backup")} className="text-white/70 hover:bg-white/10 hover:text-white" aria-label={t("judge.workspace.downloadBackup")}>
            <Archive />
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} className="text-white/70 hover:bg-white/10 hover:text-white" aria-label={t("judge.workspace.logout")}>
            <LogOut />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <Tabs value={view} onValueChange={setView}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid h-12! w-full grid-cols-4 rounded-xl bg-[#dfe3dc] p-1 sm:w-auto sm:min-w-[600px]">
              <TabsTrigger value="players" className="h-full min-h-0 px-2 py-0 font-black"><Users /><span className="hidden min-[430px]:inline">{t("judge.workspace.tabPlayers")}</span></TabsTrigger>
              <TabsTrigger value="check" className="h-full min-h-0 px-2 py-0 font-black"><ClipboardCheck /><span className="hidden min-[430px]:inline">{t("judge.workspace.tabCheck")}</span></TabsTrigger>
              <TabsTrigger value="penalties" className="h-full min-h-0 px-2 py-0 font-black"><ShieldAlert /><span className="hidden min-[430px]:inline">{t("judge.workspace.tabPenalties")}</span></TabsTrigger>
              <TabsTrigger value="rules" className="h-full min-h-0 px-2 py-0 font-black"><Gavel /><span className="hidden min-[430px]:inline">{t("judge.workspace.tabRules")}</span></TabsTrigger>
            </TabsList>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              <Button variant="outline" className="h-12 font-black shadow-sm" onClick={() => setAddPlayerOpen(true)}>
                <Plus /> {t("judge.workspace.addPlayer")}
              </Button>
              <Button className="h-12 font-black shadow-sm" onClick={() => { setImportPlayerId(null); setImportOpen(true); }}>
                <FileUp /> {t("judge.workspace.importLists")}
              </Button>
            </div>
          </div>

          <TabsContent value="players" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label={t("judge.workspace.statPlayers")} value={players.length} detail={t("judge.workspace.statPlayersDetail")} tone="navy" />
              <StatCard label={t("judge.workspace.statPending")} value={pending} detail={t("judge.workspace.statPendingDetail")} tone="amber" />
              <StatCard label={t("judge.workspace.statDone")} value={completed} detail={t("judge.workspace.statDoneDetail")} tone="green" />
              <StatCard label={t("judge.workspace.statIssues")} value={issues} detail={t("judge.workspace.statIssuesDetail")} tone={issues ? "red" : "green"} />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => openPdf(`/api/tournaments/${tournament.id}/reports/occurrences.pdf`)}>
                <Download /> {t("judge.workspace.exportPdf")}
              </Button>
            </div>
            <PlayerList
              players={players}
              selectedId={selectedId}
              onSelect={(id) => {
                const player = players.find((entry) => entry.id === id);
                if (player?.status === "awaiting_deck") {
                  setImportPlayerId(id);
                  setImportOpen(true);
                } else {
                  setSelectedId(id);
                  setView("check");
                }
              }}
              onDelete={deletePlayer}
            />
          </TabsContent>

          <TabsContent value="check">
            {loading ? (
              <div className="grid min-h-80 place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div>
            ) : selected ? (
              <div className="grid min-w-0 items-start gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
                <aside className="hidden xl:block">
                  <PlayerList
                    players={players.filter((player) => !player.status.startsWith("done") || player.id === selected.id)}
                    selectedId={selected.id}
                    onSelect={setSelectedId}
                    onDelete={deletePlayer}
                    compact
                  />
                </aside>
                <CheckWorkspace player={selected} onPatch={patchPlayer} />
              </div>
            ) : (
              <div className="rounded-3xl border bg-card px-6 py-20 text-center shadow-sm">
                <ClipboardCheck className="mx-auto size-12 text-muted-foreground/40" />
                <h2 className="mt-4 text-xl font-black">{t("judge.workspace.emptyTitle")}</h2>
                <p className="mt-2 text-sm text-muted-foreground">{t("judge.workspace.emptyHint")}</p>
                <Button className="mt-5" onClick={() => setImportOpen(true)}><FileUp /> {t("judge.workspace.importLists")}</Button>
              </div>
            )}
          </TabsContent>

          <TabsContent value="penalties">
            <PenaltiesPanel
              players={players}
              penalties={penalties}
              loading={penaltiesLoading}
              onCreate={createPenalty}
              onDelete={deletePenalty}
              reportPath={`/api/tournaments/${tournament.id}/reports/penalties.pdf`}
              judgeName={session.user.name}
            />
          </TabsContent>

          <TabsContent value="rules">
            <RulesPanel playerCount={players.length} completedCount={completed} />
          </TabsContent>
        </Tabs>
      </div>

      <ImportDialog
        open={importOpen}
        onOpenChange={(next) => { setImportOpen(next); if (!next) setImportPlayerId(null); }}
        tournamentId={tournament.id}
        players={players}
        initialPlayerId={importPlayerId}
        onSaved={(created) => {
          setPlayers((current) => [...current.filter((player) => !created.some((saved) => saved.id === player.id)), ...created]
            .sort((left, right) => left.name.localeCompare(right.name, localeOf())));
          setSelectedId(created[0]?.id ?? selectedId);
        }}
      />
      <Dialog open={addPlayerOpen} onOpenChange={setAddPlayerOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={addPlayer}>
            <DialogHeader>
              <DialogTitle>{t("judge.workspace.addDialogTitle")}</DialogTitle>
              <DialogDescription>{t("judge.workspace.addDialogDescription")}</DialogDescription>
            </DialogHeader>
            <div className="mt-5 space-y-4">
              <label className="block space-y-2 text-sm font-bold"><span>{t("judge.workspace.fullName")}</span><Input value={newPlayerName} onChange={(event) => setNewPlayerName(event.target.value)} required /></label>
              <label className="block space-y-2 text-sm font-bold"><span>{t("judge.workspace.playIdOptional")}</span><Input inputMode="numeric" value={newPlayerPlayId} onChange={(event) => setNewPlayerPlayId(event.target.value)} /></label>
            </div>
            <DialogFooter className="mt-5">
              <Button type="button" variant="outline" onClick={() => setAddPlayerOpen(false)}>{t("judge.workspace.cancel")}</Button>
              <Button disabled={addingPlayer}>{addingPlayer ? <Loader2 className="animate-spin" /> : <Plus />} {t("judge.workspace.add")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Toaster position="top-center" richColors closeButton />
    </main>
  );
}
