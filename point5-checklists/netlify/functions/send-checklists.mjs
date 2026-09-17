// SUNDAY: email every manager their checklist link for the week that starts today.
// Schedule is in UTC. 13:00 UTC = 7:00am Mountain Daylight / 6:00am Mountain Standard.
import { sb, weekStart, fmtWeek, managerLink, sendEmail, emailShell, json } from "../lib/lib.mjs";

export const config = { schedule: "0 13 * * 0" };

export async function sendChecklistEmail(b, ws) {
  const link = managerLink(b);
  const html = emailShell(
    `Your ${b.name} checklist for ${fmtWeek(ws)}`,
    `<p>Hi ${b.manager_name || "there"},</p>
     <p>This week's checklist is ready. Work through it as the week goes — it saves automatically every time you tick a box or type a note, so you can open it from your phone whenever you have a minute.</p>
     <p><strong>Submit it by Sunday night.</strong> If anything needs Sloan's attention, tap the flag on that item and add a quick note.</p>`,
    link, "Open this week's checklist"
  );
  return sendEmail({ to: b.manager_email, subject: `${b.name}: checklist for the week of ${fmtWeek(ws)}`, html });
}

export default async () => {
  const ws = weekStart();
  const businesses = await sb.get("businesses?active=is.true&order=name");
  const results = [];
  for (const b of businesses) {
    try {
      // Make sure the week row exists with a frozen copy of the template.
      await sb.insertIgnore("weeks", [{ business_id: b.id, week_start: ws, progress: {}, status: "open", template_snapshot: b.template }], "business_id,week_start");
      const r = await sendChecklistEmail(b, ws);
      await sb.patch(`weeks?business_id=eq.${b.id}&week_start=eq.${ws}`, { checklist_sent_at: new Date().toISOString() });
      results.push({ business: b.slug, ...r });
    } catch (e) {
      console.error(b.slug, e);
      results.push({ business: b.slug, error: String(e.message || e) });
    }
  }
  console.log("send-checklists", ws, JSON.stringify(results));
  return json({ week: ws, results });
};
