# Architecture

## Stack

Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Zustand · date-fns · Lucide · Google Gen AI SDK (Gemini) · Anthropic SDK (optional). Planned: Supabase (Postgres, Auth, RLS, Edge Functions, cron) and Vercel.

## Data flow

```
 UI click ─┐
           ├─▶ Action[] ──▶ store.commit() ──▶ new Snapshot + undo entry ──▶ localStorage
 AI card ──┘                  (lib/store.ts)                                  (→ Supabase in Phase 2)
```

- **`lib/actions.ts`**: the single vocabulary for changing data (`create_task`, `update_event`, …). It validates actions from untrusted sources (the model) and applies them as a pure function.
- **`lib/store.ts`**: a local-first Zustand store. `commit()` records a full "before" snapshot so any change, from you or the AI, can be undone. The Supabase sync adapter will hook in here, so components don't change.
- **`lib/derive.ts`**: pure selectors for the home screen: today's tasks, grouping, deadlines, free time gaps, insights and the day summary. Insights are computed from your real data, never generated filler.

## AI

- **Providers** (`lib/ai/provider.ts`): one interface, two adapters: `providers/gemini.ts` (default, free tier) and `providers/anthropic.ts`. `AI_PROVIDER` picks one explicitly; otherwise devbot uses whichever key is set, Gemini first. Tool schemas are defined once as provider-neutral JSON Schema (`lib/ai/tools.ts`). The Gemini adapter turns nullable fields into optional ones, and `normalizeInput` fills missing fields back in with null.
- Gemini model chain: `gemini-3.8-flash` → `gemini-3.5-flash` → `gemini-3.5-flash-lite` (`GEMINI_MODEL` is tried first). Each attempt has a 15s timeout and no SDK retries, and the model that last worked is tried first next time. This keeps commands quick when the free tier is congested.
- The confirm card rejects proposals with dates in the past (usually a wrong year or a made-up date), along with unknown ids and bad formats.
- Free-tier note: Google may use free-tier Gemini prompts, which include your task and schedule context, to improve its products.
- `POST /api/command` sends the conversation, a snapshot of your data and your local time.
- The server builds a compact context block (open tasks, the next 14 days of schedule, free time, projects) and calls Claude with **strict tool schemas** (`lib/ai/tools.ts`).
- The model's tool calls are **not executed on the server**. They go back to the browser as a proposal. The confirm card validates each one (for example, it rejects unknown ids or bad dates). Only actions you tick are applied, and the result is undoable.
- The system prompt and tools are stable and cached. The volatile context goes in the last user turn.
- Two agents share one dataset: **Chief of Staff** (planning, coordination) and **Academic Staff** (school, study plans). The model is configured in one place (`DEVBOT_MODEL`).
- With Claude, a server-side refusal fallback is enabled on models that support it.
- Proposed events and moves that overlap existing events are flagged on the confirm card.

## Calendar

- `lib/calendar.ts`: expands repeating events over a range, finds conflicts (for a repeating event it checks occurrences over the next 4 weeks), and lays out overlapping events side by side in a time grid.
- `components/calendar/CalendarView.tsx`: month, week, day and agenda views. Click an empty slot to create an event (snapped to 30 minutes), or click an event to edit it. Tasks due that day appear in a "Due" row, with tests highlighted.
- `components/ui/EventEditor.tsx`: create/edit/delete with repeat rules, an end date, and live overlap warnings. Edits to a repeating event apply to the whole series.

## Academic page

`components/academic/AcademicView.tsx` lists every class that has a "Lesson Plans & Homework" section, using `school.courses` from the last sync. Tasks belong to a class through their external id (`vcs:<courseId>:…`), or through `context` for hand-made tasks. Each class shows tests and quizzes as countdowns, homework grouped as overdue / today / tomorrow / later / no date, and recently completed work. The A/B label only appears once it's chosen in Settings → School.

### Grades (PowerSchool bookmark)

VCS's Moodle gradebook isn't used (`gradereport_overview` is empty and item grades return `nopermissiontoviewgrades`). Grades live in PowerSchool (vcsnet.powerschool.com), which has no student API and sits behind Imperva bot protection, so devbot doesn't sign in for you or store your password.

Instead there's a bookmarklet (`lib/grades/bookmarklet.ts`) that runs on PowerSchool's Grades and Attendance page in your own signed-in browser:
1. It reads `table.linkDescList.grid`: header colspans are expanded so columns line up, the course name comes before the first `<br>`, the teacher comes from the "Details about …" link, and each term cell like `A<br>92` becomes a letter and a percent.
2. It base64url-encodes `{ v: 1, terms, classes }` into the fragment of `<devbot>/import#grades=…`. The fragment never reaches a server, and unlock keeps it through the password redirect.
3. `/import` validates and caps the payload (`lib/grades/import.ts`), matches PowerSchool names to learn.vcs.net classes by word overlap with synonyms ("Lang and Comp" ≈ "Language Composition"), saves a `GradesSnapshot`, and strips the fragment from history.

Tested in `scripts/test-grades.mts` with VCS's real class names.

## Calendar subscriptions

