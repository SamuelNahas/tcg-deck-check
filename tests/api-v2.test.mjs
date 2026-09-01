import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

function waitForReady(child) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("API não iniciou a tempo")), 10_000);
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("API pronta")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
}

test("cria penalidade e exporta os dois relatórios PDF", async () => {
  const directory = mkdtempSync(join(tmpdir(), "deckcheck-api-v2-"));
  const port = 31237;
  const child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      DECKCHECK_APP_PASSWORD: "teste-v2-123",
      DECKCHECK_DB_PATH: join(directory, "api.sqlite"),
      DECKCHECK_API_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForReady(child);
    const login = await fetch(`http://127.0.0.1:${port}/api/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "teste-v2-123" }),
    });
    assert.equal(login.status, 200);
    const cookie = login.headers.get("set-cookie").split(";")[0];

    const created = await fetch(`http://127.0.0.1:${port}/api/penalties`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({
        playerName: "Jogador Teste",
        roundLabel: "Rodada 2",
        tableLabel: "12",
        category: "procedure",
        penaltyType: "warning",
        reason: "Procedimento incorreto.",
        notes: "Situação corrigida.",
        judgeName: "Juiz Teste",
      }),
    });
    assert.equal(created.status, 201);

    for (const report of ["penalties", "occurrences"]) {
      const response = await fetch(`http://127.0.0.1:${port}/api/reports/${report}.pdf`, {
        headers: { Cookie: cookie },
      });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "application/pdf");
      const bytes = Buffer.from(await response.arrayBuffer());
      assert.match(bytes.subarray(0, 8).toString("ascii"), /^%PDF-1\.[3-7]$/);
    }
  } finally {
    child.kill("SIGTERM");
    rmSync(directory, { recursive: true, force: true });
  }
});
