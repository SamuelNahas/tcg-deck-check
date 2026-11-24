"use client";

import { ArrowLeft, ClipboardCheck, Gavel, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher } from "@/components/language-switcher";
import { useT } from "@/lib/i18n";

export function AppHeader({ title, subtitle, onBack, onLogout, role }: {
  title: string;
  subtitle: string;
  onBack?: () => void;
  onLogout: () => void;
  role: "judge" | "player";
}) {
  const t = useT();
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#152238] text-white shadow-lg">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-3 sm:px-6">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="text-white/70 hover:bg-white/10 hover:text-white" aria-label={t("tournaments.header.back")}>
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
        <LanguageSwitcher />
        <Button variant="ghost" size="icon" onClick={onLogout} className="text-white/70 hover:bg-white/10 hover:text-white" aria-label={t("tournaments.header.logout")}>
          <LogOut />
        </Button>
      </div>
    </header>
  );
}
