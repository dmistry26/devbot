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

const ORD = "(?:st|nd|rd|th)?";
// month day[ord] [/ [month] day[ord]]  — captures: 1 month, 2 day, 3 month2?, 4 day2?
const DATE_SRC = `${MONTH_RE}\\s+(\\d{1,2})${ORD}(?:\\s*[/&-]\\s*(?:${MONTH_RE}\\s+)?(\\d{1,2})${ORD})?\\b`;
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
  const re = new RegExp(DATE_SRC, "i");
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

export interface LineContext {
  chapterIndex: number;
  chapters: Chapter[];
  day: DayIndex;
  schoolYearStart: number;
}

export interface ParsedLine extends ParsedItem {
  dueTime: string | null;
  /** Normalized key used to dedupe the same item across chapters. */
  key: string;
}

const NOUN = /\b((?:unit|chapter|ch\.?|module)\s*\d+\s+)?(group quiz|quiz|unit test|test|exam|midterm|final exam)\b/i;
const PREP = /^(study|review|work on|prepare|prep|practice|make|finish) /i;
const ACTION = /^(complete|do|read|watch|study|finish|work|write|review|practice|prepare|submit|turn in|bring|take|answer|annotate|research|print|sign|memorize|listen|finalize|draft|revise|edit|create|make|present|be ready|look|fill|upload|post|reflect|solve|translate|journal)\b/i;
const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const WEEKDAY_RE = /\b(?:on|by|this|next)?\s*(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/i;
const TIME_RE = /\b(?:due\s*(?:by|at)?\s*)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i;

function addDaysKey(key: string, n: number) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`;
}

function nextWeekday(fromKey: string, weekday: string): string {
  const [y, m, d] = fromKey.split("-").map(Number);
  const from = new Date(y, m - 1, d).getDay();
  const target = WEEKDAYS.indexOf(weekday.toLowerCase());
  const diff = ((target - from + 7) % 7) || 7;
  return addDaysKey(fromKey, diff);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);

function cap(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Remove date/time phrases and tidy up a title. */
function cleanTitle(raw: string): string {
  let t = raw
    .replace(/\(should not[^)]*\)/gi, "")
    .replace(new RegExp(`[,;(]?\\s*(?:(?:due|by|on|is|which is)\\s+)*(?:(?:sun|mon|tues?|wed(?:nes)?|thu(?:rs)?|fri|sat(?:ur)?)(?:day)?,?\\s+)?${DATE_SRC}\\)?`, "gi"), "")
    .replace(/\s*\b(?:due\s*)?(?:on|by|in class on)?\s*(?:this\s+|next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)\b/gi, "")
    .replace(TIME_RE, "")
    .replace(/\s*\bnext\s+next\s+class\b/gi, "")
    .replace(/\s*\b(next|following)\s+class\b/gi, "")
    .replace(/[,;]?\s*\b(here|link)\b\.?\s*$/i, "")
    .replace(/\s{2,}/g, " ");
  // Drop trailing fragments like "Test is" left after removing a date.
  const sentences = t.split(/(?<=[.!?])\s+|[!?]{2,}\s*/).map((x) => x.trim()).filter(Boolean);
  while (sentences.length > 1 && sentences[sentences.length - 1].split(/\s+/).length <= 3) sentences.pop();
  t = sentences.join(" ");
  t = t.replace(/\b(which is|which|is|on|by|due|for|the)\s*[.!,;:]*\s*$/i, "");
  t = t.replace(/^[\s,;:\-–]+|[\s,;:.\-–]+$/g, "").replace(/\s+([.,;:!?])/g, "$1").replace(/!+$/, "").trim();
  if (t.length > 140) t = t.slice(0, 137) + "…";
  return cap(t);
}

/**
 * Turn one homework line into 0–2 items:
 *  - "None!" / links / sub-notes → nothing
 *  - "Study for test which is Nov 19/20" → prep task + "Test" deadline
 *  - "Reminder that our Unit 4 test will take place on Wednesday, December 3rd." → "Unit 4 test" deadline only
 *  - "WebAssign HW 6.1" → task due next class
 */
export function parseLine(line: string, ctx: LineContext): ParsedLine[] {
  const { chapterIndex, chapters, day, schoolYearStart } = ctx;
  const text = line.trim();
  if (!text || /^(none|no homework|no hw|n\/a)\b/i.test(text) || /^here (is|are)\b/i.test(text)) return [];

  const meeting = (c: Chapter | undefined) => (c ? (c.dates[day] ?? c.dates[0] ?? null) : null);
  const assigned = meeting(chapters[chapterIndex]);
  const noun = text.match(NOUN);
  const announcement = text.length > 140 || /^(reminder|note|fyi|because|remember|just a reminder)\b/i.test(text);

  // Find the due date. In long announcements the test date is usually the last date mentioned.
  let explicit: string[] = [];
  if (announcement) {
    const all = [...text.matchAll(new RegExp(DATE_SRC, "gi"))];
    if (all.length) explicit = parseDatePair(all[all.length - 1][0], schoolYearStart);
  } else {
    const after = noun ? text.slice((noun.index ?? 0) + noun[0].length) : text;
    explicit = parseDatePair(after, schoolYearStart);
    if (!explicit.length) explicit = parseDatePair(text, schoolYearStart);
  }
  let dueDate: string | null = null;
  let stated = true; // false when we only assumed "due next class"
  if (explicit.length) dueDate = explicit[day] ?? explicit[0];
  else if (WEEKDAY_RE.test(text) && assigned) dueDate = nextWeekday(assigned, text.match(WEEKDAY_RE)![1]);
  else if (/\bnext\s+next\s+class\b/i.test(text)) dueDate = meeting(chapters[chapterIndex + 2]);
  else if (/\b(next|following)\s+class\b/i.test(text)) dueDate = meeting(chapters[chapterIndex + 1]);
  else {
    stated = false;
    if (!announcement) dueDate = meeting(chapters[chapterIndex + 1]); // default: due next meeting
  }

  const tm = text.match(TIME_RE);
  const dueTime = tm
    ? `${pad((Number(tm[1]) % 12) + (tm[3].toLowerCase() === "pm" ? 12 : 0))}:${tm[2] ?? "00"}`
    : null;

  const deadline = (): ParsedLine | null => {
    if (!noun) return null;
    const unitAfter = !noun[1] ? text.slice((noun.index ?? 0) + noun[0].length).match(/^\s*(?:for|on)\s+((?:unit|chapter|ch\.?|module)\s*\d+)/i) : null;
    const prefix = noun[1] ?? (unitAfter ? unitAfter[1] + " " : "");
    const title = cap(`${prefix}${noun[2]}`.replace(/\s+/g, " ").trim().toLowerCase());
    return { title, dueDate, dueTime: null, kind: "deadline", priority: "high", key: `deadline:${slug(title)}` };
  };

  if (announcement) {
    const d = deadline();
    return d && dueDate ? [d] : [];
  }

  const title = cleanTitle(text);
  if (!title) return [];
  // Short phrases without an action verb are usually notes ("Assumptions & Conditions").
  const words = title.split(/\s+/).length;
  if (!noun && words <= 6 && !ACTION.test(title) && !/\d/.test(title) && !/\b(hw|homework|assignment|worksheet|project|essay|reading|webassign|zybooks|achieve)\b/i.test(title)) {
    return [];
  }

  if (noun && (PREP.test(text) || ACTION.test(text))) {
    // Work toward a test is a task; add the test itself only when its date is actually stated.
    const prep: ParsedLine = { title, dueDate, dueTime, kind: "task", priority: "high", key: `task:${slug(title)}` };
    const d = deadline();
    return d && dueDate && stated ? [prep, d] : [prep];
  }
  if (noun && title.split(/\s+/).length <= 3) {
    const d = deadline();
    return d ? [d] : [];
  }
  return [{ title, dueDate, dueTime, kind: noun ? "deadline" : "task", priority: noun ? "high" : "normal", key: `${noun ? "deadline" : "task"}:${slug(title)}` }];
}

/** Split "Study for group quiz next class, test next next class" into separate items. */
export function splitItem(item: string): string[] {
  if (item.length > 140) return [item]; // announcements are handled as a whole
  const parts = item.split(/\s*[;,]\s*(?=(?:\w+\s+){0,3}?(?:quiz|test|exam|midterm|final)\b)/i);
  return parts.map((p) => p.trim()).filter((p) => p.length > 1);
}

/** "AP Calculus BC - Mr. Nie" → "AP Calculus BC" */
export function shortCourseName(fullname: string) {
  return htmlToText(fullname).replace(/\s+[-–—]\s+(mr|mrs|ms|miss|dr|prof|coach|sr|señor|senor)\.?\s.*$/i, "").trim();
}
