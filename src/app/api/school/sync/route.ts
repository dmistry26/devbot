import { MoodleError, fetchFile, getContents, getCourses, getSiteInfo, moodleConfig, type MoodleModule } from "@/lib/school/moodle";
import {
  extractHomework,
  htmlToText,
  parseDatePair,
  resolveItem,
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
export async function GET() {
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
  days?: Record<string, DayIndex>; // per course: which date of the A/B pair is your class
}

/** POST: read every class's "Lesson Plans & Homework" book and return upcoming homework. */
export async function POST(req: Request) {
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
        const entry: SchoolCourse = { id: course.id, name, fullname: course.fullname, hasHomework: books.length > 0, sampleDates: [] };
        courses.push(entry);
        const day: DayIndex = body.days?.[String(course.id)] === 1 ? 1 : 0;

        for (const book of books) {
          const found = await readBook(book, course.id, name, day, today, windowStart, windowEnd);
          items.push(...found.items);
          if (found.sampleDates.length && !entry.sampleDates.length) entry.sampleDates = found.sampleDates;
        }
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

  const items: SchoolItem[] = [];
  const meetingDate = (c: Chapter) => c.dates[day] ?? c.dates[0];
  const inWindow = chapters
    .map((c, i) => ({ c, i }))
    .filter(({ c }) => meetingDate(c) >= windowStart && meetingDate(c) <= windowEnd);

  // The most recent meeting at or before today, to show which date pair you're on.
  const recent = [...chapters].reverse().find((c) => c.dates[0] <= today);

  await Promise.all(
    inWindow.map(async ({ c, i }) => {
      const html = await fetchFile(c.fileurl);
      const lines = extractHomework(htmlToText(html));
      let n = 0;
      for (const line of lines) {
        for (const part of splitItem(line)) {
          const r = resolveItem(part, i, chapters, day, syStart);
          const id = `vcs:${book.id}:${c.id}:${n++}`;
          if (!r.title) continue;
          // Skip work that was already due before today.
          if (r.dueDate && r.dueDate < today) continue;
          if (!r.dueDate && meetingDate(c) < addDays(today, -1)) continue;
          items.push({
            externalId: id,
            courseId,
            courseName,
            title: r.title,
            dueDate: r.dueDate,
            assignedDate: meetingDate(c),
            kind: r.kind,
            priority: r.priority,
            sourceUrl: `${process.env.MOODLE_URL?.replace(/\/+$/, "")}/mod/book/view.php?id=${book.id}&chapterid=${c.id}`,
          });
        }
      }
    }),
  );
  return { items, sampleDates: recent?.dates ?? [] };
}

function errorResponse(e: unknown) {
  if (e instanceof MoodleError) {
    const status = e.code === "not_configured" ? 503 : e.code === "bad_token" ? 401 : 502;
    return json({ ok: false, error: e.code, message: e.message, courses: [], items: [] }, status);
  }
  console.error("school sync failed", e);
  return json({ ok: false, error: "api", message: "School sync failed unexpectedly.", courses: [], items: [] }, 500);
}
