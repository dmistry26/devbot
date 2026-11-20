// Simple single-password lock for a personal deployment.
//
// - Set DEVBOT_PASSWORD on the server. Unset = no lock (fine on your own Mac).
// - In production with no password set, everything is blocked rather than left open.
// - After unlocking, the browser keeps an httpOnly cookie holding an HMAC of the
//   password, so changing the password signs every device out.
import { createHash, createHmac, timingSafeEqual } from "node:crypto";

export const AUTH_COOKIE = "devbot_auth";
export const AUTH_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

const password = () => process.env.DEVBOT_PASSWORD ?? "";

/** True when the app is deployed without a password: refuse to serve rather than run open. */
export const isMisconfigured = () => process.env.NODE_ENV === "production" && !password();

export const lockEnabled = () => !!password();

export function sessionToken(): string {
  return createHmac("sha256", password()).update("devbot-session-v1").digest("base64url");
}

const digest = (s: string) => createHash("sha256").update(s).digest();

export function checkPassword(input: string): boolean {
  if (!lockEnabled()) return false;
  return timingSafeEqual(digest(input), digest(password()));
}

export function isAuthed(cookieValue: string | undefined): boolean {
  if (isMisconfigured()) return false;
  if (!lockEnabled()) return true;
  if (!cookieValue) return false;
  const a = digest(cookieValue);
  const b = digest(sessionToken());
  return timingSafeEqual(a, b);
}

function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

/** For API routes: returns a 401 response if the request isn't unlocked, else null. */
export function requireAuth(req: Request): Response | null {
  if (isAuthed(readCookie(req, AUTH_COOKIE))) return null;
  return Response.json(
    { ok: false, error: isMisconfigured() ? "devbot is locked: set DEVBOT_PASSWORD on the server." : "Locked. Enter your devbot password." },
    { status: 401 },
  );
}
