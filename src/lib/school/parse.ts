// Turns VCS Moodle "Lesson Plans & Homework" book chapters into homework items.
//
// Each class keeps one Book per quarter. Each chapter is one class meeting,
// titled with the A/B-day date pair, e.g. "November 19/20", and contains
// "Objectives", "Classroom Activities" and "Homework" sections. Homework is
// free text like "WebAssign HW 4.5" or "Study for group quiz next class, test
// next next class" or "Watch Adams video, take notes, Oct 15/20".
//
// Self-contained on purpose (no app imports) so it can be tested directly with node.

export type DayIndex = 0 | 1; // which date of the pair is your class day

export interface Chapter {
  id: string;
  title: string;
  dates: string[]; // YYYY-MM-DD, one or two (A/B days)
}

export interface ParsedItem {
  title: string;
  dueDate: string | null;
  kind: "task" | "deadline";
  priority: "high" | "normal";
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?";

const monthNum = (s: string) => MONTHS[s.toLowerCase().slice(0, 3)];
const pad = (n: number) => String(n).padStart(2, "0");

/** School year starts in August: Aug–Dec belong to startYear, Jan–Jul to startYear+1. */
export function yearFor(month: number, schoolYearStart: number) {
  return month >= 8 ? schoolYearStart : schoolYearStart + 1;
}

/** "Quarter 2 (2026-27)" → 2026. Falls back to the school year containing `today`. */
export function schoolYearStartFrom(bookName: string, today: string): number {
  const m = bookName.match(/(20\d\d)\s*[-–/]\s*(\d\d|20\d\d)/);
  if (m) return Number(m[1]);
  const [y, mo] = today.split("-").map(Number);
  return mo >= 8 ? y : y - 1;
}

function isValidDate(y: number, m: number, d: number) {
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

/**
 * Parse "November 19/20", "Oct 30/Nov 2", "**October 23/26**", "Dec 1".
 * Returns 1–2 dates. Handles a pair that crosses a month boundary.
 */
export function parseDatePair(text: string, schoolYearStart: number): string[] {
  const clean = text.replace(/[*_]/g, " ");
  const re = new RegExp(`${MONTH_RE}\\s+(\\d{1,2})(?:\\s*[/&,-]\\s*(?:${MONTH_RE}\\s+)?(\\d{1,2}))?`, "i");
  const m = clean.match(re);
  if (!m) return [];
  const m1 = monthNum(m[1]);
  const d1 = Number(m[2]);
  const out: string[] = [];
  const push = (mo: number, d: number) => {
    const y = yearFor(mo, schoolYearStart);
    if (isValidDate(y, mo, d)) out.push(`${y}-${pad(mo)}-${pad(d)}`);
  };
  push(m1, d1);
  if (m[4]) {
    const m2 = m[3] ? monthNum(m[3]) : d1 > Number(m[4]) ? (m1 % 12) + 1 : m1;
    push(m2, Number(m[4]));
  }
  return out;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'", rsquo: "'", lsquo: "'", ldquo: '"', rdquo: '"', ndash: "–", mdash: "—", hellip: "…" };

/** Minimal HTML → text that keeps line structure. */
export function htmlToText(html: string): string {
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|div|li|h[1-6]|tr|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (m, e: string) =>
      e.startsWith("#") && e !== "#39" ? String.fromCharCode(Number(e.slice(1))) : (ENTITIES[e.toLowerCase()] ?? m),
    )
    .replace(/[ \t ]+/g, " ")
    .split("\n")
    .map((l) => l.trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const STOP_HEADINGS = /^(objectives?|classroom activities|class activities|in class|agenda|notes?|announcements?|resources?|reminders?)\b\s*:?/i;

/** The lines under the "Homework" heading, without bullets and filler like "Complete...". */
export function extractHomework(text: string): string[] {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => /^\s*(homework|hw)\b\s*:?/i.test(l));
  if (start === -1) return [];
  const out: string[] = [];
  const firstLineRest = lines[start].replace(/^\s*(homework|hw)\b\s*:?\s*/i, "").trim();
  if (firstLineRest) out.push(firstLineRest);
  for (const raw of lines.slice(start + 1)) {
    if (STOP_HEADINGS.test(raw)) break;
    const l = raw.replace(/^[-•*◦▪\d.)\s]+/, "").trim();
    if (!l) continue;
    if (/^(complete|to do|due)\s*(\.{2,}|…|:)?$/i.test(l)) continue; // "Complete..." heading filler
    if (/^(none|no homework|n\/a)\.?!?$/i.test(l)) continue;
    out.push(l);
  }
  return out;
}

const ASSESSMENT = /\b(quiz|test|exam|midterm|final|essay due|project due|presentation|lab report due|dbq|leq|saq)\b/i;

/** Split "Study for group quiz next class, test next next class" into separate items. */
export function splitItem(item: string): string[] {
  const parts = item.split(/\s*[;,]\s*(?=(?:\w+\s+){0,3}?(?:quiz|test|exam|midterm|final)\b)/i);
  return parts.map((p) => p.trim()).filter((p) => p.split(/\s+/).length >= 1 && p.length > 1);
}

/** Resolve one homework line to a dated item. */
export function resolveItem(
  line: string,
  chapterIndex: number,
  chapters: Chapter[],
  day: DayIndex,
  schoolYearStart: number,
): ParsedItem {
  const pick = (c: Chapter | undefined) => (c ? (c.dates[day] ?? c.dates[0] ?? null) : null);
  let dueDate: string | null = null;
  let title = line;

  const explicit = parseDatePair(line, schoolYearStart);
  if (explicit.length) {
    dueDate = explicit[day] ?? explicit[0];
    title = title.replace(new RegExp(`[,;(\\s]*(?:due\\s*)?${MONTH_RE}\\s+\\d{1,2}(?:\\s*[/&,-]\\s*(?:${MONTH_RE}\\s+)?\\d{1,2})?\\)?`, "i"), "");
  } else if (/\bnext\s+next\s+class\b/i.test(line)) {
    dueDate = pick(chapters[chapterIndex + 2]);
    title = title.replace(/\s*\bnext\s+next\s+class\b/i, "");
  } else if (/\b(next|following)\s+class\b/i.test(line)) {
    dueDate = pick(chapters[chapterIndex + 1]);
    title = title.replace(/\s*\b(next|following)\s+class\b/i, "");
  } else {
    // Homework is due at the next meeting unless it says otherwise.
    dueDate = pick(chapters[chapterIndex + 1]);
  }

  title = title
    .replace(/\(should not[^)]*\)/gi, "") // teacher asides
    .replace(/\s{2,}/g, " ")
    .replace(/^[\s,;:-]+|[\s,;:-]+$/g, "")
    .trim();
  title = title.charAt(0).toUpperCase() + title.slice(1);
  if (title.length > 140) title = title.slice(0, 137) + "…";

  const isAssessment = ASSESSMENT.test(line) && !/^(read|watch|review notes)\b/i.test(line);
  return {
    title,
    dueDate,
    kind: isAssessment ? "deadline" : "task",
    priority: isAssessment ? "high" : "normal",
  };
}

/** "AP Calculus BC - Mr. Nie" → "AP Calculus BC" */
export function shortCourseName(fullname: string) {
  return fullname.replace(/\s+[-–—]\s+(mr|mrs|ms|miss|dr|prof|coach|sr|señor|senor)\.?\s.*$/i, "").trim();
}
