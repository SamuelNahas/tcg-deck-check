import { Router } from "express";
import { hashPassword } from "../auth/passwords.mjs";
import { normalizeLogin } from "../http-input.mjs";

export function judgesRoutes({ store, requireRole }) {
  const router = Router();

  router.get("/judges", requireRole("judge"), (_request, response) => {
    response.json({ judges: store.listJudges() });
  });

  router.post("/judges", requireRole("judge"), (request, response) => {
    const login = normalizeLogin(request.body?.login);
    const name = String(request.body?.name || "").trim();
    const password = String(request.body?.password || "");
    if (!/^[a-z0-9._-]{3,40}$/.test(login)) return response.status(400).json({ error: "Use um login de 3 a 40 caracteres, sem espaços." });
    if (name.length < 2 || name.length > 80) return response.status(400).json({ error: "Informe o nome do juiz." });
    if (password.length < 8) return response.status(400).json({ error: "A senha do juiz deve ter pelo menos 8 caracteres." });
    if (store.findJudgeByLogin(login)) return response.status(409).json({ error: "Este login de juiz já existe." });
    response.status(201).json({ judge: store.createJudge({ login, name, passwordHash: hashPassword(password) }) });
  });

  return router;
}
