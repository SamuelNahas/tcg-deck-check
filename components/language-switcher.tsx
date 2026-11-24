"use client";

import { Globe } from "lucide-react";

import { LANGUAGES, type Lang, setLang, useLang, useT } from "@/lib/i18n";

export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const lang = useLang();
  const t = useT();
  return (
    <label className={`relative inline-flex items-center ${className}`}>
      <Globe className="pointer-events-none absolute left-2.5 size-4 opacity-70" aria-hidden="true" />
      <span className="sr-only">{t("common.language")}</span>
      <select
        value={lang}
        onChange={(event) => setLang(event.target.value as Lang)}
        className="h-9 w-20 cursor-pointer appearance-none sm:w-auto rounded-lg border border-white/20 bg-white/10 pl-8 pr-1 sm:pr-3 text-xs font-bold text-inherit outline-none hover:bg-white/15 focus-visible:ring-2 focus-visible:ring-white/50 [&>option]:text-slate-900"
      >
        {LANGUAGES.map(({ code, label }) => (
          <option key={code} value={code}>{label}</option>
        ))}
      </select>
    </label>
  );
}
