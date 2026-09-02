"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  Check,
  ChevronRight,
  ClipboardCheck,
  Copy,
  FileText,
  Gavel,
  ImageOff,
  KeyRound,
  Loader2,
  LockKeyhole,
  LogIn,
  LogOut,
  Minus,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  Upload,
  UserPlus,
  Users,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Toaster } from "@/components/ui/sonner";
import { JudgeTournamentWorkspace } from "@/components/deck-check-app";
import { CardArtwork } from "@/components/card-artwork";
import { DeckImageView } from "@/components/deck-image-view";
import { api, formatDate, localDateTimeValue } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type Session =
  | { role: "judge"; user: { id: string; name: string; login: string } }
  | { role: "player"; user: { id: string; name: string; play_id: string } };

type Tournament = {
  id: string;
  name: string;
  event_date: string;
  decklist_deadline: string;
  access_code: string;
  player_count?: number;
  submitted_count?: number;
  checked_count?: number;
  registration_id?: string;
  status?: string;
  deck_submitted_at?: string | null;
  submission_locked?: boolean;
};

type DeckWarning = {
  code: string;
  severity: "critical" | "review";
  message: string;
};

type CardEntry = {
  id?: string;
  cardId?: string;
  category: "pokemon" | "trainer" | "energy";
  name: string;
  setCode: string;
  setName?: string;
  collectorNumber: string;
  quantity: number;
  imageSmall?: string;
  imageLarge?: string;
  imageFallbacks?: string[];
  subtypes?: string[];
  needsReview?: boolean;
  originalLines?: string[];
};

type Registration = {
  id: string;
  name: string;
  play_id: string;
  status: string;
  submission_locked: boolean;
  deck_submitted_at: string | null;
  deck: {
    items: CardEntry[];
    total: number;
    warnings: DeckWarning[];
    basicPokemonCheck?: { status: string; name?: string };
  };
};

type CatalogCard = Omit<CardEntry, "quantity"> & {
  cardId: string;
  setName: string;
};

type Judge = { id: string; name: string; login: string; created_at: string };

const categoryLabels = {
  pokemon: "Pokémon",
  trainer: "Treinadores",
  energy: "Energias",
} as const;

const fieldClassName = "h-11 w-full rounded-xl border border-input bg-white px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

function deadlineLabel(value: string) {
  if (!value) return "Prazo não informado";
  return `${Date.parse(value) < Date.now() ? "Encerrado em" : "Até"} ${formatDate(value)}`;
}

