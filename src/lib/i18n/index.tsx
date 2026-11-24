"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { enMessages, esMessages, ptMessages } from "./messages";

export type Lang = "en" | "pt" | "es";
export type Messages = Record<string, string>;
export type MessageParams = Record<string, string | number>;

export const DEFAULT_LANG: Lang = "en";
export const LANGUAGES: ReadonlyArray<{ code: Lang; label: string; locale: string }> = [
  { code: "en", label: "English", locale: "en-US" },
  { code: "pt", label: "Português", locale: "pt-BR" },
  { code: "es", label: "Español", locale: "es-ES" },
];

const STORAGE_KEY = "deckcheck.lang";
const dictionaries: Record<Lang, Messages> = { en: enMessages, pt: ptMessages, es: esMessages };
const listeners = new Set<() => void>();
let currentLang: Lang = DEFAULT_LANG;
let loaded = false;

const isLang = (value: unknown): value is Lang => LANGUAGES.some(({ code }) => code === value);

function loadStoredLang(): Lang {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isLang(stored) ? stored : DEFAULT_LANG;
  } catch {
    return DEFAULT_LANG;
  }
}

export function getLang(): Lang {
  if (!loaded && typeof window !== "undefined") {
    currentLang = loadStoredLang();
    loaded = true;
  }
  return currentLang;
}

export function setLang(lang: Lang) {
  currentLang = lang;
  loaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // Storage can be blocked (private mode); the choice still applies to this session.
  }
  document.documentElement.lang = LANGUAGES.find(({ code }) => code === lang)?.locale ?? lang;
  listeners.forEach((listener) => listener());
}

export function localeOf(lang: Lang = getLang()) {
  return LANGUAGES.find(({ code }) => code === lang)?.locale ?? "en-US";
}

/** Looks up a key in the language, falling back to English and then to the key itself. */
export function translate(lang: Lang, key: string, params?: MessageParams) {
  const template = dictionaries[lang][key] ?? dictionaries.en[key] ?? key;
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name) => String(params[name] ?? match));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useLang(): Lang {
  const lang = useSyncExternalStore(subscribe, getLang, () => DEFAULT_LANG);
  useEffect(() => {
    document.documentElement.lang = localeOf(lang);
  }, [lang]);
  return lang;
}

export function useT() {
  const lang = useLang();
  return useCallback((key: string, params?: MessageParams) => translate(lang, key, params), [lang]);
}
