import { formatDate } from "@/lib/client-api";

export function deadlineLabel(value: string) {
  if (!value) return "Prazo não informado";
  return `${Date.parse(value) < Date.now() ? "Encerrado em" : "Até"} ${formatDate(value)}`;
}