function AppHeader({ title, subtitle, onBack, onLogout, role }: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  onLogout: () => void;
  role: "judge" | "player";
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#152238] text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white/70 hover:bg-white/10 hover:text-white" aria-label="Voltar">
            <ArrowLeft />
          </Button>
        )}
        <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-[#e0b348]">
          {role === "judge" ? <Gavel className="size-5" /> : <ClipboardCheck className="size-5" />}
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-base font-black tracking-tight sm:text-lg">{title}</h1>
          <p className="truncate text-[11px] font-bold text-emerald-300">{subtitle}</p>
        </div>
        <Button variant="ghost" size="icon" onClick={onLogout} className="text-white/70 hover:bg-white/10 hover:text-white" aria-label="Sair">
          <LogOut />
        </Button>
      </div>
    </header>
  );
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [role, setRole] = useState<"player" | "judge">("player");
  const [playerMode, setPlayerMode] = useState<"login" | "register">("login");
  const [playId, setPlayId] = useState("");
  const [name, setName] = useState("");
  const [judgeLogin, setJudgeLogin] = useState("admin");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const path = role === "judge"
        ? "/api/auth/judge/login"
        : playerMode === "register"
          ? "/api/auth/player/register"
          : "/api/auth/player/login";
      const body = role === "judge"
        ? { login: judgeLogin, password }
        : { playId, password, ...(playerMode === "register" ? { name } : {}) };
      const data = await api<{ session: Session }>(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onAuthenticated(data.session);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível entrar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <section className="w-full max-w-lg overflow-hidden rounded-[2rem] border bg-card shadow-[0_24px_80px_rgba(21,34,56,0.18)]">
        <div className="bg-[#152238] px-6 py-7 text-white sm:px-8">
          <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <ClipboardCheck className="size-7 text-[#e0b348]" />
          </div>
          <p className="text-xs font-bold tracking-[0.22em] text-white/55 uppercase">Gestão de torneios</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">TCG Deck Check</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">Inscrições, envio de decklists e operação da equipe de arbitragem em um só lugar.</p>
        </div>

        <div className="p-5 sm:p-7">
          <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
            <button type="button" onClick={() => { setRole("player"); setPassword(""); }} className={cn("flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-black", role === "player" ? "bg-white shadow-sm" : "text-muted-foreground")}>
              <Users className="size-4" /> Jogador
            </button>
            <button type="button" onClick={() => { setRole("judge"); setPassword(""); }} className={cn("flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-black", role === "judge" ? "bg-white shadow-sm" : "text-muted-foreground")}>
              <Gavel className="size-4" /> Juiz
            </button>
          </div>

          {role === "player" && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant={playerMode === "login" ? "default" : "outline"} onClick={() => setPlayerMode("login")}>Já tenho conta</Button>
              <Button type="button" variant={playerMode === "register" ? "default" : "outline"} onClick={() => setPlayerMode("register")}>Criar conta</Button>
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4">
            {role === "player" ? (
              <>
                {playerMode === "register" && (
                  <label className="block space-y-2 text-sm font-bold">
                    <span>Nome completo</span>
                    <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
                  </label>
                )}
                <label className="block space-y-2 text-sm font-bold">
                  <span>Play! Pokémon ID</span>
                  <Input inputMode="numeric" value={playId} onChange={(event) => setPlayId(event.target.value)} placeholder="Somente números" autoComplete="username" required />
                </label>
              </>
            ) : (
              <label className="block space-y-2 text-sm font-bold">
                <span>Login do juiz</span>
                <Input value={judgeLogin} onChange={(event) => setJudgeLogin(event.target.value)} autoComplete="username" required />
              </label>
            )}
            <label className="block space-y-2 text-sm font-bold">
              <span>Senha</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute top-3 left-3.5 size-5 text-muted-foreground" />
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 pl-11" autoComplete={playerMode === "register" && role === "player" ? "new-password" : "current-password"} required />
              </div>
            </label>
            {role === "judge" && <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">Primeiro acesso: login <strong>admin</strong> e a senha definida no arquivo <strong>.env</strong>.</p>}
            <Button className="h-12 w-full text-base font-black" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : playerMode === "register" && role === "player" ? <UserPlus /> : <LogIn />}
              {role === "player" && playerMode === "register" ? "Criar conta" : "Entrar"}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}

function JudgeDashboard({ session, onOpen, onLogout }: {
  session: Extract<Session, { role: "judge" }>;
  onOpen: (tournament: Tournament) => void;
  onLogout: () => void;
}) {
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
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar os torneios.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast.success(`Torneio criado. Código: ${data.tournament.access_code}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar torneio.");
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
      setJudges((current) => [...current, data.judge].sort((left, right) => left.name.localeCompare(right.name, "pt-BR")));
      setNewJudgeName("");
      setNewJudgeLogin("");
      setNewJudgePassword("");
      toast.success("Conta de juiz criada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao criar juiz.");
    } finally {
      setBusy(false);
    }
  }

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado.");
    } catch {
      toast.info(`Código do torneio: ${code}`);
    }
  }

  return (
    <main className="min-h-screen">
      <AppHeader title="Torneios" subtitle={`Juiz: ${session.user.name}`} role="judge" onLogout={onLogout} />
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-black tracking-[0.16em] text-primary uppercase">Painel do juiz</p>
            <h2 className="mt-1 text-2xl font-black sm:text-3xl">Escolha ou crie um torneio</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="h-11" onClick={() => setJudgesOpen(true)}><ShieldCheck /> Juízes</Button>
            <Button className="h-11 font-black" onClick={() => setCreateOpen(true)}><Plus /> Novo torneio</Button>
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
                          {Date.parse(tournament.decklist_deadline) < now ? "Prazo encerrado" : "Recebendo listas"}
                        </Badge>
                        <h3 className="mt-3 text-xl font-black leading-tight">{tournament.name}</h3>
                      </div>
                      <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground" />
                    </div>
                    <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="size-4" /> {deadlineLabel(tournament.decklist_deadline)}</p>
                    <div className="mt-5 grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-muted/70 p-3"><strong className="block font-mono text-2xl">{players}</strong><span className="text-xs text-muted-foreground">inscritos</span></div>
                      <div className="rounded-xl bg-muted/70 p-3"><strong className="block font-mono text-2xl">{submitted}</strong><span className="text-xs text-muted-foreground">listas</span></div>
                      <div className="rounded-xl bg-muted/70 p-3"><strong className="block font-mono text-2xl">{Number(tournament.checked_count || 0)}</strong><span className="text-xs text-muted-foreground">checks</span></div>
                    </div>
                    {players > 0 && <Progress value={Math.round((submitted / players) * 100)} className="mt-4 h-2" />}
                  </button>
                  <div className="flex items-center justify-between border-t bg-muted/35 px-5 py-3">
                    <div><span className="block text-[10px] font-black tracking-wider text-muted-foreground uppercase">Código</span><strong className="font-mono text-lg tracking-[0.18em]">{tournament.access_code}</strong></div>
                    <Button variant="ghost" size="sm" onClick={() => copyCode(tournament.access_code)}><Copy /> Copiar</Button>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="rounded-3xl border bg-card px-6 py-20 text-center shadow-sm">
            <Trophy className="mx-auto size-12 text-muted-foreground/40" />
            <h3 className="mt-4 text-xl font-black">Nenhum torneio criado</h3>
            <p className="mt-2 text-sm text-muted-foreground">Crie o torneio para liberar inscrições e recebimento de decklists.</p>
            <Button className="mt-5" onClick={() => setCreateOpen(true)}><Plus /> Criar torneio</Button>
          </div>
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-xl">
          <form onSubmit={createTournament}>
            <DialogHeader>
              <DialogTitle>Novo torneio</DialogTitle>
              <DialogDescription>O código será gerado automaticamente. Informe aos jogadores também a senha escolhida.</DialogDescription>
            </DialogHeader>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm font-bold sm:col-span-2"><span>Nome do torneio *</span><Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Ex.: League Cup Campo Grande" required /></label>
              <label className="space-y-2 text-sm font-bold"><span>Data do evento</span><Input type="date" value={eventDate} onChange={(event) => setEventDate(event.target.value)} /></label>
              <label className="space-y-2 text-sm font-bold"><span>Prazo da decklist *</span><Input type="datetime-local" value={deadline} onChange={(event) => setDeadline(event.target.value)} required /></label>
              <label className="space-y-2 text-sm font-bold sm:col-span-2"><span>Senha do torneio *</span><Input type="password" value={tournamentPassword} onChange={(event) => setTournamentPassword(event.target.value)} minLength={4} autoComplete="new-password" required /></label>
            </div>
            <DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button disabled={busy}>{busy && <Loader2 className="animate-spin" />} Criar torneio</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={judgesOpen} onOpenChange={setJudgesOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Contas da equipe de arbitragem</DialogTitle><DialogDescription>Cada juiz entra com a própria conta; as ocorrências ficam automaticamente atribuídas.</DialogDescription></DialogHeader>
          <div className="mt-4 grid gap-2">
            {judges.map((judge) => <div key={judge.id} className="flex items-center justify-between rounded-xl border px-4 py-3"><div><strong>{judge.name}</strong><p className="text-xs text-muted-foreground">Login: {judge.login}</p></div>{judge.id === session.user.id && <Badge>Você</Badge>}</div>)}
          </div>
          <form onSubmit={createJudge} className="mt-5 rounded-2xl border bg-muted/40 p-4">
            <h3 className="font-black">Adicionar juiz</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Input value={newJudgeName} onChange={(event) => setNewJudgeName(event.target.value)} placeholder="Nome do juiz" required />
              <Input value={newJudgeLogin} onChange={(event) => setNewJudgeLogin(event.target.value)} placeholder="Login sem espaços" required />
              <Input type="password" value={newJudgePassword} onChange={(event) => setNewJudgePassword(event.target.value)} placeholder="Senha (mínimo 8)" minLength={8} className="sm:col-span-2" required />
            </div>
            <Button className="mt-3 w-full" disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <UserPlus />} Criar conta de juiz</Button>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PlayerDashboard({ session, onLogout }: {
  session: Extract<Session, { role: "player" }>;
  onLogout: () => void;
}) {
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
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar suas inscrições.");
    } finally {
      setLoading(false);
    }
  }, []);

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
      toast.success("Inscrição realizada.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível fazer a inscrição.");
    } finally {
      setBusy(false);
    }
  }

  if (selected) {
    return <PlayerTournamentView session={session} tournament={selected} onBack={() => { setSelected(null); void load(); }} onLogout={onLogout} />;
  }

  return (
    <main className="min-h-screen">
      <AppHeader title="Meus torneios" subtitle={`${session.user.name} · Play! ID ${session.user.play_id}`} role="player" onLogout={onLogout} />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div><p className="text-xs font-black tracking-[0.16em] text-primary uppercase">Área do jogador</p><h2 className="mt-1 text-2xl font-black">Inscrições e decklists</h2></div>
          <Button className="h-11 font-black" onClick={() => setJoinOpen(true)}><Plus /> Inscrever</Button>
        </div>
        {loading ? <div className="grid min-h-64 place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div> : tournaments.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {tournaments.map((tournament) => (
              <button key={tournament.id} type="button" onClick={() => setSelected(tournament)} className="rounded-3xl border bg-card p-5 text-left shadow-sm transition hover:border-primary/40 hover:bg-accent/25">
                <div className="flex items-start justify-between gap-3"><Badge className={tournament.submission_locked ? "bg-emerald-700" : "bg-amber-600"}>{tournament.submission_locked ? "Lista enviada" : "Lista pendente"}</Badge><ChevronRight className="size-5 text-muted-foreground" /></div>
                <h3 className="mt-4 text-xl font-black">{tournament.name}</h3>
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground"><CalendarClock className="size-4" /> {deadlineLabel(tournament.decklist_deadline)}</p>
                {tournament.deck_submitted_at && <p className="mt-3 text-xs font-bold text-emerald-700">Enviada em {formatDate(tournament.deck_submitted_at)}</p>}
              </button>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border bg-card px-6 py-20 text-center shadow-sm"><Trophy className="mx-auto size-12 text-muted-foreground/40" /><h3 className="mt-4 text-xl font-black">Você ainda não está inscrito</h3><p className="mt-2 text-sm text-muted-foreground">Peça ao juiz o código e a senha do torneio.</p><Button className="mt-5" onClick={() => setJoinOpen(true)}><KeyRound /> Usar código</Button></div>
        )}
      </div>
      <Dialog open={joinOpen} onOpenChange={setJoinOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={join}>
            <DialogHeader><DialogTitle>Inscrever-se em um torneio</DialogTitle><DialogDescription>Digite o código de seis caracteres e a senha informados pelo juiz.</DialogDescription></DialogHeader>
            <div className="mt-5 space-y-4">
              <label className="block space-y-2 text-sm font-bold"><span>Código</span><Input value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} className="h-12 text-center font-mono text-xl tracking-[0.2em] uppercase" maxLength={8} required /></label>
              <label className="block space-y-2 text-sm font-bold"><span>Senha do torneio</span><Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>
            </div>
            <DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => setJoinOpen(false)}>Cancelar</Button><Button disabled={busy}>{busy ? <Loader2 className="animate-spin" /> : <Check />} Confirmar inscrição</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function PlayerTournamentView({ session, tournament, onBack, onLogout }: {
  session: Extract<Session, { role: "player" }>;
  tournament: Tournament;
  onBack: () => void;
  onLogout: () => void;
}) {
  const [registration, setRegistration] = useState<Registration | null>(null);
  const [resolvedTournament, setResolvedTournament] = useState(tournament);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ tournament: Tournament; registration: Registration }>(`/api/tournaments/${tournament.id}/me`);
      setResolvedTournament(data.tournament);
      setRegistration(data.registration);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Não foi possível carregar a inscrição.");
    } finally {
      setLoading(false);
    }
  }, [tournament.id]);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  return (
    <main className="min-h-screen">
      <AppHeader title={resolvedTournament.name} subtitle={`${session.user.name} · ${deadlineLabel(resolvedTournament.decklist_deadline)}`} role="player" onBack={onBack} onLogout={onLogout} />
      <div className="mx-auto max-w-6xl px-3 py-5 sm:px-6">
        {loading ? <div className="grid min-h-72 place-items-center"><Loader2 className="size-8 animate-spin text-primary" /></div> : registration?.submission_locked ? (
          <LockedDeck registration={registration} tournament={resolvedTournament} />
        ) : registration ? (
          <DeckBuilder tournament={resolvedTournament} onSubmitted={setRegistration} />
        ) : (
          <div className="rounded-3xl border bg-card px-6 py-16 text-center"><ImageOff className="mx-auto size-10 text-muted-foreground" /><p className="mt-3 font-bold">Inscrição não encontrada.</p></div>
        )}
      </div>
    </main>
  );
}

function LockedDeck({ registration, tournament }: { registration: Registration; tournament: Tournament }) {
  return (
    <section className="space-y-5">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="bg-[#152238] p-5 text-white sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div><p className="flex items-center gap-2 text-xs font-black tracking-[0.16em] text-[#e0b348] uppercase"><LockKeyhole className="size-4" /> Envio concluído</p><h2 className="mt-2 text-2xl font-black">Sua decklist está bloqueada</h2><p className="mt-2 text-sm text-white/65">Enviada em {registration.deck_submitted_at ? formatDate(registration.deck_submitted_at) : "data não informada"}. Ela não pode ser editada.</p><DeckImageView items={registration.deck.items} playerName={registration.name} className="mt-4 border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white" /></div>
          <div className="mt-4 rounded-2xl border border-white/15 bg-white/10 px-5 py-3 text-center sm:mt-0"><strong className="font-mono text-4xl text-[#e0b348]">{registration.deck.total}</strong><span className="ml-1 text-white/60">/60</span></div>
        </div>
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">
          {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((category) => <div key={category} className="rounded-xl bg-muted/60 p-3"><strong>{categoryLabels[category]}</strong><span className="float-right font-mono font-black">{registration.deck.items.filter((item) => item.category === category).reduce((sum, item) => sum + item.quantity, 0)}</span></div>)}
        </div>
      </div>
      {(Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((category) => {
        const cards = registration.deck.items.filter((item) => item.category === category);
        if (!cards.length) return null;
        return <div key={category}><h3 className="mb-3 text-lg font-black">{categoryLabels[category]}</h3><div className="grid gap-3 md:grid-cols-2">{cards.map((item) => <article key={item.id || `${item.name}-${item.setCode}-${item.collectorNumber}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm"><CardArtwork item={item} /><div className="min-w-0 flex-1"><p className="font-black"><span className="font-mono text-primary">{item.quantity}×</span> {item.name}</p>{category === "pokemon" ? <p className="mt-1 font-mono text-xs text-muted-foreground">{item.setCode} · {item.collectorNumber}</p> : <p className="mt-1 text-xs text-muted-foreground">Nome e quantidade</p>}</div></article>)}</div></div>;
      })}
      <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950"><ShieldCheck className="mr-2 inline size-5" />O servidor preserva exatamente esta versão para o torneio <strong>{tournament.name}</strong>.</p>
    </section>
  );
}

