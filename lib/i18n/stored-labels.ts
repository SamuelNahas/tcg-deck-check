import type { MessageParams } from "./index";

type Translate = (key: string, params?: MessageParams) => string;

// Text the API stores in Portuguese (default judge name, deck sources). Shown translated; any other value is shown as typed.
const STORED_KEYS: Record<string, string> = {
  "Juiz principal": "stored.mainJudge",
  "Envio do jogador": "stored.playerSubmission",
  "Importação do Pokémon TCG Live": "stored.tcgLiveImport",
  "Importação do juiz": "stored.judgeImport",
  "Aguardando envio": "stored.awaitingSubmission",
  "Dados anteriores à versão 3": "stored.legacyTournament",
};

export function storedLabel(t: Translate, value: string) {
  const pasted = value.match(/^Texto colado(?: (\d+))?$/);
  if (pasted) return pasted[1] ? t("stored.pastedTextN", { number: pasted[1] }) : t("stored.pastedText");
  const key = STORED_KEYS[value];
  return key ? t(key) : value;
}
