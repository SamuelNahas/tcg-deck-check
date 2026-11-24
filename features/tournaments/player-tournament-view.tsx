"use client";

import { useCallback, useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/client-api";
import { Registration, Session, Tournament } from "./types";
import { deadlineLabel } from "./format";
import { AppHeader } from "./app-header";
import { LockedDeck } from "./locked-deck";
import { DeckBuilder } from "./deck-builder";

export function PlayerTournamentView({ session, tournament, onBack, onLogout }: {
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
