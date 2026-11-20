# Putting devbot online (Vercel)

devbot is protected by a single password (`DEVBOT_PASSWORD`). Every page and API route requires it; in production devbot refuses to run without one.

## Steps

1. Sign up at **vercel.com** with your GitHub account (the free Hobby plan is enough).
2. **Add New → Project** → import the `devbot` repository. Vercel detects Next.js automatically.
3. Before deploying, open **Environment Variables** and add:

   | Name | Value |
   |---|---|
   | `DEVBOT_PASSWORD` | a password you choose (long and unique; not your school password) |
   | `GEMINI_API_KEY` | same as in your `.env.local` |
   | `MOODLE_URL` | `https://learn.vcs.net` |
   | `MOODLE_TOKEN` | same as in your `.env.local` |

4. Click **Deploy**. You get a URL like `devbot-xxxx.vercel.app`.
5. Open it, enter your password once per device, and you'll stay signed in for a year.

Every push to `main` on GitHub redeploys automatically.

## On your phone

- **iPhone:** open the URL in Safari → Share → **Add to Home Screen**.
- **Android:** open it in Chrome → ⋮ → **Add to Home screen** / **Install app**.

## Good to know

- **Data is per device** until Supabase is added: tasks you create on your laptop don't appear on your phone. School homework and school calendars sync on every device on their own.
- **Changing the password** (in Vercel → Settings → Environment Variables, then redeploy) signs out every device.
- **Settings → This device → Lock** signs out just that browser.
