"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Archive,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileText,
  FileUp,
  Gavel,
  ListChecks,
  Loader2,
  LogOut,
  Minus,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  Trash2,
  TriangleAlert,
  Upload,
  Users,
  Wifi,
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
import { Checkbox } from "@/components/ui/checkbox";
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
import { Toaster } from "@/components/ui/sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, formatDate, openPdf } from "@/lib/client-api";
import { cn } from "@/lib/utils";

type Category = "pokemon" | "trainer" | "energy";
type PlayerStatus = "awaiting_deck" | "pending" | "in_progress" | "done_clean" | "done_issue";
type PenaltyCategory = "deck" | "gameplay" | "procedure" | "conduct" | "other";
type PenaltyType = "caution" | "warning" | "double_prize" | "quadruple_prize" | "game_loss" | "match_loss" | "disqualification" | "other";

type DeckItem = {
  id: string;
  category: Category;
  name: string;
  setCode: string;
  collectorNumber: string;
  quantity: number;
  needsReview: boolean;
  originalLines: string[];
  cardId?: string;
  imageSmall?: string;
  imageLarge?: string;
  subtypes?: string[];
};

type DeckWarning = {
  code: string;
  severity: "critical" | "review";
  message: string;
};

type Deck = {
  playerName: string;
  items: DeckItem[];
  total: number;
  warnings: DeckWarning[];
  sourceName: string;
  rawText: string;
  extractionMethod?: string;
};

type Player = {
  id: string;
  play_id: string;
  name: string;
  status: PlayerStatus;
  deck: Deck;
  checkState: Record<string, number>;
  notes: string;
  result_note: string;
  source_name: string;
  imported_at: string;
  updated_at: string;
  checked_at: string | null;
};

type ImportResult = Deck & {
  include: boolean;
  reviewed: boolean;
};

type Penalty = {
  id: string;
  player_id: string | null;
  player_name: string;
  round_label: string;
  table_label: string;
  category: PenaltyCategory;
  penalty_type: PenaltyType;
  reason: string;
  notes: string;
  judge_name: string;
  created_at: string;
  updated_at: string;
};

const CATEGORY_LABEL: Record<Category, string> = {
  pokemon: "Pokémon",
  trainer: "Treinadores",
  energy: "Energias",
};

const STATUS_META: Record<PlayerStatus, { label: string; className: string }> = {
  awaiting_deck: { label: "Sem lista", className: "border-violet-300 bg-violet-50 text-violet-800" },
  pending: { label: "Pendente", className: "border-slate-300 bg-slate-100 text-slate-700" },
  in_progress: { label: "Em conferência", className: "border-amber-300 bg-amber-50 text-amber-800" },
  done_clean: { label: "Concluído", className: "border-emerald-300 bg-emerald-50 text-emerald-800" },
  done_issue: { label: "Com ocorrência", className: "border-red-300 bg-red-50 text-red-800" },
};

const PENALTY_CATEGORY_LABEL: Record<PenaltyCategory, string> = {
  deck: "Deck / lista",
  gameplay: "Jogo",
  procedure: "Procedimento",
  conduct: "Conduta",
  other: "Outro",
};

const PENALTY_TYPE_LABEL: Record<PenaltyType, string> = {
  caution: "Caution",
  warning: "Warning",
  double_prize: "Double Prize Card",
  quadruple_prize: "Quadruple Prize Card",
  game_loss: "Game Loss",
  match_loss: "Match Loss",
  disqualification: "Disqualification",
  other: "Outra",
};

const fieldClassName = "h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

const OFFICIAL_RULES_URL =
  "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tournament-rules-handbook-en.pdf";
const OFFICIAL_TCG_URL =
  "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-tcg-tournament-handbook-en.pdf";
const OFFICIAL_PENALTIES_URL =
  "https://www.pokemon.com/static-assets/content-assets/cms2/pdf/play-pokemon/rules/play-pokemon-penalty-guidelines-en.pdf";

function StatCard({ label, value, detail, tone = "navy" }: {
  label: string;
  value: number;
  detail: string;
  tone?: "navy" | "green" | "amber" | "red";
}) {
  const tones = {
    navy: "border-[#152238]/20 bg-[#152238] text-white",
    green: "border-emerald-200 bg-emerald-50 text-emerald-950",
    amber: "border-amber-200 bg-amber-50 text-amber-950",
    red: "border-red-200 bg-red-50 text-red-950",
  };
  return (
    <div className={cn("rounded-2xl border p-4", tones[tone])}>
      <p className="text-[11px] font-black tracking-[0.14em] uppercase opacity-60">{label}</p>
      <div className="mt-2 flex items-end justify-between gap-3">
        <strong className="font-mono text-4xl leading-none">{value}</strong>
        <span className="text-right text-xs leading-4 opacity-70">{detail}</span>
      </div>
    </div>
  );
}

