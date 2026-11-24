import { createHash, createHmac, randomBytes } from "node:crypto";
import { safeEqual } from "./passwords.mjs";

const COOKIE_NAME = "deckcheck_auth";
const SESSION_DAYS = 14;
const SESSION_SECONDS = SESSION_DAYS * 24 * 60 * 60;

export function createSessions({ bootstrapPassword, secureCookies }) {
  const secret = createHash("sha256").update(`deckcheck:v3:${bootstrapPassword}`).digest();

  function sign(payload) {
    return createHmac("sha256", secret).update(payload).digest("base64url");
  }

  function makeToken(role, userId) {
    const payload = Buffer.from(JSON.stringify({
      role,
      userId,
      expires: Date.now() + SESSION_SECONDS * 1000,
      nonce: randomBytes(8).toString("hex"),
    })).toString("base64url");
    return `${payload}.${sign(payload)}`;
  }

  function readToken(request) {
    const raw = readCookie(request, COOKIE_NAME);
    const [payload, signature] = raw.split(".");
    if (!payload || !signature || !safeEqual(signature, sign(payload))) return null;
    try {
      const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
      const validRole = ["judge", "player"].includes(decoded.role);
      return decoded.userId && validRole && Number(decoded.expires) >= Date.now() ? decoded : null;
    } catch {
      return null;
    }
  }

  function cookie(value, maxAge) {
    const flags = [`${COOKIE_NAME}=${value}`, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${maxAge}`];
    if (secureCookies) flags.push("Secure");
    return flags.join("; ");
  }

  return {
    readToken,
    start(response, role, userId) {
      response.setHeader("Set-Cookie", cookie(encodeURIComponent(makeToken(role, userId)), SESSION_SECONDS));
    },
    end(response) {
      response.setHeader("Set-Cookie", cookie("", 0));
    },
  };
}

function readCookie(request, name) {
  for (const entry of String(request.headers.cookie || "").split(";")) {
    const [key, ...value] = entry.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return "";
}
