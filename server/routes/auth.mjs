import { Router } from "express";
import { hashPassword, verifyPassword } from "../auth/passwords.mjs";
import { normalizeLogin, normalizePlayId } from "../http-input.mjs";
import { rejectTooManyAttempts } from "../auth/login-throttle.mjs";

export function authRoutes({ store, sessions, throttle, requireAuth }) {
  const router = Router();

  router.post("/auth/judge/login", (request, response) => {
    const login = normalizeLogin(request.body?.login);
    const password = String(request.body?.password || "");
    const lockKey = `judge:${login}`;
    if (throttle.isLocked(lockKey)) return rejectTooManyAttempts(response);
    const judge = store.findJudgeByLogin(login);
    if (!judge || !verifyPassword(password, judge.password_hash)) {
      throttle.recordFailure(lockKey);
      return response.status(401).json({ error: "Login ou senha incorretos.", code: "login_invalid" });
    }
    sessions.start(response, "judge", judge.id);
    response.json({ session: { role: "judge", user: store.getJudge(judge.id) } });
  });

  router.post("/login", (request, response) => {
    if (throttle.isLocked("judge:admin")) return rejectTooManyAttempts(response);
    const judge = store.findJudgeByLogin("admin");
    if (!judge || !verifyPassword(String(request.body?.password || ""), judge.password_hash)) {
      throttle.recordFailure("judge:admin");
      return response.status(401).json({ error: "Senha incorreta.", code: "password_invalid" });
    }
    sessions.start(response, "judge", judge.id);
    response.json({ ok: true });
  });

  router.post("/auth/player/register", (request, response) => {
    const playId = normalizePlayId(request.body?.playId);
    const name = String(request.body?.name || "").trim();
    const password = String(request.body?.password || "");
    if (!/^\d{5,12}$/.test(playId)) return response.status(400).json({ error: "Informe um Play! Pokémon ID válido.", code: "play_id_invalid" });
    if (name.length < 2 || name.length > 80) return response.status(400).json({ error: "Informe o nome completo do jogador.", code: "player_name_required" });
    if (password.length < 6) return response.status(400).json({ error: "A senha do jogador deve ter pelo menos 6 caracteres.", code: "player_password_short" });
    if (store.findPlayerAccountByPlayId(playId)) return response.status(409).json({ error: "Já existe uma conta com este Play! Pokémon ID.", code: "play_id_taken" });
    const account = store.createPlayerAccount({ playId, name, passwordHash: hashPassword(password) });
    sessions.start(response, "player", account.id);
    response.status(201).json({ session: { role: "player", user: account } });
  });

  router.post("/auth/player/login", (request, response) => {
    const playId = normalizePlayId(request.body?.playId);
    const password = String(request.body?.password || "");
    const lockKey = `player:${playId}`;
    if (throttle.isLocked(lockKey)) return rejectTooManyAttempts(response);
    const account = store.findPlayerAccountByPlayId(playId);
    if (!account || !verifyPassword(password, account.password_hash)) {
      throttle.recordFailure(lockKey);
      return response.status(401).json({ error: "Play! Pokémon ID ou senha incorretos.", code: "player_login_invalid" });
    }
    sessions.start(response, "player", account.id);
    response.json({ session: { role: "player", user: store.getPlayerAccount(account.id) } });
  });

  router.post("/logout", (_request, response) => {
    sessions.end(response);
    response.json({ ok: true });
  });

  router.get("/session", requireAuth, (request, response) => {
    response.json({ session: request.auth });
  });

  return router;
}
