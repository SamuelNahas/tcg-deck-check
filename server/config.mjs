export function loadConfig(env = process.env) {
  const bootstrapPassword = env.DECKCHECK_APP_PASSWORD;
  if (!bootstrapPassword || bootstrapPassword.length < 8) {
    throw new Error("Defina DECKCHECK_APP_PASSWORD com pelo menos 8 caracteres.");
  }
  return {
    port: Number(env.DECKCHECK_API_PORT || 3001),
    databasePath: env.DECKCHECK_DB_PATH || "/data/deckcheck.sqlite",
    secureCookies: env.DECKCHECK_SECURE_COOKIES === "true",
    bootstrapPassword,
  };
}
