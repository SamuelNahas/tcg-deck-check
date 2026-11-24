import { formatDate } from "@/lib/client-api";

export function deadlineLabel(t: (key: string, params?: Record<string, string | number>) => string, value: string) {
  if (!value) return t("tournaments.deadline.unset");
  return t(Date.parse(value) < Date.now() ? "tournaments.deadline.endedAt" : "tournaments.deadline.until", { date: formatDate(value) });
}
