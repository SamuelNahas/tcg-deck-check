import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

export function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left));
  const rightBuffer = Buffer.from(String(right));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 32).toString("hex");
  return `scrypt$${salt}$${digest}`;
}

export function verifyPassword(password, stored = "") {
  const [algorithm, salt, digest] = String(stored).split("$");
  if (algorithm !== "scrypt" || !salt || !digest) return false;
  return safeEqual(scryptSync(password, salt, 32).toString("hex"), digest);
}
