import { Router } from "express";

export function backupRoutes({ store, requireRole }) {
  const router = Router();

  router.get("/backup", requireRole("judge"), (_request, response) => {
    const stamp = new Date().toISOString().slice(0, 10);
    response.setHeader("Content-Type", "application/json; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename=deck-check-backup-${stamp}.json`);
    response.send(JSON.stringify(store.export(), null, 2));
  });

  return router;
}
