import { requireAuth } from "@/lib/auth";
import { MoodleError, fetchFile, getActionEvents, getContents, getCourses, getSiteInfo, moodleConfig, type MoodleActionEvent, type MoodleModule } from "@/lib/school/moodle";
import { summaryItems, unitChapterItems, unitChapters, type UnitSection } from "@/lib/school/units";
import {
  extractHomework,
  htmlToText,
  parseDatePair,
  parseLine,
  assessmentType,
  extractAssessments,
  type ParsedLine,
  schoolYearStartFrom,
  shortCourseName,
  splitItem,
  type Chapter,
  type DayIndex,
} from "@/lib/school/parse";
import type { SchoolCourse, SchoolItem, SchoolSyncResponse } from "@/lib/school/types";

const json = (body: SchoolSyncResponse, status = 200) => Response.json(body, { status });

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const addDays = (key: string, n: number) => {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d + n);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
};

/** GET: is the school connection configured, and does the key work? */
export async function GET(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  try {
    moodleConfig();
    const info = await getSiteInfo();
    return json({ ok: true, student: info.fullname, courses: [], items: [] });
  } catch (e) {
    return errorResponse(e);
  }
}

interface Body {
  today: string; // the browser's local date
  tz?: string; // the browser's timezone, for assignment due times
  days?: Record<string, DayIndex>; // per course: which date of the A/B pair is your class
}

/** POST: read every class's "Lesson Plans & Homework" book and return upcoming homework. */
export async function POST(req: Request) {
  const denied = requireAuth(req);
  if (denied) return denied;
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return json({ ok: false, error: "bad_request", courses: [], items: [] }, 400);
  }
  if (!DAY.test(body.today ?? "")) return json({ ok: false, error: "bad_request", courses: [], items: [] }, 400);
  const today = body.today;
  const windowStart = addDays(today, -7); // look back a week for homework still due
  const windowEnd = addDays(today, 21);

  try {
    const info = await getSiteInfo();
    const enrolled = (await getCourses(info.userid)).filter((c) => c.visible !== 0);
    let tz = "America/Los_Angeles";
    try {
      if (body.tz) tz = new Intl.DateTimeFormat("en-US", { timeZone: body.tz }).resolvedOptions().timeZone;
    } catch {}
    // Assignment deadlines Moodle tracks (best effort: some schools hide this).
    const eventsByCourse = new Map<number, MoodleActionEvent[]>();
    try {
      const [y, mo, d] = today.split("-").map(Number);
      const from = Math.floor(Date.UTC(y, mo - 1, d) / 1000) - 86400;
      for (const e of await getActionEvents(from, from + 86400 * 62)) {
        if (!e.course?.id) continue;
        eventsByCourse.set(e.course.id, [...(eventsByCourse.get(e.course.id) ?? []), e]);
      }
    } catch (e) {
      console.warn("Moodle action events unavailable", e instanceof Error ? e.message : e);
    }
    const courses: SchoolCourse[] = [];
    const items: SchoolItem[] = [];

    await Promise.all(
      enrolled.map(async (course) => {
        const sections = await getContents(course.id);
        const hwSection = sections.find((s) => /lesson\s*plans?|homework/i.test(s.name));
        const books = (hwSection?.modules ?? []).filter(
          (m) => m.modname === "book" && m.visible !== 0 && m.uservisible !== false,
        );
        const name = shortCourseName(course.fullname);
        const units = unitChapters(sections as unknown as UnitSection[], schoolYearStartFrom(books[0]?.name ?? "", today));
        const entry: SchoolCourse = { id: course.id, name, fullname: htmlToText(course.fullname), hasHomework: books.length > 0 || units.length > 0, sampleDates: [] };
        courses.push(entry);
        const day: DayIndex = body.days?.[String(course.id)] === 1 ? 1 : 0;

        const courseItems: Ranked[] = [];
        for (const book of books) {
          const found = await readBook(book, course.id, name, day, today, windowStart, windowEnd);
          courseItems.push(...found.items);
          const recent = found.sampleDates;
          if (recent.length && (!entry.sampleDates.length || recent[0] > entry.sampleDates[0])) entry.sampleDates = recent;
        }

        // Unit tabs ("Ch. 6"): date headings, homework notes, assignments with due dates.
        const base = process.env.MOODLE_URL?.replace(/\/+$/, "");
        const sy = schoolYearStartFrom(books[0]?.name ?? "", today);
        units.forEach((c, i) => {
          const meeting = c.dates[day] ?? c.dates[0];
          if (meeting < windowStart || meeting > windowEnd) return;
          for (const r of unitChapterItems(units, i, day, sy)) {
            const it = toRanked(r, meeting, course.id, name, `${base}/course/view.php?id=${course.id}&section=${c.sectionNumber}`, today);
            if (it) courseItems.push(it);
          }
        });

        // Tab intro text: exam schedules like "Dec. 2: Ch. 6 Test" or "Unit 3 Part 1 Exam Dec 7 - …".
        if (entry.hasHomework) {
          const schedEnd = addDays(today, 60);
          for (const sec of sections) {
            if (!sec.summary) continue;
            for (const r of summaryItems(sec.summary, sy, day)) {
              if (!r.dueDate || r.dueDate > schedEnd) continue;
              const it = toRanked(r, today, course.id, name, `${base}/course/view.php?id=${course.id}&section=${sec.section}`, today);
              if (it) courseItems.push(it);
            }
          }
        }

        // Moodle assignment deadlines for this class, unless the lesson plans already have them.
        if (entry.hasHomework) {
          for (const e of eventsByCourse.get(course.id) ?? []) {
            const it = eventItem(e, course.id, name, tz, today);
            if (it && !courseItems.some((x) => similarTitle(x.title, it.title) && near(x.dueDate, it.dueDate))) courseItems.push(it);
          }
        }
        items.push(...dedupe(courseItems));
      }),
    );

    courses.sort((a, b) => Number(b.hasHomework) - Number(a.hasHomework) || a.name.localeCompare(b.name));
    items.sort((a, b) => (a.dueDate ?? "9").localeCompare(b.dueDate ?? "9"));
    return json({ ok: true, student: info.fullname, courses, items, syncedAt: new Date().toISOString() });
  } catch (e) {
    return errorResponse(e);
  }
}

