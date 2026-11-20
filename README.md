# devbot

my personal ai-powered command center. open it, see my day, tell it what changed, close it, go live my life.

i got tired of juggling five app soooo i built one thing that does it all and mostly manages itself.
yay no more opening moodle :>

## what it does

- **home screen** – greeting, what's due today, my schedule with a little "now" line, countdowns to tests, and a chief of staff that actually notices stuff ("apush test sunday and you haven't planned any studying")
- **ai command bar** – hit `⌘K` (or just talk to it) and say whatever. "add robotics meeting thursday 5pm", "i finished my calc hw", or dump my whole brain into it. it suggests changes, i look them over, hit apply. anything can be undone
- **school sync** – pulls homework straight out of every one of my class's lesson plans. figures out due dates (even "next next class"), turns tests into deadlines. 
- **calendar** – month / week / day / agenda, repeating events, yells at me if i double-book. school events + a/b days come in from the school calendar automatically
- **themes** – dark, light, or whatever my mac is doing. five colorways bc why not
- **works on my phone** – add it to the home screen and it's basically an app. locked behind a password so nobody's reading my homework

## stack

next.js 16 · react 19 · typescript · tailwind 4 · framer motion · zustand · gemini (free tier) for the ai · moodle web services for school · deployed on vercel

## running it

```bash
npm install
cp .env.example .env.local
npm run dev
```

then fill in `.env.local`:

- `GEMINI_API_KEY` – free from [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
- `MOODLE_URL` + `MOODLE_TOKEN` – learn.vcs.net → profile → preferences → security keys
- `DEVBOT_PASSWORD` – only on vercel, leave it out locally

everything except the ai works without keys. `npm test` runs the parser tests.

## online

lives on vercel, every push to `main` redeploys. setup steps are in [docs/DEPLOY.md](docs/DEPLOY.md).

## still cooking

- [ ] supabase so my tasks sync between laptop + phone
- [ ] notifications (morning briefing, reminders, evening recap)
- [ ] projects page
- [ ] academic page – grades, "what do i need on the final", study plans

---

how it all fits together → [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
