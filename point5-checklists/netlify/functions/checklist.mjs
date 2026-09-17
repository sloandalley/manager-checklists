// Manager API: load the checklist + saved progress, autosave, submit.
import { json, sb, authBusiness, weekStart, addDays, fmtWeek, countItems, countDone } from "../lib/lib.mjs";

export const config = { path: "/api/checklist" };

function publicBusiness(b) {
  return { slug: b.slug, name: b.name, location: b.location, manager_name: b.manager_name };
}
function publicWeek(w) {
  const t = w.template_snapshot;
  return {
    id: w.id, week_start: w.week_start, label: fmtWeek(w.week_start), status: w.status,
    submitted_at: w.submitted_at, progress: w.progress || {}, template: t,
    total: countItems(t), done: countDone(t, w.progress),
  };
}

async function getOrCreateWeek(b, ws) {
  const rows = await sb.get(`weeks?business_id=eq.${b.id}&week_start=eq.${ws}&limit=1`);
  if (rows[0]) return rows[0];
  await sb.insertIgnore("weeks", [{
    business_id: b.id, week_start: ws, progress: {}, status: "open", template_snapshot: b.template,
  }], "business_id,week_start");
  const again = await sb.get(`weeks?business_id=eq.${b.id}&week_start=eq.${ws}&limit=1`);
  return again[0];
}

export default async (req) => {
  try {
    const url = new URL(req.url);
    let body = {};
    if (req.method === "POST") body = await req.json().catch(() => ({}));
    const slug = body.b || url.searchParams.get("b");
    const key = body.key || url.searchParams.get("key");
    const b = await authBusiness(slug, key);
    if (!b) return json({ error: "That link isn't valid. Ask Sloan for a fresh one." }, 401);

    const current = weekStart();

    if (req.method === "GET") {
      const cur = await getOrCreateWeek(b, current);
      // Earlier weeks (up to 3 back) that were started or should have been done and aren't submitted.
      const since = addDays(current, -21);
      const past = await sb.get(
        `weeks?business_id=eq.${b.id}&week_start=lt.${current}&week_start=gte.${since}&order=week_start.desc`
      );
      const lastWeek = addDays(current, -7);
      let pending = past.filter((w) => w.status !== "submitted");
      if (!past.find((w) => w.week_start === lastWeek)) {
        // Last week was never opened — create it so it can still be filled in and submitted.
        pending.unshift(await getOrCreateWeek(b, lastWeek));
      }
      const recent = past.filter((w) => w.status === "submitted").slice(0, 4)
        .map((w) => ({ week_start: w.week_start, label: fmtWeek(w.week_start), submitted_at: w.submitted_at }));
      return json({ business: publicBusiness(b), current: publicWeek(cur), pending: pending.map(publicWeek), recent });
    }

    if (req.method === "POST") {
      const { action, week_start, progress } = body;
      if (!week_start || !/^\d{4}-\d{2}-\d{2}$/.test(week_start)) return json({ error: "bad week" }, 400);
      if (week_start > current) return json({ error: "That week hasn't started yet." }, 400);
      const w = await getOrCreateWeek(b, week_start);
      if (w.status === "submitted") return json({ error: "This week was already submitted.", week: publicWeek(w) }, 409);
      if (typeof progress !== "object" || progress === null) return json({ error: "bad progress" }, 400);

      const patch = { progress, updated_at: new Date().toISOString() };
      if (action === "submit") { patch.status = "submitted"; patch.submitted_at = new Date().toISOString(); }
      const [updated] = await sb.patch(`weeks?id=eq.${w.id}`, patch);
      return json({ ok: true, week: publicWeek(updated) });
    }
    return json({ error: "method" }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: "Something went wrong saving. Your last change may not be saved — try again." }, 500);
  }
};
