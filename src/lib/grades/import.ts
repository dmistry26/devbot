// Turns the payload sent by the PowerSchool bookmark into a GradesSnapshot.
// The payload arrives in the URL fragment, so treat it as untrusted: validate
// shapes, cap sizes, and keep only plain strings and numbers.
//
// Payload (v1): { v: 1, terms: string[], classes: [{ n: name, t: teacher, g: [[term, letter, percent]] }] }
// Self-contained (no app imports) so it can be tested with node directly.

export interface ImportedGrade {
  term: string;
  letter: string | null;
  percent: number | null;
}

export interface ImportedClass {
  name: string;
  teacher: string | null;
  grades: ImportedGrade[];
  current: ImportedGrade | null;
  courseId: number | null;
}

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const s = v.replace(/\s+/g, " ").trim().slice(0, max);
  return s || null;
};

const pct = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) && n >= 0 && n <= 150 ? Math.round(n * 100) / 100 : null;
};

export function decodePayload(fragment: string): unknown {
  const m = fragment.match(/(?:^|[#&])grades=([^&]+)/);
  if (!m) return null;
  try {
    const b64 = decodeURIComponent(m[1]).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(b64);
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    return null;
  }
}

export function parsePayload(raw: unknown): { terms: string[]; classes: Omit<ImportedClass, "courseId">[] } | null {
  if (!raw || typeof raw !== "object") return null;
  const p = raw as { v?: unknown; terms?: unknown; classes?: unknown };
  if (p.v !== 1 || !Array.isArray(p.classes)) return null;
  const terms = (Array.isArray(p.terms) ? p.terms : []).map((t) => str(t, 12)).filter((t): t is string => !!t).slice(0, 16);
  const classes = p.classes.slice(0, 30).flatMap((c) => {
    if (!c || typeof c !== "object") return [];
    const o = c as { n?: unknown; t?: unknown; g?: unknown };
    const name = str(o.n, 120);
    if (!name) return [];
    const grades = (Array.isArray(o.g) ? o.g : []).slice(0, 16).flatMap((g) => {
      if (!Array.isArray(g)) return [];
      const term = str(g[0], 12);
      if (!term) return [];
      const letter = str(g[1], 4);
      const percent = pct(g[2]);
      return letter || percent !== null ? [{ term, letter, percent }] : [];
    });
    // Current = the right-most term (in table order) that has a grade, preferring quarters over semesters.
    const order = (t: string) => (terms.indexOf(t) < 0 ? 99 : terms.indexOf(t));
    const sorted = [...grades].sort((a, b) => order(a.term) - order(b.term));
    const quarters = sorted.filter((g) => /^[QT]\d/i.test(g.term));
    const current = (quarters.length ? quarters : sorted).at(-1) ?? null;
    return [{ name, teacher: str(o.t, 80), grades: sorted, current }];
  });
  return classes.length ? { terms, classes } : null;
}

const STOP = new Set(["ap", "honors", "hon", "h", "the", "and", "of", "advanced", "placement", "course", "hs"]);
const tokens = (s: string) =>
  new Set(
    s
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/united states|u\.s\./g, "us")
      .replace(/\bcomposition\b/g, "comp")
      .replace(/\bmathematics\b/g, "math")
      .replace(/[^a-z0-9 ]+/g, " ")
      .split(/\s+/)
      .filter((w) => w && !STOP.has(w)),
  );

/** Match a PowerSchool course name to a learn.vcs.net course by word overlap. */
export function matchCourse(name: string, courses: { id: number; name: string }[]): number | null {
  const a = tokens(name);
  let best: { id: number; score: number } | null = null;
  for (const c of courses) {
    const b = tokens(c.name);
    if (!a.size || !b.size) continue;
    let inter = 0;
    for (const w of a) if (b.has(w)) inter++;
    // Prefix matches help with abbreviations ("Calc" ~ "Calculus", "Lang" ~ "Language").
    for (const w of a) if (!b.has(w) && w.length >= 3 && [...b].some((x) => x.startsWith(w) || w.startsWith(x))) inter += 0.8;
    const score = inter / Math.max(a.size, b.size);
    if (score >= 0.5 && (!best || score > best.score)) best = { id: c.id, score };
  }
  return best?.id ?? null;
}
