import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const PASSWORD = "teste-seguranca-123";

function startApi(port, directory) {
  const child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      DECKCHECK_APP_PASSWORD: PASSWORD,
      DECKCHECK_DB_PATH: join(directory, "api.sqlite"),
      DECKCHECK_API_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const ready = new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("API não iniciou a tempo")), 10_000);
    child.once("error", reject);
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes("API pronta")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
  return { child, ready };
}

async function request(base, path, { cookie, body, method = "POST" } = {}) {
  return fetch(`${base}${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...(cookie ? { Cookie: cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("bloqueia tentativas repetidas de login e rejeita PATCH de jogador inválido", async () => {
  const directory = mkdtempSync(join(tmpdir(), "deckcheck-security-"));
  const port = 31238;
  const base = `http://127.0.0.1:${port}`;
  const { child, ready } = startApi(port, directory);

  try {
    await ready;
    const login = await request(base, "/api/auth/judge/login", { body: { login: "admin", password: PASSWORD } });
    const cookie = login.headers.get("set-cookie").split(";")[0];
    const tournament = await (await request(base, "/api/tournaments", {
      cookie,
      body: {
        name: "Copa Segurança",
        eventDate: "2026-12-01",
        decklistDeadline: new Date(Date.now() + 86_400_000).toISOString(),
        password: "1234",
      },
    })).json();
    const { id } = (await (await request(base, `/api/tournaments/${tournament.tournament.id}/players`, {
      cookie,
      body: { name: "Alvo" },
    })).json()).player;
    const playerUrl = `/api/tournaments/${tournament.tournament.id}/players/${id}`;

    for (const body of [{ name: 123 }, { name: "   " }, { notes: { a: 1 } }, { checkState: "x" }]) {
      const response = await request(base, playerUrl, { cookie, method: "PATCH", body });
      assert.equal(response.status, 400, JSON.stringify(body));
    }

    const statuses = [];
    for (let attempt = 0; attempt < 11; attempt += 1) {
      const response = await request(base, "/api/auth/player/login", {
        body: { playId: "1234567", password: `errada-${attempt}` },
      });
      statuses.push(response.status);
    }
    assert.deepEqual(statuses.slice(0, 10), Array(10).fill(401));
    assert.equal(statuses[10], 429);
  } finally {
    child.kill("SIGTERM");
    rmSync(directory, { recursive: true, force: true });
  }
});
