"use client";

import { useState } from "react";
import { ClipboardCheck, Gavel, Loader2, LockKeyhole, LogIn, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/utils";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useT } from "@/lib/i18n";

import { Session } from "./types";

export function AuthScreen({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const t = useT();
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
      toast.error(error instanceof Error ? error.message : t("tournaments.auth.signInFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-8">
      <div className="fixed top-3 right-3 z-50 rounded-lg bg-[#152238] text-white shadow-md"><LanguageSwitcher /></div>
      <section className="w-full max-w-lg overflow-hidden rounded-[2rem] border bg-card shadow-[0_24px_80px_rgba(21,34,56,0.18)]">
        <div className="bg-[#152238] px-6 py-7 text-white sm:px-8">
          <div className="mb-6 flex size-14 items-center justify-center rounded-2xl border border-white/20 bg-white/10">
            <ClipboardCheck className="size-7 text-[#e0b348]" />
          </div>
          <p className="text-xs font-bold tracking-[0.22em] text-white/55 uppercase">{t("tournaments.auth.tagline")}</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight">TCG Deck Check</h1>
          <p className="mt-3 text-sm leading-6 text-white/70">{t("tournaments.auth.intro")}</p>
        </div>

        <div className="p-5 sm:p-7">
          <div className="grid grid-cols-2 rounded-xl bg-muted p-1">
            <button type="button" onClick={() => { setRole("player"); setPassword(""); }} className={cn("flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-black", role === "player" ? "bg-white shadow-sm" : "text-muted-foreground")}>
              <Users className="size-4" /> {t("tournaments.auth.player")}
            </button>
            <button type="button" onClick={() => { setRole("judge"); setPassword(""); }} className={cn("flex h-11 items-center justify-center gap-2 rounded-lg text-sm font-black", role === "judge" ? "bg-white shadow-sm" : "text-muted-foreground")}>
              <Gavel className="size-4" /> {t("tournaments.auth.judge")}
            </button>
          </div>

          {role === "player" && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Button type="button" variant={playerMode === "login" ? "default" : "outline"} onClick={() => setPlayerMode("login")}>{t("tournaments.auth.haveAccount")}</Button>
              <Button type="button" variant={playerMode === "register" ? "default" : "outline"} onClick={() => setPlayerMode("register")}>{t("tournaments.auth.createAccount")}</Button>
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-4">
            {role === "player" ? (
              <>
                {playerMode === "register" && (
                  <label className="block space-y-2 text-sm font-bold">
                    <span>{t("tournaments.auth.fullName")}</span>
                    <Input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
                  </label>
                )}
                <label className="block space-y-2 text-sm font-bold">
                  <span>Play! Pokémon ID</span>
                  <Input inputMode="numeric" value={playId} onChange={(event) => setPlayId(event.target.value)} placeholder={t("tournaments.auth.numbersOnly")} autoComplete="username" required />
                </label>
              </>
            ) : (
              <label className="block space-y-2 text-sm font-bold">
                <span>{t("tournaments.auth.judgeLogin")}</span>
                <Input value={judgeLogin} onChange={(event) => setJudgeLogin(event.target.value)} autoComplete="username" required />
              </label>
            )}
            <label className="block space-y-2 text-sm font-bold">
              <span>{t("tournaments.auth.password")}</span>
              <div className="relative">
                <LockKeyhole className="pointer-events-none absolute top-3 left-3.5 size-5 text-muted-foreground" />
                <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="h-11 pl-11" autoComplete={playerMode === "register" && role === "player" ? "new-password" : "current-password"} required />
              </div>
            </label>
            {role === "judge" && <p className="rounded-xl bg-muted/60 px-3 py-2 text-xs leading-5 text-muted-foreground">{t("tournaments.auth.firstAccess", { login: "admin", file: ".env" })}</p>}
            <Button className="h-12 w-full text-base font-black" disabled={busy}>
              {busy ? <Loader2 className="animate-spin" /> : playerMode === "register" && role === "player" ? <UserPlus /> : <LogIn />}
              {role === "player" && playerMode === "register" ? t("tournaments.auth.createAccount") : t("tournaments.auth.signIn")}
            </Button>
          </form>
        </div>
      </section>
    </main>
  );
}
