import { parseIcs, type IcsEvent } from "@/lib/ics";

// Fetches and parses a subscribed .ics calendar on the server (browsers can't
// fetch Google Calendar feeds directly because of CORS).

interface Body {
  url: string;
  tz: string; // the browser's IANA timezone
  from: string; // YYYY-MM-DD
  to: string;
}

export interface FeedResponse {
  ok: boolean;
  name?: string | null;
  events?: IcsEvent[];
  error?: string;
}

const MAX_BYTES = 5_000_000;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Accept only public https URLs. webcal:// links are rewritten to https://. */
function normalizeFeedUrl(raw: string): URL | null {
  let u: URL;
  try {
    u = new URL(raw.trim().replace(/^webcals?:\/\//i, "https://"));
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const h = u.hostname.toLowerCase();
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal")) return null;
  // Block IP literals in private/loopback/link-local ranges.
  if (/^(127\.|10\.|192\.168\.|169\.254\.|0\.)/.test(h) || /^172\.(1[6-9]|2\d|3[01])\./.test(h) || h.startsWith("[")) return null;
  return u;
}

const json = (body: FeedResponse, status = 200) => Response.json(body, { status });

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: "Bad request." }, 400);
  }
  const url = normalizeFeedUrl(body.url ?? "");
  if (!url) return json({ ok: false, error: "That doesn't look like a public calendar link (it should start with https:// or webcal://)." }, 400);
  if (!DAY.test(body.from ?? "") || !DAY.test(body.to ?? "")) return json({ ok: false, error: "Bad request." }, 400);
  let tz = "UTC";
  try {
    tz = new Intl.DateTimeFormat("en-US", { timeZone: body.tz }).resolvedOptions().timeZone;
  } catch {}

  let text: string;
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { Accept: "text/calendar, */*" } });
    if (!res.ok) {
      return json({ ok: false, error: res.status === 404 ? "Calendar not found — is it public?" : `The calendar server returned ${res.status}.` }, 502);
    }
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) return json({ ok: false, error: "That calendar is too large." }, 413);
    text = await res.text();
    if (text.length > MAX_BYTES) return json({ ok: false, error: "That calendar is too large." }, 413);
  } catch {
    return json({ ok: false, error: "Couldn't reach that calendar." }, 502);
  }
  if (!text.includes("BEGIN:VCALENDAR")) return json({ ok: false, error: "That link isn't an iCal calendar feed." }, 422);

  const { name, events } = parseIcs(text, tz, body.from, body.to);
  return json({ ok: true, name, events });
}
