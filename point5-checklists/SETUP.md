# Weekly Manager Checklists — Setup Guide

What this is: a small website (hosted on Netlify) where each of your managers — plus the social media
coordinator and your executive assistant — fills in their weekly checklist from a private link. Progress saves
automatically as they go. Every Sunday morning each person gets an email with their link; every Monday
morning anyone who hasn't submitted last week's gets a reminder. When a checklist is submitted, Claude writes
a short summary with urgent items flagged, and it shows up on your private dashboard.

Setup takes about 30–40 minutes. You'll need accounts at Supabase (free), Netlify (free), SendGrid (you have
this), Anthropic (console.anthropic.com — pay-as-you-go, roughly $0.02–0.05 per summary), and GitHub (free).

---

## 1. Database (Supabase) — 5 minutes

1. Go to supabase.com → New project. Name it `point5-checklists`, pick a strong database password (you won't
   need it again), region: US West. Wait for it to finish creating.
2. Left sidebar → **SQL Editor** → **New query**. Open `supabase/schema.sql` from this folder, paste the whole
   thing, click **Run**. You should see "Success".
3. New query again. Paste the whole of `supabase/seed.sql`, click **Run**. This creates the 10 checklists.
4. Left sidebar → **Project Settings** → **API**. Copy two things for later:
   - **Project URL** (looks like `https://abcdefgh.supabase.co`)
   - **service_role** secret key (under "Project API keys" — click reveal). *Not* the anon key.

## 2. Claude API key — 2 minutes

1. console.anthropic.com → API Keys → Create key. Name it `checklists`. Copy it (starts with `sk-ant-`).
2. Add a few dollars of credit under Billing if you haven't already.

## 3. SendGrid sender — 3 minutes

The emails need to come from a domain you've authenticated in SendGrid. You already authenticated
`brasscityraceway.com`, so the quickest option is `checklists@brasscityraceway.com` as the FROM address. Better
long-term: authenticate a neutral company domain (point5fun.com or similar) the same way you did for Brass City
and use `checklists@` on that.

1. SendGrid → Settings → API Keys → Create API Key → "Full Access" (or Restricted with *Mail Send* only). Copy it.

## 4. Put the code on GitHub — 5 minutes

1. github.com → New repository → name `point5-checklists`, **Private**, Create.
2. Easiest: on the empty-repo page click **"uploading an existing file"**, drag the entire contents of this
   folder in (all files and folders: `public`, `netlify`, `supabase`, `scripts`, `templates`, `netlify.toml`,
   `package.json`, `.gitignore`, `.env.example`, `SETUP.md`), and click **Commit changes**.
   (Or use GitHub Desktop if you prefer.)

## 5. Deploy on Netlify — 10 minutes

1. app.netlify.com → **Add new site** → **Import an existing project** → GitHub → pick `point5-checklists`.
2. Build settings should auto-detect from `netlify.toml` (publish directory `public`, functions
   `netlify/functions`). Leave the build command **empty**. Click **Deploy**.
3. Once it deploys, note your site URL (e.g. `https://point5-checklists.netlify.app`). Optionally add a custom
   domain under **Domain management** (e.g. `checklists.point5fun.com`).
4. **Site configuration → Environment variables → Add a variable** (choose "Add a single variable" for each,
   or "Import from a .env file" and paste). Add all of these:

   | Key | Value |
   |---|---|
   | `SUPABASE_URL` | the Project URL from step 1 |
   | `SUPABASE_SERVICE_KEY` | the service_role key from step 1 |
   | `ANTHROPIC_API_KEY` | from step 2 |
   | `SENDGRID_API_KEY` | from step 3 |
   | `FROM_EMAIL` | e.g. `checklists@brasscityraceway.com` |
   | `FROM_NAME` | `Point 5 Fun Checklists` |
   | `REPLY_TO_EMAIL` | your email (so managers can reply to you) |
   | `SITE_URL` | your Netlify site URL from step 5.3, no trailing slash |
   | `ADMIN_KEY` | a long random password — this is your dashboard login. Use a password manager to generate 20+ characters. |
   | `TIMEZONE` | `America/Boise` |

5. **Deploys → Trigger deploy → Deploy site** so the functions pick up the variables.
6. Open **Logs → Functions** — you should see `send-checklists` and `send-reminders` listed as scheduled.

## 6. Add your people — 5 minutes

1. Open `https://YOUR-SITE/admin.html`, enter your ADMIN_KEY.
2. Click the **Businesses & checklists** tab. For each of the 10, click it, fill in **Manager name** and
   **Manager email**, click **Save**.
3. Click **Email link to manager** to send them their private link right away (or **Copy link** and text it).
   They don't need an account or password — the link is the key. If a link ever leaks, click **New link**.

That's it. From here it runs itself:

- **Sunday 7am Mountain** — everyone gets "Your checklist for the week of …" with their link.
- **Monday 9am Mountain** — anyone who didn't submit last week gets a reminder.
- **When someone submits** — the summary and flags appear on your dashboard within about 30 seconds.

---

## Using the dashboard (`/admin.html`)

- **Summaries** tab shows last week by default. Each card is color-coded: green (all good), yellow (something
  needs attention soon or low completion), red (an urgent flag), grey (not submitted yet). Click a card for the
  written summary, the flags sorted urgent → soon → fyi, wins, and the full responses.
- Use **‹ ›** to move between weeks; **Last week** jumps back.
- **Send reminder now** nudges someone outside the Monday schedule. **Reopen for edits** lets a manager fix a
  submission. **Regenerate summary** re-runs the AI summary. **History** shows the last 16 weeks as colored squares.

## Editing a checklist

Businesses & checklists tab → click the business → edit the JSON → Save. The format:

```json
{ "sections": [
  { "title": "Axe Throwing Experience", "items": [
    { "id": "s4_1", "label": "Targets are in good condition and changed when needed", "type": "pass" },
    { "id": "s4_9", "label": "Spare target boards on hand", "type": "number", "unit": "boards" },
    { "id": "s4_10", "label": "Take inventory", "type": "check", "hint": "Every Friday" },
    { "id": "s4_11", "label": "Biggest issue this week", "type": "text" }
  ]}
]}
```

Item types: `pass` = Pass / Needs improvement buttons (your standard format), `check` = a tick box, `number`,
`text`. Every item automatically has an "Add note" and a "Flag for Sloan" button. `id` must be unique within
that checklist and should not change once it's in use (past answers are stored by id). `hint` is optional grey
help text. Edits apply to the current week's open checklist and every week after.

If you'd rather edit in Word again: update the .docx, then run `python3 scripts/import-docx.py <folder>` and
`node scripts/build-seed.mjs`, and re-run `supabase/seed.sql` — it updates checklist content without touching
manager info or links.

## Costs

Netlify free tier (125k function calls/month — you'll use a few thousand), Supabase free tier, SendGrid free
tier (100 emails/day — you send ~20/week), Anthropic ~$1–2/month for 10 summaries a week.

## If something goes wrong

- Emails not arriving: Netlify → Logs → Functions → `send-checklists`, look for a SendGrid error. Most common
  cause: FROM_EMAIL isn't on an authenticated domain.
- "That link isn't valid": the link was rotated, or the business was set inactive. Copy a fresh one from the dashboard.
- Summary stuck on "generating": click **Regenerate summary**. If it errors, check ANTHROPIC_API_KEY and billing.
- The Monday job also catches up on any summaries that failed during the week.
