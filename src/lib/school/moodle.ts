// Server-only Moodle Web Services client, using the student's personal
// "Moodle mobile web service" key from Preferences → Security keys.
// The key never reaches the browser.

import "server-only";

export class MoodleError extends Error {
  constructor(
    message: string,
    public code: "not_configured" | "bad_token" | "unreachable" | "api",
  ) {
    super(message);
  }
}

export interface MoodleFile {
  type: string; // "content" | "file"
  filename: string;
  filepath?: string;
  fileurl?: string;
  content?: string;
}

export interface MoodleModule {
  id: number; // course-module id
  name: string;
  modname: string; // "book", "label", ...
  visible?: number;
  uservisible?: boolean;
  contents?: MoodleFile[];
}

export interface MoodleSection {
  id: number;
  name: string;
  section: number;
  modules: MoodleModule[];
}

export interface MoodleCourse {
  id: number;
  fullname: string;
  shortname: string;
  visible?: number;
}

export function moodleConfig() {
  const url = process.env.MOODLE_URL?.replace(/\/+$/, "");
  const token = process.env.MOODLE_TOKEN?.trim();
  if (!url || !token) throw new MoodleError("School connection isn't set up yet.", "not_configured");
  return { url, token };
}

async function call<T>(wsfunction: string, params: Record<string, string | number> = {}): Promise<T> {
  const { url, token } = moodleConfig();
  const body = new URLSearchParams({ wstoken: token, wsfunction, moodlewsrestformat: "json" });
  for (const [k, v] of Object.entries(params)) body.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(`${url}/webservice/rest/server.php`, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new MoodleError("Couldn't reach learn.vcs.net.", "unreachable");
  }
  if (!res.ok) throw new MoodleError(`learn.vcs.net returned ${res.status}.`, "unreachable");
  const data = (await res.json()) as T | { exception?: string; errorcode?: string; message?: string };
  if (data && typeof data === "object" && "exception" in data && data.exception) {
    const code = data.errorcode ?? "";
    if (/invalidtoken|accessexception|invalidlogin|usernotfullysetup/i.test(code)) {
      throw new MoodleError("Your school key was rejected. Create a new one in Security keys.", "bad_token");
    }
    throw new MoodleError(data.message ?? `Moodle error: ${code}`, "api");
  }
  return data as T;
}

export const getSiteInfo = () =>
  call<{ userid: number; sitename: string; fullname: string }>("core_webservice_get_site_info");

export const getCourses = (userid: number) =>
  call<MoodleCourse[]>("core_enrol_get_users_courses", { userid });

export const getContents = (courseid: number) =>
  call<MoodleSection[]>("core_course_get_contents", { courseid });

/** Download a file served through webservice/pluginfile.php (e.g. a book chapter). */
export async function fetchFile(fileurl: string): Promise<string> {
  const { url, token } = moodleConfig();
  if (!fileurl.startsWith(url)) throw new MoodleError("Unexpected file location.", "api");
  const sep = fileurl.includes("?") ? "&" : "?";
  try {
    const res = await fetch(`${fileurl}${sep}token=${encodeURIComponent(token)}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw new MoodleError(`Couldn't download a chapter (${res.status}).`, "api");
    return await res.text();
  } catch (e) {
    if (e instanceof MoodleError) throw e;
    throw new MoodleError("Couldn't reach learn.vcs.net.", "unreachable");
  }
}

export interface MoodleActionEvent {
  id: number;
  name: string;
  timesort: number; // unix seconds
  modulename?: string;
  url?: string;
  course?: { id: number; fullname?: string };
}

/** Upcoming assignment/quiz deadlines Moodle tracks (the "Timeline" block). */
export async function getActionEvents(fromUnix: number, toUnix: number): Promise<MoodleActionEvent[]> {
  const res = await call<{ events?: MoodleActionEvent[] }>("core_calendar_get_action_events_by_timesort", {
    timesortfrom: fromUnix,
    timesortto: toUnix,
    limitnum: 50,
  });
  return res.events ?? [];
}
