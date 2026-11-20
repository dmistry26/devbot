# devbot

A personal AI command center. Open it, see your day, tell it what changed, close it.

## What works today (Phase 1)

- **Home command center**: time-aware greeting, day progress dial, today's priorities grouped by importance (Focus / Up next / If there's time), schedule timeline with a live "now" line, deadline countdowns, and Chief of Staff insights computed from your real data.
- **Tasks**: create, edit, complete, reopen, reschedule, delete. Every change can be undone.
- **AI command bar** (`⌘K` or `/`): text or voice input, Chief of Staff and Academic Staff agents, "Plan my day", brain dump. The AI only *proposes* changes. You review them on a confirm card, untick anything you don't want, apply, and can undo.
- **Local persistence**: your data stays in your browser until Supabase is connected.
- **School homework sync** from learn.vcs.net (Moodle). Homework from every class's lesson plans shows up as tasks with due dates, and tests show up as deadlines. Setup is in Settings → School.
- **Sample data** to preview the UI. It's clearly labelled and can be cleared in one click.

## Run it

```bash
npm install
cp .env.example .env.local   # then add your ANTHROPIC_API_KEY
npm run dev
```

Open http://localhost:3000. Everything except the AI works without a key.

## Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Design system, home screen, tasks, AI command bar with confirm and undo | ✅ |
| 2 | Supabase (auth, Postgres + RLS, sync), calendar views (month/week/day/agenda), recurring events and conflicts, projects page | next |
| 3 | Conversation memory in the database, agent hand-off, Academic page (classes, grades, study plans) | |
| 4 | Notifications: web push, reminders, morning briefing, evening summary (Supabase cron + Edge Functions) | |
| 5 | School import from learn.vcs.net | ✅ (syncs when devbot opens; daily background sync arrives with Phase 4) |

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for how it fits together.
