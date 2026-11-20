# Architecture

## Stack

Next.js 16 (App Router, Turbopack, Cache Components) · React 19 · TypeScript · Tailwind CSS 4 · Framer Motion · Zustand · date-fns · Lucide · Anthropic SDK. Planned: Supabase (Postgres, Auth, RLS, Edge Functions, cron) and Vercel.

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

- `POST /api/command` sends the conversation, a snapshot of your data and your local time.
- The server builds a compact context block (open tasks, the next 14 days of schedule, free time, projects) and calls Claude with **strict tool schemas** (`lib/ai/tools.ts`).
- The model's tool calls are **not executed on the server**. They go back to the browser as a proposal. The confirm card validates each one (for example, it rejects unknown ids or bad dates). Only actions you tick are applied, and the result is undoable.
- The system prompt and tools are stable and cached. The volatile context goes in the last user turn.
- Two agents share one dataset: **Chief of Staff** (planning, coordination) and **Academic Staff** (school, study plans). The model is configured in one place (`DEVBOT_MODEL`).
- A server-side refusal fallback is enabled (`fallbacks: "default"`).

## Dates

Local "floating" strings (`YYYY-MM-DD`, `HH:mm`, `YYYY-MM-DDTHH:mm`) keep things simple for one user. In Supabase they become `date` / `time` / `timestamptz` columns plus the user's IANA timezone, which reminders need anyway.

## Planned: Supabase schema (Phase 2)

Tables: `tasks`, `events`, `projects`, `notes`, `conversations`, `messages`, `notifications`, `push_subscriptions`, `school_sync_runs`. Every table has `user_id uuid references auth.users` and an RLS policy of `user_id = auth.uid()`. Foreign keys: `tasks.project_id → projects`, `events.task_id → tasks`, `notes.project_id → projects`. Check constraints cover the enums (priority, status, category).

## Planned: notifications (Phase 4)

`pg_cron` runs every minute and calls an Edge Function. The function finds due `notifications` rows and sends Web Push using VAPID keys, and the browser's service worker displays them. The `notifications` table and `push_subscriptions` are channel-agnostic, so mobile push (APNs/FCM) can be added later. The app will not claim reminders work until this exists.

## Planned: school import (Phase 5)

learn.vcs.net is a custom portal with no public API. The plan is a server-side importer that logs in with the student's own credentials, stored encrypted as server secrets, never in the browser. It walks each class's "Lesson Plans & HW" pages and upserts assignments as tasks with `source = 'school'`, deduplicated by a stable external id. It runs on a schedule and shows "last synced" plus clear errors. The first step is mapping the page structure while logged in.