async function readBook(
  book: MoodleModule,
  courseId: number,
  courseName: string,
  day: DayIndex,
  today: string,
  windowStart: string,
  windowEnd: string,
) {
  const files = book.contents ?? [];
  const syStart = schoolYearStartFrom(book.name, today);

  // Chapter files are listed in book order; their `content` field is the chapter title.
  const chapterFiles = files.filter((f) => f.type === "file" && f.filename === "index.html" && f.fileurl);
  const chapters: (Chapter & { fileurl: string })[] = chapterFiles
    .map((f) => ({
      id: (f.filepath ?? "").replace(/\//g, "") || f.fileurl!,
      title: f.content ?? "",
      dates: parseDatePair(f.content ?? "", syStart),
      fileurl: f.fileurl!,
    }))
    .filter((c) => c.dates.length > 0);

  const items: Ranked[] = [];
  const meetingDate = (c: Chapter) => c.dates[day] ?? c.dates[0];
  const inWindow = chapters
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => meetingDate(c) >= windowStart && meetingDate(c) <= windowEnd);

  // The most recent meeting at or before today, to show which date pair you're on.
  const recent = [...chapters].reverse().find((c) => c.dates[0] <= today);
  const base = process.env.MOODLE_URL?.replace(/\/+$/, "");

  await Promise.all(
    inWindow.map(async ({ c, i }) => {
      const text = htmlToText(await fetchFile(c.fileurl));
      const ctx = { chapterIndex: i, chapters, day, schoolYearStart: syStart };
      const add = (r: ParsedLine) => {
        // Skip work that was already due before today, and undated items from old meetings.
        if (r.dueDate && r.dueDate < today) return;
        if (!r.dueDate && meetingDate(c) < addDays(today, -1)) return;
        if (r.kind === "deadline" && !r.dueDate) return; // a test without a date isn't useful
        items.push({
          key: r.key,
          rank: r.rank ?? 1,
          externalId: "",
          courseId,
          courseName,
          title: r.title,
          dueDate: r.dueDate,
          dueTime: r.dueTime,
          assignedDate: meetingDate(c),
          kind: r.kind,
          priority: r.priority,
          sourceUrl: `${base}/mod/book/view.php?id=${book.id}&chapterid=${c.id}`,
        });
      };
      // Homework lines, then tests/quizzes mentioned anywhere else in the lesson plan.
      for (const line of extractHomework(text)) for (const part of splitItem(line)) parseLine(part, ctx).forEach(add);
      extractAssessments(text, ctx).forEach(add);
    }),
  );
  return { items, sampleDates: recent?.dates ?? [] };
}

