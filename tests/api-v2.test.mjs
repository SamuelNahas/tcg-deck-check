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

async function jsonRequest(url, { cookie, body, method = "POST" } = {}) {
  return fetch(url, {
    method,
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

test("executa o fluxo multi-torneio e bloqueia a lista após o envio", async () => {
  const directory = mkdtempSync(join(tmpdir(), "deckcheck-api-v3-"));
  const port = 31237;
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ["server/server.mjs"], {
    cwd: new URL("..", import.meta.url),
    env: {
      ...process.env,
      DECKCHECK_APP_PASSWORD: "teste-v3-123",
      DECKCHECK_DB_PATH: join(directory, "api.sqlite"),
      DECKCHECK_API_PORT: String(port),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  try {
    await waitForReady(child);
    const judgeLogin = await jsonRequest(`${base}/api/auth/judge/login`, {
      body: { login: "admin", password: "teste-v3-123" },
    });
    assert.equal(judgeLogin.status, 200);
    const judgeCookie = judgeLogin.headers.get("set-cookie").split(";")[0];

    const tournamentResponse = await jsonRequest(`${base}/api/tournaments`, {
      cookie: judgeCookie,
      body: {
        name: "League Cup Teste",
        eventDate: "2030-06-10",
        decklistDeadline: "2030-06-10T12:00:00.000Z",
        password: "senha-torneio",
      },
    });
    assert.equal(tournamentResponse.status, 201);
    const { tournament } = await tournamentResponse.json();

    const awaitingResponse = await jsonRequest(`${base}/api/tournaments/${tournament.id}/players`, {
      cookie: judgeCookie,
      body: { name: "Jogador Sem Lista", playId: "7654321" },
    });
    assert.equal(awaitingResponse.status, 201);
    const awaitingPlayer = (await awaitingResponse.json()).player;
    assert.equal(awaitingPlayer.status, "awaiting_deck");
    assert.equal(awaitingPlayer.deck.total, 0);

    const attachedResponse = await jsonRequest(`${base}/api/tournaments/${tournament.id}/players/bulk`, {
      cookie: judgeCookie,
      body: {
        players: [{
          playerId: awaitingPlayer.id,
          name: awaitingPlayer.name,
          sourceName: "lista-teste.txt",
          deck: { items: [{ id: "budew", category: "pokemon", name: "Budew", quantity: 60 }], total: 60, warnings: [] },
        }],
      },
    });
    assert.equal(attachedResponse.status, 201);
    const attachedPlayer = (await attachedResponse.json()).players[0];
    assert.equal(attachedPlayer.id, awaitingPlayer.id);
    assert.equal(attachedPlayer.status, "pending");
    assert.equal(attachedPlayer.deck.total, 60);

    const playerRegister = await jsonRequest(`${base}/api/auth/player/register`, {
      body: { playId: "1234567", name: "Jogador Teste", password: "senha-jogador" },
    });
    assert.equal(playerRegister.status, 201);
    const playerCookie = playerRegister.headers.get("set-cookie").split(";")[0];

    const join = await jsonRequest(`${base}/api/tournaments/join`, {
      cookie: playerCookie,
      body: { code: tournament.access_code, password: "senha-torneio" },
    });
    assert.equal(join.status, 201);

    const deck = {
      items: [
        {
          category: "pokemon",
          name: "Budew",
          setCode: "PRE",
          collectorNumber: "4",
          quantity: 1,
          subtypes: ["Basic"],
        },
        {
          category: "energy",
          name: "Basic Psychic Energy",
          setCode: "",
          collectorNumber: "",
          quantity: 59,
          subtypes: ["Basic"],
        },
      ],
    };
    const submitted = await jsonRequest(`${base}/api/tournaments/${tournament.id}/deck`, {
      cookie: playerCookie,
      body: deck,
    });
    assert.equal(submitted.status, 201);

    const submittedAgain = await jsonRequest(`${base}/api/tournaments/${tournament.id}/deck`, {
      cookie: playerCookie,
      body: deck,
    });
    assert.equal(submittedAgain.status, 409);

    const playersResponse = await jsonRequest(`${base}/api/tournaments/${tournament.id}/players`, {
      cookie: judgeCookie,
      method: "GET",
    });
    assert.equal(playersResponse.status, 200);
    const { players } = await playersResponse.json();
    assert.equal(players.length, 2);
    const registeredPlayer = players.find((player) => player.player_account_id);
    assert.equal(registeredPlayer.submission_locked, true);

    const occurrence = await jsonRequest(`${base}/api/tournaments/${tournament.id}/penalties`, {
      cookie: judgeCookie,
      body: {
        playerId: registeredPlayer.id,
        roundLabel: "Rodada 2",
        tableLabel: "12",
        category: "procedure",
        penaltyType: "warning",
        reason: "Procedimento incorreto.",
        notes: "Situação corrigida.",
      },
    });
    assert.equal(occurrence.status, 201);
    assert.equal((await occurrence.json()).penalty.judge_name, "Juiz principal");

    for (const report of ["penalties", "occurrences"]) {
      const response = await fetch(`${base}/api/tournaments/${tournament.id}/reports/${report}.pdf`, {
        headers: { Cookie: judgeCookie },
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
