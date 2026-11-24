import { getLang, localeOf, translate } from "@/lib/i18n";

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, { credentials: "same-origin", ...init });
  if (!response.ok) {
    let message = translate(getLang(), "error.http", { status: response.status });
    let details: unknown;
    try {
      const body = await response.json();
      message = body.code ? translate(getLang(), `error.${body.code}`) : body.error || message;
      details = body;
    } catch {
      // Keep the HTTP fallback.
    }
    const error = new Error(message) as Error & { status?: number; details?: unknown };
    error.status = response.status;
    error.details = details;
    throw error;
  }
  if (response.status === 204) return undefined as T;
  return response.json();
}

export function openPdf(path: string) {
  const separator = path.includes("?") ? "&" : "?";
  path = `${path}${separator}lang=${getLang()}`;
  const opened = window.open(path, "_blank", "noopener,noreferrer");
  if (!opened) window.location.assign(path);
}

export function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat(localeOf(), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function localDateTimeValue(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}
