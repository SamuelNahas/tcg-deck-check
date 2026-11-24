import { createApp } from "./app.mjs";
import { hashPassword } from "./auth/passwords.mjs";
import { loadConfig } from "./config.mjs";
import { createStore } from "./store/db.mjs";

const config = loadConfig();
const store = createStore(config.databasePath);
store.ensureAdmin(hashPassword(config.bootstrapPassword));

const server = createApp({ config, store }).listen(config.port, "0.0.0.0", () => {
  console.log(`Deck Check API pronta na porta ${config.port}`);
});

function shutdown() {
  server.close(() => {
    store.close();
    process.exit(0);
  });
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