function DeckBuilder({ tournament, onSubmitted }: {
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

  const grouped = useMemo(() => (Object.keys(categoryLabels) as Array<keyof typeof categoryLabels>).map((value) => ({
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
        <div className="grid gap-3 p-4 sm:grid-cols-3 sm:p-5">{grouped.map((group) => <div key={group.category} className="rounded-xl bg-muted/60 p-3"><strong>{categoryLabels[group.category]}</strong><span className="float-right font-mono font-black">{group.quantity}</span></div>)}</div>
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
          <div className="mb-3 flex items-center justify-between"><h3 className="text-lg font-black">{categoryLabels[group.category]}</h3><Badge variant="outline" className="font-mono">{group.quantity}</Badge></div>
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

export function TournamentApp() {
  const [session, setSession] = useState<Session | null>(null);
  const [checking, setChecking] = useState(true);
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null);

  useEffect(() => {
    api<{ session: Session }>("/api/session")
      .then((data) => setSession(data.session))
      .catch(() => setSession(null))
      .finally(() => setChecking(false));
  }, []);

  async function logout() {
    await api("/api/logout", { method: "POST" }).catch(() => undefined);
    setSelectedTournament(null);
    setSession(null);
  }

  if (checking) return <main className="grid min-h-screen place-items-center"><Loader2 className="size-9 animate-spin text-primary" /></main>;

  return (
    <>
      {!session ? <AuthScreen onAuthenticated={setSession} /> : session.role === "judge" ? (
        selectedTournament
          ? <JudgeTournamentWorkspace tournament={selectedTournament} session={session} onBack={() => setSelectedTournament(null)} onLogout={() => setSession(null)} />
          : <JudgeDashboard session={session} onOpen={setSelectedTournament} onLogout={logout} />
      ) : <PlayerDashboard session={session} onLogout={logout} />}
      <Toaster position="top-center" richColors closeButton />
    </>
  );
}