- `lib/ics.ts` parses iCal feeds: all-day and multi-day events, UTC/TZID/floating times converted to your timezone, simple RRULEs, and cancelled events dropped (tested in `scripts/test-ics.mts`).
- `POST /api/calendar/feed` fetches the feed on the server (to get around CORS), accepts only public https/webcal links, caps size and time, and returns events from 30 days ago to a year ahead.
- `lib/calendar-sync.ts` stores events with `subscriptionId` and replaces them on each refresh. Refreshes aren't undo history, and undo keeps the current feed events.
- All-day events (`allDay: true`) appear as chips and in "All day" rows, and are excluded from conflicts, free time and the time grid. Events titled like "HS A Day" / "HS B Day" become a label (`schoolDayOn`) instead of cluttering every day.

## Theming

- `globals.css` defines tokens per theme (`data-theme="dark" | "light"`) and per colorway (`data-accent`). `--gold` is the primary/"you" accent and `--ice` is the AI accent. Category colors (`--cat-*`) are independent of the colorway.
- `lib/theme-script.ts` holds the inline `<head>` script that applies the saved preference before first paint. `lib/theme.ts` handles changes and keeps "match system" in sync.
- Components use tokens (`bg-ink/[0.03]`, `text-on-accent`) rather than hard-coded white/black, so both themes work.

## Dates

Local "floating" strings (`YYYY-MM-DD`, `HH:mm`, `YYYY-MM-DDTHH:mm`) keep things simple for one user. In Supabase they become `date` / `time` / `timestamptz` columns plus the user's IANA timezone, which reminders need anyway.

## Planned: Supabase schema (Phase 2)

Tables: `tasks`, `events`, `projects`, `notes`, `conversations`, `messages`, `notifications`, `push_subscriptions`, `school_sync_runs`. Every table has `user_id uuid references auth.users` and an RLS policy of `user_id = auth.uid()`. Foreign keys: `tasks.project_id → projects`, `events.task_id → tasks`, `notes.project_id → projects`. Check constraints cover the enums (priority, status, category).

## Planned: notifications (Phase 4)

`pg_cron` runs every minute and calls an Edge Function. The function finds due `notifications` rows and sends Web Push using VAPID keys, and the browser's service worker displays them. The `notifications` table and `push_subscriptions` are channel-agnostic, so mobile push (APNs/FCM) can be added later. The app will not claim reminders work until this exists.

## School import (learn.vcs.net)

learn.vcs.net is Moodle. Every class has a "Lesson Plans & Homework" section containing one Book per quarter. Each chapter is one class meeting, titled with the A/B-day date pair (for example "November 19/20"), and contains a "Homework" heading.

- **Auth**: the student's personal *Moodle mobile web service* key (Preferences → Security keys), stored as `MOODLE_TOKEN` on the server only. No password; Google sign-in and two-step verification are untouched. The key can be revoked from the same page.
- **Fetch** (`lib/school/moodle.ts`): `core_webservice_get_site_info` → `core_enrol_get_users_courses` → `core_course_get_contents`. Book chapters are downloaded from their `webservice/pluginfile.php` URLs, and only chapters in a −7 to +21 day window are fetched.
- **Parse** (`lib/school/parse.ts`, tested in `scripts/test-school-parse.mts`): it reads the chapter date pair and the lines under "Homework", then resolves due dates from explicit dates ("Oct 15/20"), "next class", or "next next class", defaulting to the next meeting. Each class's A/B day picks which date of the pair applies. Quiz/test/exam lines become high-priority deadlines.
- **Tests anywhere in the plan** (`extractAssessments`): besides the Homework section, every chapter is scanned for tests and quizzes. That covers short activity lines that name the test ("- Unit 4 Test" happens that class day), weekly plans ("Thursday - … Test", rolling into next week when the weekdays wrap), and in-class notes ("Momentum Quiz next class", "Audio Quiz on Thursday, Nov 12"). Mentions that aren't the test happening are skipped: review/feedback/corrections lines and AP Stats vocabulary like "hypothesis test" and "test statistic". Duplicates of the same test (same class, type and week) are merged, keeping the most trustworthy date: that day's activities > explicit date > "next class" > announcement.
- **Unit tabs** (`lib/school/units.ts`): besides the lesson-plan books, teachers post in unit tabs like "Ch. 6". There, labels act as date headings ("November 17"), notes sit under each date ("Homework: WebAssign 6.1"), and assignments carry due dates in their names ("Chapter 6 Take Home Quiz [due 12/2]"). These are split into class days at each heading and run through the same homework and test parsing. Plain files (slides, warmups) are ignored. Tested with Calc BC's real Ch. 6 tab in `scripts/test-units.mts`.
- **Moodle deadlines**: `core_calendar_get_action_events_by_timesort` adds assignment due dates and times (in your timezone) for classes, skipping ones the lesson plans already list.
- **Date formats**: "Nov 19/20", "December 3rd", "Dec 2(A)/3(B)", and numeric "[due 12/2]" (only right after "due"/"by").
- **No-school check**: a test whose date lands on a "No School"/break day from the subscribed school calendar gets "(check date)" plus a note, rather than a guessed date.
- **Merge** (`lib/school/merge.ts`): items are upserted by a stable `externalId` (`vcs:<cmid>:<chapter>:<n>`). Homework is scheduled the day before it's due. Tasks you completed or edited are never overwritten, and tasks you delete are remembered so they don't come back.
- **When**: automatically when devbot opens (if the last sync is older than 3 hours), plus "Sync now" in Settings. Background daily sync needs a scheduler, so it comes with Supabase cron in Phase 4.
