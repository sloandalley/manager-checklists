// Owner dashboard API. Every call must carry the ADMIN_KEY in the x-admin-key header.
import { json, sb, isAdmin, weekStart, addDays, fmtWeek, managerLink, randomKey, countItems, countDone } from "../lib/lib.mjs";
import { summarizeWeek } from "../lib/summarize.mjs";
import { sendChecklistEmail } from "./send-checklists.mjs";
import { sendReminderEmail } from "./send-reminders.mjs";

export const config = { path: "/api/admin" };

function weekView(w) {
  if (!w) return null;
  const t = w.template_snapshot;
  return {
    id: w.id, week_start: w.week_start, label: fmtWeek(w.week_start), status: w.status, submitted_at: w.submitted_at,
    total: countItems(t), done: countDone(t, w.progress), progress: w.progress || {}, template: t,
    rating: w.rating, headline: w.headline, summary: w.summary, flags: w.flags || [], wins: w.wins || [],
    summarized_at: w.summarized_at, checklist_sent_at: w.checklist_sent_at, reminder_sent_at: w.reminder_sent_at,
  };
}
function bizView(b) {
  return { slug: b.slug, name: b.name, location: b.location, manager_name: b.manager_name, manager_email: b.manager_email,
    active: b.active, link: managerLink(b), template: b.template };
}

export default async (req) => {
  if (!isAdmin(req)) return json({ error: "unauthorized" }, 401);
  try {
    const url = new URL(req.url);
    if (req.method === "GET") {
      const view = url.searchParams.get("view") || "week";
      const businesses = await sb.get("businesses?order=name");
      if (view === "week") {
        const ws = url.searchParams.get("week") || addDays(weekStart(), -7);
        const weeks = await sb.get(`weeks?week_start=eq.${ws}`);
        const byBiz = Object.fromEntries(weeks.map((w) => [w.business_id, w]));
        return json({
          week_start: ws, label: fmtWeek(ws), current_week_start: weekStart(),
          businesses: businesses.map((b) => ({ ...bizView(b), week: weekView(byBiz[b.id]) })),
        });
      }
      if (view === "history") {
        const b = businesses.find((x) => x.slug === url.searchParams.get("b"));
        if (!b) return json({ error: "no such business" }, 404);
        const weeks = await sb.get(`weeks?business_id=eq.${b.id}&order=week_start.desc&limit=16`);
        return json({ business: bizView(b), weeks: weeks.map(weekView) });
      }
      if (view === "businesses") return json({ businesses: businesses.map(bizView) });
      return json({ error: "unknown view" }, 400);
    }

    if (req.method === "POST") {
      const body = await req.json().catch(() => ({}));
      const [b] = body.slug ? await sb.get(`businesses?slug=eq.${encodeURIComponent(body.slug)}&limit=1`) : [];
      if (!b) return json({ error: "no such business" }, 404);

      switch (body.action) {
        case "update_business": {
          const allowed = ["name", "location", "manager_name", "manager_email", "active", "template"];
          const patch = {};
          for (const k of allowed) if (body.fields && k in body.fields) patch[k] = body.fields[k];
          if (patch.template && (!patch.template.sections || !Array.isArray(patch.template.sections)))
            return json({ error: "Template must be an object with a sections array." }, 400);
          const [u] = await sb.patch(`businesses?id=eq.${b.id}`, patch);
          // Keep the open current-week checklist in sync with a template edit.
          if (patch.template) await sb.patch(`weeks?business_id=eq.${b.id}&status=eq.open&week_start=gte.${addDays(weekStart(), -7)}`, { template_snapshot: patch.template });
          return json({ ok: true, business: bizView(u) });
        }
        case "rotate_key": {
          const [u] = await sb.patch(`businesses?id=eq.${b.id}`, { access_key: randomKey() });
          return json({ ok: true, business: bizView(u) });
        }
        case "send_link": {
          const ws = weekStart();
          await sb.insertIgnore("weeks", [{ business_id: b.id, week_start: ws, progress: {}, status: "open", template_snapshot: b.template }], "business_id,week_start");
          return json({ ok: true, ...(await sendChecklistEmail(b, ws)) });
        }
        case "send_reminder": {
          const ws = body.week_start || addDays(weekStart(), -7);
          const [w] = await sb.get(`weeks?business_id=eq.${b.id}&week_start=eq.${ws}&limit=1`);
          if (!w) return json({ error: "no week row yet" }, 404);
          return json({ ok: true, ...(await sendReminderEmail(b, w)) });
        }
        case "summarize": {
          const [w] = await sb.get(`weeks?business_id=eq.${b.id}&week_start=eq.${body.week_start}&limit=1`);
          if (!w) return json({ error: "no such week" }, 404);
          const r = await summarizeWeek(b, w, { force: true });
          return json({ ...r, week: r.week ? weekView(r.week) : undefined });
        }
        case "reopen": {
          const [w] = await sb.patch(`weeks?business_id=eq.${b.id}&week_start=eq.${body.week_start}`, { status: "open", submitted_at: null });
          return json({ ok: true, week: weekView(w) });
        }
        default:
          return json({ error: "unknown action" }, 400);
      }
    }
    return json({ error: "method" }, 405);
  } catch (e) {
    console.error(e);
    return json({ error: String(e.message || e) }, 500);
  }
};
