// Unit tabs ("Ch. 6", "Unit 3", …) are the second place VCS teachers post
// work, next to the "Lesson Plans & Homework" books. A tab is a list of
// modules: labels act as date headings ("November 17") followed by notes
// ("Homework: WebAssign 6.1"), with files and assignments in between
// ("Chapter 6 Take Home Quiz [due 12/2]").
//
// This module turns those tabs into the same chapter shape the book parser
// uses, so homework, tests and due dates are read the same way.
// Self-contained apart from parse.ts, so it can be tested with node.

import {
  assessmentTitle,
  assessmentType,
  extractAssessments,
  extractHomework,
  htmlToText,
  parseDatePair,
  parseLine,
  parseNumericDue,
  splitItem,
  type Chapter,
  type DayIndex,
  type ParsedLine,
} from "./parse.ts";

export interface UnitModule {
  id: number;
  name: string;
  modname: string;
  description?: string;
  visible?: number;
  uservisible?: boolean;
}

export interface UnitSection {
  id: number;
  name: string;
  section: number;
  summary?: string;
  modules: UnitModule[];
}

export interface UnitChapter extends Chapter {
  lines: string[];
  modules: UnitModule[];
  sectionNumber: number;
  sectionName: string;
}

const MONTH_START = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+\d/i;

/** A line that is just a date heading: "November 17", "December 1/3", "Nov 30 (A Day)". */
function isDateHeading(line: string, schoolYearStart: number): string[] | null {
  const t = line.replace(/[*_]/g, "").trim();
  if (t.length > 40 || !MONTH_START.test(t)) return null;
  // Anything after the date must be short and parenthetical-ish, not a sentence.
  const rest = t.replace(/^[a-z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*[/&-]\s*(?:[a-z]+\.?\s+)?\d{1,2}(?:st|nd|rd|th)?)?/i, "").trim();
  if (rest && !/^[(\-–—:]/.test(rest) && rest.split(/\s+/).length > 3) return null;
  const dates = parseDatePair(t, schoolYearStart);
  return dates.length ? dates : null;
}

/** Skip the general area and class-info tabs; lesson-plan books are handled separately. */
export function isUnitSection(s: UnitSection) {
  return s.section !== 0 && !/lesson\s*plans?|homework|syllabus|class info|general|resources/i.test(s.name);
}

export function unitChapters(sections: UnitSection[], schoolYearStart: number): UnitChapter[] {
  const out: UnitChapter[] = [];
  for (const section of sections.filter(isUnitSection)) {
    let current: UnitChapter | null = null;
    for (const m of section.modules) {
      if (m.visible === 0 || m.uservisible === false) continue;
      if (m.modname === "label") {
        const text = htmlToText(m.description || m.name);
        for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
          const dates = isDateHeading(line, schoolYearStart);
          if (dates) {
            current = { id: `s${section.section}-${out.length}`, title: line, dates, lines: [], modules: [], sectionNumber: section.section, sectionName: section.name };
            out.push(current);
          } else if (current) {
            current.lines.push(line);
          }
        }
      } else if (current) {
        current.modules.push(m);
      }
    }
  }
  // Book-style order: by date, so "next class" means the next heading.
  return out.sort((a, b) => a.dates[0].localeCompare(b.dates[0]));
}