/** Shared filter + shape for one parsed item. */
function toRanked(r: ParsedLine, meeting: string, courseId: number, courseName: string, sourceUrl: string, today: string): Ranked | null {
  if (r.dueDate && r.dueDate < today) return null;
  if (!r.dueDate && meeting < addDays(today, -1)) return null;
  if (r.kind === "deadline" && !r.dueDate) return null;
  return {
    key: r.key,
    rank: r.rank ?? 1,
    externalId: "",
    courseId,
    courseName,
    title: r.title,
    dueDate: r.dueDate,
    dueTime: r.dueTime,
    assignedDate: meeting,
    kind: r.kind,
    priority: r.priority,
    sourceUrl,
  };
}

/** A Moodle "X is due" deadline → item, with the due date/time in the student's timezone. */
function eventItem(e: MoodleActionEvent, courseId: number, courseName: string, tz: string, today: string): Ranked | null {
  const raw = htmlToText(e.name).replace(/\s+is due$/i, "").trim();
  if (!raw) return null;
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(new Date(e.timesort * 1000))
      .map((p) => [p.type, p.value]),
  );
  const dueDate = `${parts.year}-${parts.month}-${parts.day}`;
  if (dueDate < today) return null;
  const time = `${parts.hour}:${parts.minute}`;
  // Tidy the name ("… - Due Nov. 19 & 20" etc.) with the homework parser, keep Moodle's exact date.
  const parsed = parseLine(raw, { chapterIndex: 0, chapters: [], day: 0, schoolYearStart: schoolYearStartFrom("", today) })[0];
  const title = (parsed?.title || raw).replace(/\s*[-–]\s*$/, "").slice(0, 140);
  const type = assessmentType(raw);
  return {
    key: `${type ? "deadline:" + type : "task:" + title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60)}`,
    rank: 2,
    externalId: "",
    courseId,
    courseName,
    title,
    dueDate,
    dueTime: time === "00:00" ? null : time,
    assignedDate: null,
    kind: type ? "deadline" : "task",
    priority: type ? "high" : "normal",
    sourceUrl: e.url ?? "",
  };
}

const words = (s: string) => new Set(s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").split(/\s+/).filter((w) => w.length > 2));
function similarTitle(a: string, b: string) {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return false;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size) >= 0.6;
}
const near = (a: string | null, b: string | null) => {
  if (!a || !b) return false;
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.abs(Date.UTC(y1, m1 - 1, d1) - Date.UTC(y2, m2 - 1, d2)) <= 3 * 86_400_000;
};

/** ISO-ish week key so a test next month doesn't collide with this month's. */
function weekKey(date: string | null) {
  if (!date) return "nodate";
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7)); // Monday of that week
  return `${dt.getFullYear()}${String(dt.getMonth() + 1).padStart(2, "0")}${String(dt.getDate()).padStart(2, "0")}`;
}

/**
 * Teachers often repeat the same homework on consecutive class days. Keep one
 * item per course + title: the one from the most recent lesson plan.
 */
type Ranked = SchoolItem & { key: string; rank: number };

/**
 * The same homework repeats across class days, and the same test is often
 * mentioned in several places (homework, activities, announcements). Keep one
 * per course: homework by title, tests by type + week. For tests, prefer the
 * most trustworthy date (that day's activities > explicit date > "next class" >
 * announcement), then the more specific name, then the newest lesson plan.
 */
function dedupe(list: Ranked[]): SchoolItem[] {
  const best = new Map<string, Ranked>();
  const better = (a: Ranked, b: Ranked) =>
    a.rank !== b.rank ? a.rank > b.rank : a.title.length !== b.title.length ? a.title.length > b.title.length : (a.assignedDate ?? "") > (b.assignedDate ?? "");
  for (const it of list) {
    const k = it.kind === "deadline" ? `${it.key}:${weekKey(it.dueDate)}` : it.key;
    const prev = best.get(k);
    if (!prev || (it.kind === "deadline" ? better(it, prev) : (it.assignedDate ?? "") > (prev.assignedDate ?? ""))) best.set(k, it);
  }
  return [...best.entries()].map(([k, it]) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { key, rank, ...rest } = it;
    return { ...rest, externalId: `vcs:${it.courseId}:${k}` };
  });
}

function errorResponse(e: unknown) {
  if (e instanceof MoodleError) {
    const status = e.code === "not_configured" ? 503 : e.code === "bad_token" ? 401 : 502;
    return json({ ok: false, error: e.code, message: e.message, courses: [], items: [] }, status);
  }
  console.error("school sync failed", e);
  return json({ ok: false, error: "api", message: "School sync failed unexpectedly.", courses: [], items: [] }, 500);
}
