"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { api } from "@/lib/client-api";
import { JudgeTournamentWorkspace } from "../judge-workspace/judge-tournament-workspace";
import { Session, Tournament } from "./types";
import { AuthScreen } from "./auth-screen";
import { JudgeDashboard } from "./judge-dashboard";
import { PlayerDashboard } from "./player-dashboard";

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
