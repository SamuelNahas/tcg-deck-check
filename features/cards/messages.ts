import type { Messages } from "@/lib/i18n";

export const cardsMessages: { en: Messages; pt: Messages; es: Messages } = {
  en: {
    "cards.artwork.notFoundFor": "Image not found for {name}",
    "cards.artwork.notFound": "Image not found",
    "cards.artwork.alt": "Card {name}",
    "cards.artwork.open": "Open image of {name}",
    "cards.deckImage.trigger": "View as image",
    "cards.deckImage.title": "Decklist as images",
    "cards.deckImage.summary": "{player} · {total} cards · {prints} distinct printings",
    "cards.deckImage.cardCount": "{count} cards",
  },
  pt: {
    "cards.artwork.notFoundFor": "Imagem não encontrada para {name}",
    "cards.artwork.notFound": "Imagem não encontrada",
    "cards.artwork.alt": "Carta {name}",
    "cards.artwork.open": "Abrir imagem de {name}",
    "cards.deckImage.trigger": "Ver como imagem",
    "cards.deckImage.title": "Decklist em imagens",
    "cards.deckImage.summary": "{player} · {total} cartas · {prints} impressões distintas",
    "cards.deckImage.cardCount": "{count} cartas",
  },
  es: {
    "cards.artwork.notFoundFor": "Imagen no encontrada para {name}",
    "cards.artwork.notFound": "Imagen no encontrada",
    "cards.artwork.alt": "Carta {name}",
    "cards.artwork.open": "Abrir imagen de {name}",
    "cards.deckImage.trigger": "Ver como imagen",
    "cards.deckImage.title": "Decklist en imágenes",
    "cards.deckImage.summary": "{player} · {total} cartas · {prints} impresiones distintas",
    "cards.deckImage.cardCount": "{count} cartas",
  },
};
