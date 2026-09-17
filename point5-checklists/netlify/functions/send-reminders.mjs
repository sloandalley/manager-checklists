// MONDAY: remind any manager who hasn't submitted LAST week's checklist.
// Also catches up on summaries for anything submitted but not yet summarized.
// 15:00 UTC = 9:00am Mountain Daylight / 8:00am Mountain Standard.
import { sb, weekStart, addDays, fmtWeek, managerLink, sendEmail, emailShell, json, countItems, countDone } from "../lib/lib.mjs";
import { summarizeWeek } from "../lib/summarize.mjs";

export const config = { schedule: "0 15 * * 1" };

export async function sendReminderEmail(b, w) {
  const total = countItems(w.template_snapshot || b.template), done = countDone(w.template_snapshot || b.template, w.progress);
  const html = emailShell(
    `Reminder: submit last week's ${b.name} checklist`,
    `<p>Hi ${b.manager_name || "there"},</p>
     <p>Your checklist for <strong>${fmtWeek(w.week_start)}</strong> hasn't been submitted yet${total ? ` (${done} of ${total} items done)` : ""}. Take a couple of minutes this morning to finish it up and hit <strong>Submit</strong> so Sloan gets your update.</p>
     <p>Anything that's not done is fine to leave unchecked — just add a note if there's a reason she should know about.</p>`,
    managerLink(b), "Finish and submit"
  );
  return sendEmail({ to: b.manager_email, subject: `Reminder: ${b.name} checklist for ${fmtWeek(w.week_start)} is still open`, html });
}

export default async () => {
  const lastWeek = addDays(weekStart(), -7);
  const businesses = await sb.get("businesses?active=is.true&order=name");
  const results = [];
  for (const b of businesses) {
    try {
      let [w] = await sb.get(`weeks?business_id=eq.${b.id}&week_start=eq.${lastWeek}&limit=1`);
      if (!w) {
        await sb.insertIgnore("weeks", [{ business_id: b.id, week_start: lastWeek, progress: {}, status: "open", template_snapshot: b.template }], "business_id,week_start");
        [w] = await sb.get(`weeks?business_id=eq.${b.id}&week_start=eq.${lastWeek}&limit=1`);
      }
      if (w.status === "submitted") {
        results.push({ business: b.slug, submitted: true });
        continue;
      }
      const r = await sendReminderEmail(b, w);
      await sb.patch(`weeks?id=eq.${w.id}`, { reminder_sent_at: new Date().toISOString() });
      results.push({ business: b.slug, ...r });
    } catch (e) {
      console.error(b.slug, e);
      results.push({ business: b.slug, error: String(e.message || e) });
    }
  }

  // Catch-up: summarize anything submitted in the last 60 days that has no summary yet.
  const missing = await sb.get(`weeks?status=eq.submitted&summary=is.null&week_start=gte.${addDays(lastWeek, -60)}&limit=50`);
  const byId = Object.fromEntries(businesses.map((b) => [b.id, b]));
  for (const w of missing) {
    try { if (byId[w.business_id]) await summarizeWeek(byId[w.business_id], w); }
    catch (e) { console.error("summary catch-up", w.id, e); }
  }
  console.log("send-reminders", lastWeek, JSON.stringify(results), "summaries:", missing.length);
  return json({ week: lastWeek, results, summarized: missing.length });
};
