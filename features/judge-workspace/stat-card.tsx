"use client";

import { cn } from "@/lib/utils";

export function StatCard({ label, value, detail, tone = "navy" }: {
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
