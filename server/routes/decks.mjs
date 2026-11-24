import { Router } from "express";
import multer from "multer";
import { buildDeckFromItems, parseDeckText, splitPastedDecks } from "../decks/parser.mjs";
import { extractDeckText } from "../decks/extract.mjs";
import { validateBasicPokemon } from "../decks/validation.mjs";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024, files: 30 },
});

export function decksRoutes({ store, requireRole, getTournamentOr404, playerCanUseTournament, deadlinePassed }) {
  const router = Router();

  router.post("/tournaments/:tournamentId/player/parse", requireRole("player"), async (request, response, next) => {
    try {
      const access = playerCanUseTournament(request, response);
      if (!access) return;
      if (access.registration.submission_locked) return response.status(409).json({ error: "Esta lista já foi enviada e está bloqueada.", code: "deck_locked" });
      if (deadlinePassed(access.tournament)) return response.status(409).json({ error: "O prazo para envio da decklist terminou.", code: "deck_deadline_passed" });
      const text = String(request.body?.text || "").trim();
      if (!text) return response.status(400).json({ error: "Cole a lista exportada pelo Pokémon TCG Live.", code: "deck_text_required" });
      const deck = await validateBasicPokemon(parseDeckText(text, {
        fallbackName: request.auth.user.name,
        sourceName: "Importação do Pokémon TCG Live",
      }));
      response.json({ deck: { ...deck, playerName: request.auth.user.name } });
    } catch (error) {
      next(error);
    }
  });

  router.post("/tournaments/:tournamentId/deck", requireRole("player"), async (request, response, next) => {
    try {
      const access = playerCanUseTournament(request, response);
      if (!access) return;
      if (access.registration.submission_locked) return response.status(409).json({ error: "Esta lista já foi enviada e está bloqueada.", code: "deck_locked" });
      if (deadlinePassed(access.tournament)) return response.status(409).json({ error: "O prazo para envio da decklist terminou.", code: "deck_deadline_passed" });
      const built = buildDeckFromItems(request.body?.items, {
        playerName: request.auth.user.name,
        sourceName: "Envio do jogador",
      });
      const deck = await validateBasicPokemon(built);
      const critical = deck.warnings.filter((warning) => warning.severity === "critical");
      if (critical.length) {
        return response.status(400).json({ error: "A lista ainda não é válida para envio.", code: "deck_not_valid", warnings: critical });
      }
      const player = store.submitDeck(access.tournament.id, request.auth.user.id, deck);
      if (!player) return response.status(409).json({ error: "A lista já foi enviada por outra sessão.", code: "deck_already_submitted" });
      response.status(201).json({ player });
    } catch (error) {
      next(error);
    }
  });

  router.post("/tournaments/:tournamentId/parse", requireRole("judge"), upload.array("files", 30), async (request, response, next) => {
    try {
      const tournament = getTournamentOr404(request, response);
      if (!tournament) return;
      const results = [];
      const pastedText = String(request.body?.text || "").trim();
      if (pastedText) {
        for (const [index, block] of splitPastedDecks(pastedText).entries()) {
          const sourceName = `Texto colado${index ? ` ${index + 1}` : ""}`;
          results.push({
            ...await validateBasicPokemon(parseDeckText(block, { sourceName })),
            extractionMethod: "pasted-text",
          });
        }
      }
      for (const file of request.files || []) {
        try {
          const extracted = await extractDeckText(file);
          results.push({
            ...await validateBasicPokemon(parseDeckText(extracted.text, {
              fallbackName: file.originalname,
              sourceName: file.originalname,
            })),
            extractionMethod: extracted.extractionMethod,
          });
        } catch (error) {
          results.push({
            playerName: file.originalname.replace(/\.[^.]+$/, ""),
            sourceName: file.originalname,
            items: [],
            total: 0,
            warnings: [{ code: "PARSE_FAILED", severity: "critical", params: {}, message: error.message }],
            rawText: "",
            extractionMethod: "failed",
          });
        }
      }
      if (!results.length) return response.status(400).json({ error: "Cole um texto ou selecione arquivos.", code: "deck_input_required" });
      response.json({ results });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
