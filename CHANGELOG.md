# Changelog

## 0.1.0-beta.1 — 2026-11-24

First public beta.

### Added
- English (default), Portuguese and Spanish UI with a language switcher in the navbar; the choice is stored in the browser. PDF reports honor the language.
- Deck check redesigned for speed: grid of large card images, tap to mark, −/+ counters, previous/next player, no side list, and the app bar, tab bar and action bar always visible on phone and desktop.
- Compact penalty report PDF (ten penalties per page).
- Login throttling: ten failed attempts lock an account or tournament code for 15 minutes.

### Changed
- Single card catalog backed by TCGdex (exact lookup by set code and number, category-aware search, Portuguese and English artwork). Fixes Trainer cards resolving to Pokémon with the same name.
- API reorganized into modules (`auth`, `routes`, `catalog`, `decks`, `reports`, `store`); React code organized by feature.
- API errors and deck warnings carry stable codes that the client translates.
- CI runs build, tests and lint; the home-server deploy job was removed.

### Fixed
- Player update endpoint returned 500 or stored invalid data for malformed bodies.
- Build failed on a fresh clone after `.openai/hosting.json` was untracked.

### Known limitations
See the README.
