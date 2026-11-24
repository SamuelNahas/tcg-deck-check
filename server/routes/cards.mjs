import { Router } from "express";
import { catalog } from "../catalog/catalog.mjs";

export function cardsRoutes() {
  const router = Router();

  router.get("/cards/search", async (request, response, next) => {
    try {
      const query = String(request.query.q || "").trim();
      const category = String(request.query.category || "all");
      response.json({ cards: await catalog.searchCards(query, category) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/cards/resolve", async (request, response, next) => {
    try {
      const card = await catalog.resolveCard({
        name: String(request.query.name || ""),
        setCode: String(request.query.setCode || ""),
        collectorNumber: String(request.query.number || ""),
        category: String(request.query.category || ""),
      });
      response.json({ card });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
