import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";
import { fileURLToPath } from "node:url";

import { createServer } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
const vite = await createServer({
  appType: "custom",
  configFile: false,
  root,
  resolve: { alias: { "@": root } },
  server: { middlewareMode: true },
});
after(() => vite.close());

const { enMessages, ptMessages, esMessages } = await vite.ssrLoadModule("/lib/i18n/messages.ts");
const { translate } = await vite.ssrLoadModule("/lib/i18n/index.tsx");

async function sourceFiles(directory) {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(entries.map((entry) => entry.isDirectory()
    ? sourceFiles(path.join(directory, entry.name))
    : [path.join(directory, entry.name)]));
  return nested.flat().filter((file) => /\.(tsx?|mjs)$/.test(file));
}

test("every language defines exactly the same message keys", () => {
  const keys = (messages) => Object.keys(messages).sort();
  assert.deepEqual(keys(ptMessages), keys(enMessages));
  assert.deepEqual(keys(esMessages), keys(enMessages));
});

test("no message is empty and placeholders match across languages", () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort();
  for (const [key, english] of Object.entries(enMessages)) {
    for (const messages of [ptMessages, esMessages]) {
      assert.ok(messages[key].trim(), `${key} is empty`);
      assert.deepEqual(placeholders(messages[key]), placeholders(english), `${key} placeholders differ`);
    }
  }
});

test("every literal t(\"key\") used by the UI exists in the dictionaries", async () => {
  const used = new Set();
  for (const file of [...await sourceFiles("features"), ...await sourceFiles("components"), ...await sourceFiles("lib")]) {
    const source = await readFile(path.join(root, file), "utf8");
    for (const match of source.matchAll(/\bt\(\s*"([\w.]+)"/g)) used.add(match[1]);
  }
  assert.ok(used.size > 100);
  assert.deepEqual([...used].filter((key) => !(key in enMessages)), []);
});

test("every enum label family is complete", () => {
  const families = {
    "status.": ["awaiting_deck", "pending", "in_progress", "done_clean", "done_issue"],
    "penalty.category.": ["deck", "gameplay", "procedure", "conduct", "other"],
    "card.category.": ["pokemon", "trainer", "energy"],
  };
  for (const [prefix, values] of Object.entries(families)) {
    for (const value of values) assert.ok(`${prefix}${value}` in enMessages, `${prefix}${value}`);
  }
});

test("server error codes and warnings have translations", async () => {
  const codes = new Set();
  for (const file of await sourceFiles("server")) {
    const source = await readFile(path.join(root, file), "utf8");
    for (const match of source.matchAll(/\bcode: "([a-z_]+)"/g)) codes.add(match[1]);
  }
  assert.ok(codes.size > 20);
  assert.deepEqual([...codes].filter((code) => !(`error.${code}` in enMessages)), []);
});

test("translate falls back to English, then to the key, and fills placeholders", () => {
  assert.equal(translate("es", "does.not.exist"), "does.not.exist");
  assert.equal(translate("pt", "error.http", { status: 500 }), "Erro 500");
  assert.equal(translate("en", "error.http", { status: 500 }), "Error 500");
});
