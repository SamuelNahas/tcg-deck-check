import type { MessageParams } from "./index";

export type DeckWarningLike = { code: string; message: string; params?: MessageParams };

/** Localized text for a server warning; falls back to the server's own message for unknown codes. */
export function warningMessage(t: (key: string, params?: MessageParams) => string, warning: DeckWarningLike) {
  const key = `warning.${warning.code}`;
  const text = t(key, warning.params);
  return text === key ? warning.message : text;
}