/** Homework, tests and due-dated assignments from one unit-tab chapter. */
export function unitChapterItems(chapters: UnitChapter[], index: number, day: DayIndex, schoolYearStart: number): ParsedLine[] {
  const c = chapters[index];
  const ctx = { chapterIndex: index, chapters, day, schoolYearStart };
  const text = c.lines.join("\n");
  const items: ParsedLine[] = [];
  for (const line of extractHomework(text)) for (const part of splitItem(line)) items.push(...parseLine(part, ctx));
  items.push(...extractAssessments(text, ctx));

  const meeting = c.dates[day] ?? c.dates[0];
  for (const m of c.modules) {
    const name = htmlToText(m.name);
    const due = parseNumericDue(name, schoolYearStart) ?? parseDatePair(name, schoolYearStart)[day] ?? parseDatePair(name, schoolYearStart)[0] ?? null;
    if (due) {
      // Assignments and files with a due date in their name: "[due 12/2]".
      for (const r of parseLine(name, ctx)) items.push({ ...r, dueDate: r.dueDate ?? due, rank: 2 });
    } else if (m.modname === "quiz" || (m.modname === "assign" && assessmentType(name))) {
      // A Moodle quiz (or a test submission) posted under a date happens that class day.
      const type = assessmentType(name) ?? "quiz";
      items.push({ title: assessmentTitle(name, type), dueDate: meeting, dueTime: null, kind: "deadline", priority: "high", key: `deadline:${type}`, rank: 3 });
    }
  }
  return items;
}

/** All lines (notes + module names) of a chapter, for search. */
export function unitChapterLines(c: UnitChapter): string[] {
  return [...c.lines, ...c.modules.map((m) => htmlToText(m.name))];
}

const POSTING = /\b(opens|opened|posted|available|released|assigned|starts|begins)\b(?:\s+(?:by|on|in))?\s+(?:[A-Za-z]+\.?\s+\d{1,2}(?:st|nd|rd|th)?|\d{1,2}\/\d{1,2})/gi;

/**
 * Dated items from a tab's intro text (Moodle "section summary"). Teachers
 * keep exam schedules there:
 *   "Dec. 2: Ch. 6 Test"
 *   "Unit 3 Part 1 Exam Dec 7 - Study Guide posted by Nov 30, Practice Test in
 *    Achieve opens Nov 20 due Dec 7 at 8am. Turn in classwork binders Dec 3."
 * Only clauses with an explicit date count; "posted"/"opens" dates are ignored.
 */
export function summaryItems(summaryHtml: string, schoolYearStart: number, day: DayIndex): ParsedLine[] {
  const text = htmlToText(summaryHtml || "");
  const out: ParsedLine[] = [];
  const ctx = { chapterIndex: 0, chapters: [] as Chapter[], day, schoolYearStart };
  for (const line of text.split("\n").map((l) => l.trim()).filter(Boolean)) {
    if (line.length > 600) continue;
    const clauses = line
      .split(/\s+[-–—]\s+|(?<=[.!?])\s+(?=[A-Z])/)
      .flatMap((c) => c.split(/,\s+(?=[A-Z])/))
      .map((c) => c.trim())
      .filter(Boolean);
    for (const raw of clauses) {
      const clause = raw.replace(POSTING, "").replace(/\s{2,}/g, " ").trim();
      // Date: the one after "due" if there is one, else the first date in the clause.
      const dueAt = clause.search(/\bdue\b/i);
      const scope = dueAt >= 0 ? clause.slice(dueAt) : clause;
      const date =
        parseNumericDue(scope, schoolYearStart) ??
        parseDatePair(scope, schoolYearStart)[day] ??
        parseDatePair(scope, schoolYearStart)[0] ??
        null;
      if (!date) continue;
      const type = assessmentType(clause);
      if (type) {
        out.push({ title: assessmentTitle(clause.replace(/^[^:]{0,20}:\s*/, ""), type), dueDate: date, dueTime: null, kind: "deadline", priority: "high", key: `deadline:${type}`, rank: 2 });
        continue;
      }
      const parsed = parseLine(clause, ctx)[0];
      if (!parsed) continue;
      // "…Category at" (from "due Dec 7 at 8am"); a bare year like "2026" isn't an assignment.
      const title = parsed.title.replace(/\s+(?:at|by|on|in)$/i, "").trim();
      if (!/[a-z]{3}/i.test(title)) continue;
      out.push({ ...parsed, title, dueDate: date, rank: 2 });
    }
  }
  return out;
}
