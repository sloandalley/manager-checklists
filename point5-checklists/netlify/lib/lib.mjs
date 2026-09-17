// Shared helpers for all functions. Zero dependencies — uses fetch + Supabase REST.

export const env = (k, d) => (process.env[k] === undefined || process.env[k] === "" ? d : process.env[k]);
const TZ = () => env("TIMEZONE", "America/Boise");

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

// ---------- Supabase (service role, server-side only) ----------
function sbHeaders(extra = {}) {
  const key = env("SUPABASE_SERVICE_KEY");
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", ...extra };
}
async function sbFetch(method, path, body, prefer) {
  const url = `${env("SUPABASE_URL")}/rest/v1/${path}`;
  const r = await fetch(url, {
    method,
    headers: sbHeaders(prefer ? { Prefer: prefer } : {}),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`Supabase ${method} ${path} -> ${r.status}: ${await r.text()}`);
  if (r.status === 204) return null;
  const t = await r.text();
  return t ? JSON.parse(t) : null;
}
export const sb = {
  get: (path) => sbFetch("GET", path),
  insert: (table, rows) => sbFetch("POST", table, rows, "return=representation"),
  // Insert rows; rows that already exist (by onConflict columns) are left untouched.
  insertIgnore: (table, rows, onConflict) =>
    sbFetch("POST", `${table}?on_conflict=${onConflict}`, rows, "resolution=ignore-duplicates,return=representation"),
  patch: (path, body) => sbFetch("PATCH", path, body, "return=representation"),
  del: (path) => sbFetch("DELETE", path, undefined, "return=minimal"),
};

// ---------- Weeks (Sunday → Saturday, in the business timezone) ----------
function localParts(d = new Date()) {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ(), year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(d);
  const get = (t) => p.find((x) => x.type === t).value;
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { y: +get("year"), m: +get("month"), d: +get("day"), dow };
}
export function addDays(iso, n) {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}
/** ISO date of the Sunday that starts the week containing `d` (local time). */
export function weekStart(d = new Date()) {
  const { y, m, d: day, dow } = localParts(d);
  const iso = new Date(Date.UTC(y, m - 1, day)).toISOString().slice(0, 10);
  return addDays(iso, -dow);
}
export function fmtDate(iso, opts = { month: "short", day: "numeric" }) {
  return new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", { timeZone: "UTC", ...opts });
}
export function fmtWeek(iso) {
  return `${fmtDate(iso)} – ${fmtDate(addDays(iso, 6), { month: "short", day: "numeric", year: "numeric" })}`;
}

// ---------- Auth ----------
export function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}
export function isAdmin(req) {
  const k = req.headers.get("x-admin-key") || new URL(req.url).searchParams.get("admin");
  return !!env("ADMIN_KEY") && safeEqual(k || "", env("ADMIN_KEY"));
}
/** Look up a business by slug + access key. Returns null if no match. */
export async function authBusiness(slug, key) {
  if (!slug || !key) return null;
  const rows = await sb.get(`businesses?slug=eq.${encodeURIComponent(slug)}&limit=1`);
  const b = rows[0];
  if (!b || !b.active || !safeEqual(b.access_key, key)) return null;
  return b;
}
export function managerLink(b) {
  return `${env("SITE_URL", "").replace(/\/$/, "")}/?b=${encodeURIComponent(b.slug)}&key=${b.access_key}`;
}
export function randomKey() {
  return crypto.randomUUID().replace(/-/g, "");
}

// ---------- Email (SendGrid) ----------
export async function sendEmail({ to, subject, html, text }) {
  if (!to) return { skipped: "no recipient" };
  const r = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: { Authorization: `Bearer ${env("SENDGRID_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: env("FROM_EMAIL"), name: env("FROM_NAME", "Point 5 Fun Checklists") },
      reply_to: env("REPLY_TO_EMAIL") ? { email: env("REPLY_TO_EMAIL") } : undefined,
      subject,
      content: [
        { type: "text/plain", value: text || html.replace(/<[^>]+>/g, " ") },
        { type: "text/html", value: html },
      ],
    }),
  });
  if (!r.ok) throw new Error(`SendGrid ${r.status}: ${await r.text()}`);
  return { sent: to };
}

export function emailShell(title, bodyHtml, ctaUrl, ctaLabel) {
  return `<!doctype html><html><body style="margin:0;background:#f4f4f5;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#18181b">
  <div style="max-width:560px;margin:0 auto;padding:32px 20px">
    <div style="background:#fff;border-radius:12px;padding:28px;border:1px solid #e4e4e7">
      <h1 style="font-size:20px;margin:0 0 12px">${title}</h1>
      <div style="font-size:15px;line-height:1.55">${bodyHtml}</div>
      ${ctaUrl ? `<p style="margin:24px 0 8px"><a href="${ctaUrl}" style="display:inline-block;background:#1d4ed8;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:600">${ctaLabel}</a></p>
      <p style="font-size:12px;color:#71717a;word-break:break-all">Or copy this link: ${ctaUrl}</p>` : ""}
    </div>
    <p style="font-size:12px;color:#a1a1aa;text-align:center;margin-top:16px">Point 5 Fun · Weekly manager checklists</p>
  </div></body></html>`;
}

// ---------- Progress helpers ----------
export function countItems(template) {
  return (template?.sections || []).reduce((n, s) => n + (s.items || []).length, 0);
}
export function countDone(template, progress) {
  const items = progress?.items || {};
  let n = 0;
  for (const s of template?.sections || []) for (const it of s.items || []) {
    const p = items[it.id];
    if (!p) continue;
    if (it.type === "check" ? p.done : (p.value !== undefined && p.value !== "" && p.value !== null)) n++;
  }
  return n;
}
