import express from "express";
import multer from "multer";
import { createGuards } from "./auth/guards.mjs";
import { createLoginThrottle } from "./auth/login-throttle.mjs";
import { createSessions } from "./auth/session.mjs";
import { authRoutes } from "./routes/auth.mjs";
import { backupRoutes } from "./routes/backup.mjs";
import { cardsRoutes } from "./routes/cards.mjs";
import { decksRoutes } from "./routes/decks.mjs";
import { judgesRoutes } from "./routes/judges.mjs";
import { penaltiesRoutes } from "./routes/penalties.mjs";
import { playersRoutes } from "./routes/players.mjs";
import { reportsRoutes } from "./routes/reports.mjs";
import { createTournamentAccess } from "./routes/tournament-access.mjs";
import { tournamentsRoutes } from "./routes/tournaments.mjs";

export function createApp({ config, store }) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "5mb" }));

  const sessions = createSessions(config);
  const { requireAuth, requireRole } = createGuards({ store, sessions });
  const context = {
    store,
    sessions,
    requireAuth,
    requireRole,
    throttle: createLoginThrottle(),
    ...createTournamentAccess(store),
  };

  app.get("/api/health", (_request, response) => {
    response.json({ ok: true, service: "tcg-deck-check", version: 3 });
  });
  app.use("/api", authRoutes(context));
  app.use("/api", requireAuth);
  app.use("/api", judgesRoutes(context));
  app.use("/api", tournamentsRoutes(context));
  app.use("/api", cardsRoutes());
  app.use("/api", decksRoutes(context));
  app.use("/api", playersRoutes(context));
  app.use("/api", penaltiesRoutes(context));
  app.use("/api", reportsRoutes(context));
  app.use("/api", backupRoutes(context));
  app.use(handleError);
  return app;
}

function handleError(error, _request, response, _next) {
  void _next;
  console.error(error);
  if (error instanceof multer.MulterError) return response.status(400).json({ error: `Falha no arquivo: ${error.message}`, code: "upload_failed" });
  if (String(error?.message || "").includes("UNIQUE constraint failed")) {
    return response.status(409).json({ error: "Já existe um cadastro com esses dados.", code: "duplicate_record" });
  }
  if (error?.name === "AbortError") return response.status(504).json({ error: "A base de imagens demorou para responder. Tente novamente.", code: "image_catalog_timeout" });
  response.status(500).json({ error: error.message || "Erro interno.", code: "internal_error" });
}