function PlayerBadge({ status }: { status: PlayerStatus }) {
  const meta = STATUS_META[status];
  return <Badge variant="outline" className={cn("font-bold", meta.className)}>{meta.label}</Badge>;
}

function PlayerList({
  players,
  selectedId,
  onSelect,
  onDelete,
  compact = false,
}: {
  players: Player[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  compact?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "open" | "done">("all");
  const filtered = players.filter((player) => {
    const matchesQuery = player.name.toLocaleLowerCase("pt-BR").includes(query.toLocaleLowerCase("pt-BR"));
    const matchesStatus = filter === "all"
      || (filter === "open" && !player.status.startsWith("done"))
      || (filter === "done" && player.status.startsWith("done"));
    return matchesQuery && matchesStatus;
  });

  return (
    <section className="min-w-0 overflow-hidden rounded-3xl border bg-card shadow-sm">
      <div className={cn("space-y-3 border-b p-4", !compact && "sm:flex sm:items-center sm:justify-between sm:space-y-0")}>
        <div className={cn("relative min-w-0", !compact && "sm:max-w-xs sm:flex-1")}>
          <Search className="pointer-events-none absolute top-3 left-3 size-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar jogador"
            className="h-10 pl-9"
          />
        </div>
        <div className={cn(
          "rounded-xl bg-muted p-1",
          compact ? "grid w-full min-w-0 grid-cols-3" : "flex",
        )}>
          {(["all", "open", "done"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              className={cn(
                "min-h-9 flex-1 rounded-lg px-2 text-xs font-bold transition",
                !compact && "sm:flex-none sm:px-3",
                filter === value ? "bg-white text-foreground shadow-sm" : "text-muted-foreground",
              )}
            >
              {value === "all" ? "Todos" : value === "open" ? "Pendentes" : "Concluídos"}
            </button>
          ))}
        </div>
      </div>
      <div className="divide-y">
        {filtered.length ? filtered.map((player) => (
          <div
            key={player.id}
            className={cn(
              "group flex items-center gap-3 px-4 py-3 transition hover:bg-accent/40",
              selectedId === player.id && "bg-accent/65",
            )}
          >
            <button
              type="button"
              onClick={() => onSelect(player.id)}
              className="flex min-h-12 min-w-0 flex-1 items-center gap-3 text-left"
            >
              <div className={cn(
                "grid size-11 shrink-0 place-items-center rounded-xl border font-mono text-sm font-black",
                player.status.startsWith("done") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "bg-white",
              )}>
                {player.status.startsWith("done") ? <Check className="size-5" /> : player.deck.total}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="truncate text-[15px]">{player.name}</strong>
                  <PlayerBadge status={player.status} />
                </div>
                <p className="mt-1 truncate text-xs text-muted-foreground">
                  {player.deck.items.length} pilhas · {player.source_name || "lista importada"}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 text-muted-foreground hover:text-destructive" aria-label={`Excluir ${player.name}`}>
                  <Trash2 />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Excluir {player.name}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    A lista e todo o progresso de conferência serão removidos do servidor.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(player.id)} className="bg-destructive text-white hover:bg-destructive/90">
                    Excluir
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )) : (
          <div className="px-6 py-14 text-center">
            <Users className="mx-auto size-9 text-muted-foreground/50" />
            <p className="mt-3 font-bold">Nenhum jogador encontrado</p>
            <p className="mt-1 text-sm text-muted-foreground">Importe as listas ou altere o filtro.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function CardThumbnail({ item }: { item: DeckItem }) {
  const [image, setImage] = useState(item.imageSmall || "");
  const [large, setLarge] = useState(item.imageLarge || "");

  useEffect(() => {
    if (image || !item.name) return;
    const params = new URLSearchParams({ name: item.name });
    if (item.setCode) params.set("setCode", item.setCode);
    if (item.collectorNumber) params.set("number", item.collectorNumber);
    let active = true;
    api<{ card: { imageSmall?: string; imageLarge?: string } | null }>(`/api/cards/resolve?${params}`)
      .then(({ card }) => {
        if (!active || !card) return;
        setImage(card.imageSmall || "");
        setLarge(card.imageLarge || card.imageSmall || "");
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [image, item.collectorNumber, item.name, item.setCode]);

  if (!image) {
    return <div className="grid h-16 w-12 shrink-0 place-items-center rounded-lg border bg-muted text-[10px] font-bold text-muted-foreground">sem foto</div>;
  }
  return (
    <a href={large || image} target="_blank" rel="noreferrer" className="shrink-0" aria-label={`Abrir imagem de ${item.name}`}>
      <img src={image} alt={`Carta ${item.name}`} className="h-16 w-12 rounded-lg border object-cover shadow-sm" loading="lazy" />
    </a>
  );
}

function DeckItemRow({ item, observed, onChange }: {
  item: DeckItem;
  observed: number;
  onChange: (value: number) => void;
}) {
  const exact = observed === item.quantity;
  const tooMany = observed > item.quantity;
  return (
    <article className={cn(
      "grid grid-cols-[auto_minmax(0,1fr)] items-center gap-3 rounded-2xl border bg-card p-3 shadow-sm transition sm:grid-cols-[auto_minmax(0,1fr)_auto]",
      exact && "border-emerald-300 bg-emerald-50/70",
      tooMany && "border-red-300 bg-red-50",
    )}>
      <Checkbox
        checked={exact}
        onCheckedChange={(checked) => onChange(checked ? item.quantity : 0)}
        className="size-7 rounded-lg"
        aria-label={`Marcar ${item.name} como conferido`}
      />
      <div className="flex min-w-0 items-center gap-3">
        <CardThumbnail item={item} />
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className="font-mono text-lg font-black text-primary">{item.quantity}×</span>
            <h3 className="font-bold leading-tight">{item.name}</h3>
          </div>
          {item.category === "pokemon" ? (
            <div className="mt-1 flex items-center gap-2 text-xs">
              {item.setCode && item.collectorNumber ? (
                <span className="rounded-md bg-[#152238] px-2 py-1 font-mono font-bold text-white">
                  {item.setCode} · {item.collectorNumber}
                </span>
              ) : (
                <span className="flex items-center gap-1 font-bold text-amber-700">
                  <TriangleAlert className="size-3.5" /> coleção/número ausente
                </span>
              )}
            </div>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">Conferir somente nome e quantidade</p>
          )}
        </div>
      </div>
      <div className="col-span-2 grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-1 rounded-xl border bg-white p-1 sm:col-span-1 sm:flex">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10"
          onClick={() => onChange(Math.max(0, observed - 1))}
          aria-label={`Diminuir contagem de ${item.name}`}
        >
          <Minus />
        </Button>
        <span className={cn(
          "min-w-8 text-center font-mono text-xl font-black",
          exact ? "text-emerald-700" : tooMany ? "text-red-700" : "text-foreground",
        )}>{observed}</span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-10"
          onClick={() => onChange(observed + 1)}
          aria-label={`Aumentar contagem de ${item.name}`}
        >
          <Plus />
        </Button>
      </div>
    </article>
  );
}

function CheckWorkspace({ player, onPatch }: {
  player: Player;
  onPatch: (id: string, patch: Partial<Player>) => Promise<void>;
}) {
  const [category, setCategory] = useState<Category>("pokemon");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueNote, setIssueNote] = useState(player.result_note || "");
  const observedTotal = player.deck.items.reduce(
    (sum, item) => sum + Math.min(player.checkState[item.id] ?? 0, item.quantity),
    0,
  );
  const exactItems = player.deck.items.filter(
    (item) => (player.checkState[item.id] ?? 0) === item.quantity,
  ).length;
  const allExact = exactItems === player.deck.items.length && player.deck.items.length > 0;
  const listHasCriticalWarning = player.deck.warnings.some((warning) => warning.severity === "critical");
  const progress = player.deck.total ? Math.round((observedTotal / player.deck.total) * 100) : 0;

  async function setObserved(item: DeckItem, value: number) {
    const checkState = { ...player.checkState, [item.id]: value };
    await onPatch(player.id, {
      checkState,
      status: player.status === "pending" ? "in_progress" : player.status,
    });
  }

  async function finishClean() {
    await onPatch(player.id, { status: "done_clean", result_note: "" } as Partial<Player>);
    toast.success(`${player.name}: deck check concluído.`);
  }

  async function finishWithIssue() {
    if (!issueNote.trim()) {
      toast.error("Descreva a ocorrência antes de concluir.");
      return;
    }
    await onPatch(player.id, { status: "done_issue", result_note: issueNote } as Partial<Player>);
    setIssueOpen(false);
    toast.warning(`${player.name}: ocorrência registrada.`);
  }

  async function reopen() {
    await onPatch(player.id, { status: "in_progress", result_note: "" } as Partial<Player>);
  }

  return (
    <section className="min-w-0 space-y-4">
      <div className="overflow-hidden rounded-3xl border bg-card shadow-sm">
        <div className="grid gap-5 bg-[#152238] p-5 text-white md:grid-cols-[1fr_auto] md:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-bold tracking-[0.16em] text-white/55 uppercase">Conferência ativa</p>
              <PlayerBadge status={player.status} />
            </div>
            <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">{player.name}</h2>
            <p className="mt-2 text-sm text-white/65">
              {player.deck.items.length} pilhas agrupadas · lista com {player.deck.total} cartas
            </p>
          </div>
          <div className="flex items-baseline gap-2 rounded-2xl border border-white/15 bg-white/10 px-5 py-3">
            <strong className="font-mono text-4xl text-[#e0b348]">{observedTotal}</strong>
            <span className="font-mono text-lg text-white/55">/{player.deck.total}</span>
          </div>
        </div>
        <div className="space-y-3 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="font-bold">{exactItems} de {player.deck.items.length} pilhas conferidas</span>
            <span className="font-mono font-black text-primary">{progress}%</span>
          </div>
          <Progress value={progress} className="h-3" />
          {player.deck.warnings.length > 0 && (
            <div className="grid gap-2 pt-1">
              {player.deck.warnings.map((warning) => (
                <div key={`${warning.code}-${warning.message}`} className={cn(
                  "flex items-start gap-2 rounded-xl border px-3 py-2 text-sm",
                  warning.severity === "critical"
                    ? "border-red-200 bg-red-50 text-red-900"
                    : "border-amber-200 bg-amber-50 text-amber-900",
                )}>
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                  <span>{warning.message}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Tabs value={category} onValueChange={(value) => setCategory(value as Category)}>
        <TabsList className="grid h-12 w-full grid-cols-3 rounded-xl bg-[#dfe3dc] p-1">
          {(Object.keys(CATEGORY_LABEL) as Category[]).map((value) => {
            const count = player.deck.items.filter((item) => item.category === value).length;
            return (
              <TabsTrigger key={value} value={value} className="h-10 rounded-lg text-xs font-black sm:text-sm">
                {CATEGORY_LABEL[value]} <span className="font-mono opacity-55">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>
        {(Object.keys(CATEGORY_LABEL) as Category[]).map((value) => (
          <TabsContent key={value} value={value} className="mt-3 space-y-2.5">
            {player.deck.items.filter((item) => item.category === value).map((item) => (
              <DeckItemRow
                key={item.id}
                item={item}
                observed={player.checkState[item.id] ?? 0}
                onChange={(next) => setObserved(item, next)}
              />
            ))}
          </TabsContent>
        ))}
      </Tabs>

      <div className="sticky bottom-3 z-20 grid gap-2 rounded-2xl border bg-card/95 p-3 shadow-[0_12px_40px_rgba(21,34,56,0.18)] backdrop-blur sm:grid-cols-2">
        {player.status.startsWith("done") ? (
          <Button variant="outline" className="h-12 sm:col-span-2" onClick={reopen}>
            <RotateCcw /> Reabrir conferência
          </Button>
        ) : (
          <>
            <Button
              className="h-12 font-bold"
              onClick={finishClean}
              disabled={!allExact || listHasCriticalWarning}
              title={!allExact ? "Conclua todas as pilhas" : listHasCriticalWarning ? "A lista possui alerta crítico" : undefined}
            >
              <CheckCircle2 /> Concluir sem irregularidade
            </Button>
            <Button variant="destructive" className="h-12 font-bold" onClick={() => setIssueOpen(true)}>
              <ShieldAlert /> Registrar ocorrência
            </Button>
          </>
        )}
      </div>

      {player.status === "done_issue" && player.result_note && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-950">
          <p className="font-black">Ocorrência registrada</p>
          <p className="mt-1 whitespace-pre-wrap leading-6">{player.result_note}</p>
        </div>
      )}

      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar ocorrência</DialogTitle>
            <DialogDescription>
              Descreva objetivamente a divergência. A ferramenta não substitui investigação nem decisão do Head Judge.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={issueNote}
            onChange={(event) => setIssueNote(event.target.value)}
            placeholder="Ex.: lista contém 3 Ultra Ball; baralho físico contém 4..."
            className="min-h-32"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIssueOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={finishWithIssue}>Salvar ocorrência</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function ImportDialog({ open, onOpenChange, onSaved, tournamentId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: (players: Player[]) => void;
  tournamentId: string;
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
    const missingReview = selected.find((result) => !result.reviewed || !result.playerName.trim());
    if (missingReview) {
      toast.error("Revise e confirme todas as listas selecionadas.");
      return;
    }
    setBusy(true);
    try {
      const payload = selected.map((result) => ({
        name: result.playerName.trim(),
        sourceName: result.sourceName,
        deck: {
          playerName: result.playerName.trim(),
          items: result.items,
          total: result.total,
          warnings: result.warnings,
          sourceName: result.sourceName,
          rawText: "",
          extractionMethod: result.extractionMethod,
        },
      }));
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

function PenaltiesPanel({ players, penalties, loading, onCreate, onDelete, reportPath, judgeName }: {
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

function RulesPanel({ playerCount, completedCount }: { playerCount: number; completedCount: number }) {
  const target = playerCount ? Math.ceil(playerCount * 0.1) : 0;
  return (
    <section>
      <Tabs defaultValue="lists">
        <TabsList className="mb-5 grid h-12 w-full grid-cols-2 rounded-xl bg-[#dfe3dc] p-1 sm:max-w-xl">
          <TabsTrigger value="lists" className="h-10 font-black"><ListChecks /> Listas e deck check</TabsTrigger>
          <TabsTrigger value="game" className="h-10 font-black"><Gavel /> Jogo</TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="space-y-5">
          <div className="grid gap-4 md:grid-cols-[1.25fr_.75fr]">
        <div className="rounded-3xl border bg-[#152238] p-6 text-white shadow-sm">
          <div className="flex items-center gap-2 text-[#e0b348]"><Gavel className="size-5" /><span className="text-xs font-black tracking-[0.16em] uppercase">Referência rápida</span></div>
          <h2 className="mt-4 text-2xl font-black">Deck check: quatro verificações</h2>
          <ol className="mt-5 grid gap-3 text-sm leading-6 text-white/80 sm:grid-cols-2">
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">1. Lista</strong><br />Completa e legível.</li>
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">2. Legalidade</strong><br />O baralho descrito é legal.</li>
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">3. Correspondência</strong><br />Baralho físico igual à lista.</li>
            <li className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">4. Marcas</strong><br />Cartas e sleeves sem padrão identificável.</li>
          </ol>
        </div>
        <div className="rounded-3xl border bg-card p-5 shadow-sm">
          <p className="text-xs font-black tracking-[0.14em] text-muted-foreground uppercase">Meta oficial</p>
          <div className="mt-4 flex items-baseline gap-2"><strong className="font-mono text-5xl text-primary">{completedCount}</strong><span className="font-mono text-xl text-muted-foreground">/{target}</span></div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Espera-se conferir ao menos 10% dos baralhos em eventos da Championship Series, mantendo a qualidade.</p>
          <Progress value={target ? Math.min(100, Math.round((completedCount / target) * 100)) : 0} className="mt-4 h-3" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border bg-card shadow-sm">
        <div className="border-b p-5">
          <h2 className="text-xl font-black">Legalidade do baralho — penalidade inicial recomendada</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Resumo da seção 5.6.1 do Guia de Penalidades. Investigue contexto e intenção; o documento oficial e a decisão do Head Judge prevalecem.</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-32">Grau</TableHead>
              <TableHead className="w-40">Inicial</TableHead>
              <TableHead>Quando se aplica / exemplos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell><Badge className="bg-amber-100 text-amber-900">Menor</Badge></TableCell>
              <TableCell className="font-black">Advertência</TableCell>
              <TableCell className="min-w-80 text-sm leading-6">Pouca ou nenhuma oportunidade de vantagem: desgaste sem padrão; número de coleção ausente, mas a carta ainda é identificável; variante de raridade diferente da mesma carta.</TableCell>
            </TableRow>
            <TableRow>
              <TableCell><Badge className="bg-red-100 text-red-900">Grave</Badge></TableCell>
              <TableCell className="font-black">Game Loss</TableCell>
              <TableCell className="min-w-80 text-sm leading-6">Há oportunidade de vantagem por ambiguidade ou divergência: lista/baralho não tem 60; quantidades não batem; impressão de Pokémon diferente; mais de 4 Energias Especiais do mesmo nome; padrão relevante de cartas marcadas.</TableCell>
            </TableRow>
            <TableRow>
              <TableCell><Badge variant="destructive">Gravíssima</Badge></TableCell>
              <TableCell className="font-black">Desqualificação</TableCell>
              <TableCell className="min-w-80 text-sm leading-6">Manipulação intencional, cartas não registradas que geram vantagem ou marcações intencionais/repetidas. Investigue cuidadosamente antes de concluir intenção.</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-3xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-black"><CircleAlert className="text-amber-600" /> Como corrigir divergências</h3>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
            <li>• A lista registrada tem prioridade sobre o baralho físico; em regra, ajuste o baralho para corresponder à lista.</li>
            <li>• Se a lista tiver menos de 60, carta ilegal ou impossível de identificar, complete-a com Energias Básicas escolhidas pelo jogador e depois ajuste o baralho físico.</li>
            <li>• Cartas ilegais por condição, idioma ou formato devem ser substituídas.</li>
            <li>• Cartas adicionais na deck box podem exigir revisão; aparência distinta e ausência de intenção importam.</li>
          </ul>
        </article>
        <article className="rounded-3xl border bg-card p-5 shadow-sm">
          <h3 className="flex items-center gap-2 font-black"><Archive className="text-primary" /> Documentos oficiais</h3>
          <div className="mt-3 grid gap-2">
            {[
              ["Tournament Rules Handbook", OFFICIAL_RULES_URL],
              ["TCG Tournament Handbook", OFFICIAL_TCG_URL],
              ["Penalty Guidelines", OFFICIAL_PENALTIES_URL],
            ].map(([label, url]) => (
              <a key={url} href={url} target="_blank" rel="noreferrer" className="flex min-h-11 items-center justify-between rounded-xl border bg-white px-3 text-sm font-bold transition hover:border-primary hover:text-primary">
                {label}<ExternalLink className="size-4" />
              </a>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">Referência revisada contra os documentos oficiais publicados em Q2 de 2026. Verifique atualizações antes de eventos futuros.</p>
        </article>
      </div>
        </TabsContent>

        <TabsContent value="game" className="space-y-5">
          <div className="rounded-3xl border bg-[#152238] p-6 text-white shadow-sm">
            <div className="flex items-center gap-2 text-[#e0b348]"><Gavel className="size-5" /><span className="text-xs font-black tracking-[0.16em] uppercase">Referência rápida de jogo</span></div>
            <h2 className="mt-4 text-2xl font-black">Investigue, preserve e corrija o estado</h2>
            <div className="mt-5 grid gap-3 text-sm leading-6 text-white/80 sm:grid-cols-2 lg:grid-cols-4">
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">1. Pare a ação</strong><br />Evite que novas decisões agravem o erro.</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">2. Ouça ambos</strong><br />Reconstrua ações, informação vista e vantagem.</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">3. Reverta se possível</strong><br />Para erros menores e graves, preserve o jogo quando a correção for confiável.</p>
              <p className="rounded-xl border border-white/10 bg-white/5 p-3"><strong className="text-white">4. Registre</strong><br />Informe o Head Judge e documente fato, penalidade e fix.</p>
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black">Penalidades recorrentes</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Penalidades iniciais recomendadas. Reversibilidade, repetição, idade, experiência e impacto real podem justificar desvio.</p>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <article className="rounded-2xl border bg-card p-4 shadow-sm md:col-span-2 xl:col-span-3">
                <h3 className="font-black">Erro de jogo</h3>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">Escolha o grau pelo impacto e pela possibilidade de reconstruir o estado da partida.</p>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  {[
                    ["Menor", "Warning", "Correção simples, com impacto limitado."],
                    ["Grave", "Double Prize Card", "Houve vantagem ou efeito relevante, mas a partida ainda pode ser corrigida."],
                    ["Gravíssimo", "Game Loss", "O estado da partida não pode ser reconstruído com segurança."],
                  ].map(([grade, penalty, description]) => (
                    <div key={grade} className="rounded-xl border bg-muted/35 p-3">
                      <p className="text-xs font-black tracking-wide text-muted-foreground uppercase">{grade}</p>
                      <p className="mt-1 font-black text-primary">{penalty}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
                    </div>
                  ))}
                </div>
                <p className="mt-4 text-sm leading-6"><strong>Exemplos:</strong> ataque sem Energia, Prêmios não preparados, carta extra, Prêmio tomado incorretamente ou segunda Energia anexada sem efeito.</p>
              </article>
              {[
                ["Ritmo de jogo", "Menor: Warning · Grave: Double Prize Card", "Decisões isoladamente lentas, buscas repetidas e demora habitual que não melhora após penalidade."],
                ["Erro de procedimento", "Menor: Caution · Grave: Warning · Gravíssimo: Game Loss", "Resultado não confirmado, instrução da equipe ignorada, marcadores ausentes ou atraso causado ao evento."],
                ["Atraso", "<5 min: Warning · 5-10 min: Game Loss · >10 min: Match Loss e drop", "O jogador deve chegar ao local correto no início da rodada; o atraso começa a contar quando a rodada começa."],
                ["Conduta antidesportiva", "Menor: Warning · Grave: Match Loss · Gravíssima: Disqualification", "Perturbar partidas, intimidação, recusa de política, ameaças, insultos ou manipulação imprópria do resultado."],
                ["Cheating", "Disqualification", "Exige conhecimento e tentativa de vantagem: comprar cartas de propósito, alterar contadores, empilhar ou embaralhar insuficientemente de forma deliberada."],
              ].map(([title, penalty, detail]) => (
                <article key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm font-bold text-primary">{penalty}</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-black">Rulings operacionais frequentes</h2>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {[
                ["Carta comprada a mais", "Normalmente erro grave e Double Prize Card. Se a carta correta ainda for identificável e sua face não tiver sido vista, pode ser totalmente revertido e tratado como Warning."],
                ["Prêmios não preparados", "Warning quando percebido cedo e facilmente corrigido; pode chegar a Double Prize Card após uma ou duas buscas com acesso potencial às seis cartas, ou Game Loss após três ou mais buscas."],
                ["Ataque sem Energia suficiente", "Começa como Warning quando corrigido imediatamente. Se houve Nocaute e várias ações/turnos ocorreram, avalie Double/Quadruple Prize Card ou Game Loss conforme a reparabilidade."],
                ["Prêmio tomado sem Nocaute ou em excesso", "Erro grave com Double Prize Card como ponto inicial, considerando informação revelada e possibilidade de reconstruir o estado."],
                ["Mais de uma Energia anexada no turno", "Sem efeito permitindo, é exemplo de erro grave de jogo e começa em Double Prize Card."],
                ["Tempos de referência", "Setup e embaralhamento inicial: 3 min; primeira busca: 45 s; buscas seguintes: 15 s; ação/ataque: 15 s; decisão antes de jogar carta: 10 s; iniciar turno: 5 s."],
              ].map(([title, detail]) => (
                <article key={title} className="rounded-2xl border bg-card p-4 shadow-sm">
                  <h3 className="font-black">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{detail}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <strong>Importante:</strong> a tela é referência rápida, não decisão automática. Confirme a seção aplicável no Penalty Guidelines e consulte o Head Judge antes de penalidades acima de Warning.
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}

type JudgeSession = {
  role: "judge";
  user: { id: string; name: string; login: string };
};

type TournamentSummary = {
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
  const [players, setPlayers] = useState<Player[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState("players");
  const [importOpen, setImportOpen] = useState(false);
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
      else if (!quiet) toast.error(error instanceof Error ? error.message : "Servidor indisponível.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [onLogout, tournament.id]);

  const loadPenalties = useCallback(async (quiet = false) => {
    if (!quiet) setPenaltiesLoading(true);
    try {
      const data = await api<{ penalties: Penalty[] }>(`/api/tournaments/${tournament.id}/penalties`);
      setPenalties(data.penalties);
    } catch (error) {
      if ((error as Error & { status?: number }).status === 401) onLogout();
      else if (!quiet) toast.error(error instanceof Error ? error.message : "Não foi possível carregar penalidades.");
    } finally {
      if (!quiet) setPenaltiesLoading(false);
    }
  }, [onLogout, tournament.id]);

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
      toast.error(error instanceof Error ? error.message : "Não foi possível salvar o progresso.");
      await loadPlayers(true);
    }
  }

  async function deletePlayer(id: string) {
    try {
      await api(`/api/tournaments/${tournament.id}/players/${id}`, { method: "DELETE" });
      setPlayers((current) => current.filter((player) => player.id !== id));
      if (selectedId === id) setSelectedId(null);
      toast.success("Jogador removido.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir.");
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
    if (!linkedPlayer) throw new Error("Jogador não encontrado neste torneio.");
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
      toast.success("Ocorrência registrada.");
    } catch (error) {
      setPenalties((current) => current.filter((penalty) => penalty.id !== optimisticId));
      toast.error(error instanceof Error ? error.message : "Falha ao registrar penalidade.");
      throw error;
    }
  }

  async function deletePenalty(id: string) {
    try {
      await api(`/api/tournaments/${tournament.id}/penalties/${id}`, { method: "DELETE" });
      setPenalties((current) => current.filter((penalty) => penalty.id !== id));
      toast.success("Penalidade removida.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao excluir penalidade.");
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
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white/70 hover:bg-white/10 hover:text-white" aria-label="Voltar aos torneios">
            <ArrowLeft />
          </Button>
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-white/15 bg-white/10 text-[#e0b348]">
            <ClipboardCheck className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-black tracking-tight sm:text-lg">{tournament.name}</h1>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-300"><Wifi className="size-3" /> {session.user.name} · servidor conectado</p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => window.location.assign("/api/backup")} className="text-white/70 hover:bg-white/10 hover:text-white" aria-label="Baixar backup">
            <Archive />
          </Button>
          <Button variant="ghost" size="icon" onClick={logout} className="text-white/70 hover:bg-white/10 hover:text-white" aria-label="Sair">
            <LogOut />
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
        <Tabs value={view} onValueChange={setView}>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <TabsList className="grid h-12 w-full grid-cols-4 rounded-xl bg-[#dfe3dc] p-1 sm:w-auto sm:min-w-[600px]">
              <TabsTrigger value="players" className="h-10 px-2 font-black"><Users /><span className="hidden min-[430px]:inline">Jogadores</span></TabsTrigger>
              <TabsTrigger value="check" className="h-10 px-2 font-black"><ClipboardCheck /><span className="hidden min-[430px]:inline">Conferência</span></TabsTrigger>
              <TabsTrigger value="penalties" className="h-10 px-2 font-black"><ShieldAlert /><span className="hidden min-[430px]:inline">Ocorrências</span></TabsTrigger>
              <TabsTrigger value="rules" className="h-10 px-2 font-black"><Gavel /><span className="hidden min-[430px]:inline">Regras</span></TabsTrigger>
            </TabsList>
            <Button className="h-12 font-black shadow-sm" onClick={() => setImportOpen(true)}>
              <FileUp /> Importar listas
            </Button>
          </div>

          <TabsContent value="players" className="space-y-4">
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <StatCard label="Jogadores" value={players.length} detail="listas no servidor" tone="navy" />
              <StatCard label="Pendentes" value={pending} detail="a conferir" tone="amber" />
              <StatCard label="Concluídos" value={completed} detail="deck checks" tone="green" />
              <StatCard label="Ocorrências" value={issues} detail="registradas" tone={issues ? "red" : "green"} />
            </div>
            <div className="flex justify-end">
              <Button variant="outline" className="w-full sm:w-auto" onClick={() => openPdf(`/api/tournaments/${tournament.id}/reports/occurrences.pdf`)}>
                <Download /> Exportar ocorrências em PDF
              </Button>
            </div>
            <PlayerList
              players={players}
              selectedId={selectedId}
              onSelect={(id) => { setSelectedId(id); setView("check"); }}
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
                <h2 className="mt-4 text-xl font-black">Nenhuma lista cadastrada</h2>
                <p className="mt-2 text-sm text-muted-foreground">Importe as listas no computador para começar.</p>
                <Button className="mt-5" onClick={() => setImportOpen(true)}><FileUp /> Importar listas</Button>
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
        onOpenChange={setImportOpen}
        tournamentId={tournament.id}
        onSaved={(created) => {
          setPlayers((current) => [...current, ...created].sort((left, right) => left.name.localeCompare(right.name, "pt-BR")));
          setSelectedId(created[0]?.id ?? selectedId);
        }}
      />
      <Toaster position="top-center" richColors closeButton />
    </main>
  );
}
