// Live, read-only search of learn.vcs.net lesson plans, used by the assistant
// when the answer isn't already in the imported tasks ("do I have a math test
// coming up?"). Reads the "Lesson Plans & Homework" books on demand.
import "server-only";
import { fetchFile, getContents, getCourses, getSiteInfo, moodleConfig, MoodleError } from "./moodle";
import {
  extractAssessments,
  htmlToText,
  parseDatePair,
  schoolYearStartFrom,
  shortCourseName,
  type Chapter,
  type DayIndex,
} from "./parse";
import { matchCourse } from "@/lib/grades/import";
import { unitChapterItems, unitChapterLines, unitChapters, type UnitSection } from "./units";

export interface SearchHit {
  className: string;
  classDay: string; // the chapter's meeting date (YYYY-MM-DD)
  chapter: string; // chapter title, e.g. "December 1/3"
  line: string;
}

export interface SearchResult {
  searchedClasses: string[];
  window: { from: string; to: string };
  tests: { className: string; title: string; date: string | null }[];
  matches: SearchHit[];
  note?: string;
}

// Words that loosely name subjects, so "math" finds Calculus and Statistics.
const SUBJECT_HINTS: Record<string, RegExp> = {
  math: /calc|stat|math|algebra|geometry|precalc/i,
  science: /physics|chem|bio|science/i,
  history: /history|apush|gov|econ/i,
  english: /english|lang|lit|composition/i,
  spanish: /spanish|french|chinese|latin|language/i,
  cs: /data structures|computer|programming|cs\b/i,
  coding: /data structures|computer|programming/i,
};

const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

function pickCourses(className: string | null, courses: { id: number; name: string }[]) {
  if (!className?.trim()) return courses;
  const q = className.trim();
  const direct = matchCourse(q, courses);
  if (direct) return courses.filter((c) => c.id === direct);
  const hint = Object.entries(SUBJECT_HINTS).find(([k]) => new RegExp(`\\b${k}`, "i").test(q));
  if (hint) {
    const hit = courses.filter((c) => hint[1].test(c.name));
    if (hit.length) return hit;
  }
  const loose = courses.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));
  return loose.length ? loose : courses;
}

export async function searchLessonPlans(opts: {
  className: string | null;
  query: string | null;
  today: string;
  days: Record<string, DayIndex>;
}): Promise<SearchResult> {
  moodleConfig(); // throws a friendly error if school isn't connected
  const from = addDays(opts.today, -3);
  const to = addDays(opts.today, 60);
  const info = await getSiteInfo();
  const enrolled = (await getCourses(info.userid)).filter((c) => c.visible !== 0);
  const all = enrolled.map((c) => ({ id: c.id, name: shortCourseName(c.fullname) }));
  const chosen = pickCourses(opts.className, all);

  const words = (opts.query ?? "").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2 && !/^(test|tests|quiz|quizzes|exam|exams|the|any|coming|upcoming|have|for|when|next)$/.test(w));
  const lineRe = new RegExp(`\\b(test|quiz|exam|midterm|final${words.length ? "|" + words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|") : ""})`, "i");

  const tests: SearchResult["tests"] = [];
  const matches: SearchHit[] = [];
  const searched: string[] = [];

  await Promise.all(
    chosen.map(async (course) => {
      const sections = await getContents(course.id);
      const section = sections.find((s) => /lesson\s*plans?|homework/i.test(s.name));
      const books = (section?.modules ?? []).filter((m) => m.modname === "book" && m.visible !== 0 && m.uservisible !== false);
      const units = unitChapters(sections as unknown as UnitSection[], schoolYearStartFrom(books[0]?.name ?? "", opts.today));
      if (!books.length && !units.length) return;
      searched.push(course.name);
      const day: DayIndex = opts.days[String(course.id)] === 1 ? 1 : 0;
      // Unit tabs ("Ch. 6"): no downloads needed, the notes and assignment names are in the course listing.
      const usy = schoolYearStartFrom(books[0]?.name ?? "", opts.today);
      units.forEach((c, i) => {
        const meeting = c.dates[day] ?? c.dates[0];
        if (meeting < from || meeting > to) return;
        for (const it of unitChapterItems(units, i, day, usy)) {
          if (it.kind === "deadline" && it.dueDate && it.dueDate >= opts.today) tests.push({ className: course.name, title: it.title, date: it.dueDate });
          else if (it.dueDate && it.dueDate >= opts.today) matches.push({ className: course.name, classDay: meeting, chapter: `${c.sectionName}: ${c.title}`, line: `${it.title} (due ${it.dueDate})` });
        }
        for (const line of unitChapterLines(c)) {
          if (lineRe.test(line)) matches.push({ className: course.name, classDay: meeting, chapter: `${c.sectionName}: ${c.title}`, line });
        }
      });
      for (const book of books) {
        const sy = schoolYearStartFrom(book.name, opts.today);
        const files = (book.contents ?? []).filter((f) => f.type === "file" && f.filename === "index.html" && f.fileurl);
        const chapters: (Chapter & { fileurl: string })[] = files
          .map((f) => ({ id: (f.filepath ?? "").replace(/\//g, ""), title: f.content ?? "", dates: parseDatePair(f.content ?? "", sy), fileurl: f.fileurl! }))
          .filter((c) => c.dates.length > 0);
        const meeting = (c: Chapter) => c.dates[day] ?? c.dates[0];
        const inWindow = chapters.map((c, i) => ({ c, i })).filter(({ c }) => meeting(c) >= from && meeting(c) <= to);
        await Promise.all(
          inWindow.map(async ({ c, i }) => {
            const text = htmlToText(await fetchFile(c.fileurl));
            for (const a of extractAssessments(text, { chapterIndex: i, chapters, day, schoolYearStart: sy })) {
              if (a.dueDate && a.dueDate >= opts.today) tests.push({ className: course.name, title: a.title, date: a.dueDate });
            }
            for (const raw of text.split("\n")) {
              const line = raw.replace(/^[-•*◦▪·\s]+/, "").trim();
              if (line && line.length < 300 && lineRe.test(line)) matches.push({ className: course.name, classDay: meeting(c), chapter: c.title, line });
            }
          }),
        );
      }
    }),
  );

  // One entry per class/test/date; newest-first lines, capped so the model gets a compact answer.
  const seen = new Set<string>();
  const uniqueTests = tests
    .filter((t) => {
      const k = `${t.className}|${t.title.toLowerCase()}|${t.date}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
  matches.sort((a, b) => a.classDay.localeCompare(b.classDay));
  return {
    searchedClasses: searched.sort(),
    window: { from, to },
    tests: uniqueTests.slice(0, 20),
    matches: matches.slice(0, 40),
    note: searched.length ? undefined : "No matching class with lesson plans was found.",
  };
}

export { MoodleError };
