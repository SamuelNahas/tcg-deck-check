export const normalizePlayId = (value) => String(value || "").replace(/[^0-9]/g, "");
export const normalizeLogin = (value) => String(value || "").trim().toLocaleLowerCase("en-US");
export const normalizeAccessCode = (value) => String(value || "").replace(/[^a-z0-9]/gi, "").toUpperCase();
