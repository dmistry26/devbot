export interface SchoolCourse {
  id: number;
  name: string; // short name, e.g. "AP Calculus BC"
  fullname: string;
  hasHomework: boolean;
  /** The class's date pair for today's/most recent meeting, to help pick A/B. */
  sampleDates: string[];
}

export interface SchoolItem {
  externalId: string; // stable: vcs:<courseId>:<task|deadline>:<slug>[:<week>]
  courseId: number;
  courseName: string;
  title: string;
  dueDate: string | null;
  dueTime: string | null;
  assignedDate: string | null;
  kind: "task" | "deadline";
  priority: "high" | "normal";
  sourceUrl: string;
  /** Set when the date looks wrong, e.g. it falls on a no-school day. */
  note?: string;
}

export interface SchoolSyncResponse {
  ok: boolean;
  error?: "not_configured" | "bad_token" | "unreachable" | "api" | "bad_request";
  message?: string;
  student?: string;
  courses: SchoolCourse[];
  items: SchoolItem[];
  syncedAt?: string;
}
