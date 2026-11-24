import type { Messages } from "./index";
import { commonMessages } from "./messages-common";
import { cardsMessages } from "@/features/cards/messages";
import { panelsMessages } from "@/features/judge-workspace/messages-panels";
import { judgeMessages } from "@/features/judge-workspace/messages";
import { tournamentMessages } from "@/features/tournaments/messages";

type LanguageBundle = { en: Messages; pt: Messages; es: Messages };

const bundles: LanguageBundle[] = [commonMessages, cardsMessages, judgeMessages, panelsMessages, tournamentMessages];

const merge = (lang: keyof LanguageBundle): Messages => Object.assign({}, ...bundles.map((bundle) => bundle[lang]));

export const enMessages = merge("en");
export const ptMessages = merge("pt");
export const esMessages = merge("es");
