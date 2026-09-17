// Generates the owner summary for a submitted week. Called by the manager page right after submit,
// by the dashboard ("Regenerate"), and by the Monday job as a catch-up for anything missed.
import { json, sb, authBusiness, isAdmin } from "../lib/lib.mjs";
import { summarizeWeek } from "../lib/summarize.mjs";

export const config = { path: "/api/summarize" };

export default async (req) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  try {
    const body = await req.json().catch(() => ({}));
    const admin = isAdmin(req);
    let b;
    if (admin) {
      [b] = await sb.get(`businesses?slug=eq.${encodeURIComponent(body.b)}&limit=1`);
    } else {
      b = await authBusiness(body.b, body.key);
    }
    if (!b) return json({ error: "unauthorized" }, 401);
    const [w] = await sb.get(`weeks?business_id=eq.${b.id}&week_start=eq.${body.week_start}&limit=1`);
    if (!w) return json({ error: "no such week" }, 404);
    const result = await summarizeWeek(b, w, { force: admin && !!body.force });
    return json(result);
  } catch (e) {
    console.error(e);
    return json({ error: String(e.message || e) }, 500);
  }
};
