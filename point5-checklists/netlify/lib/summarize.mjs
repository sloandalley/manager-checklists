// Turns a submitted checklist into an owner summary + urgent flags using the Claude API.
import { env, sb, fmtWeek, countItems, countDone } from "./lib.mjs";

function renderResponses(template, progress) {
  const items = progress?.items || {};
  const lines = [];
  for (const s of template.sections || []) {
    lines.push(`\n## ${s.title}`);
    for (const it of s.items || []) {
      const p = items[it.id] || {};
      let status;
      if (it.type === "check") status = p.done ? "[done]" : "[NOT done]";
      else if (it.type === "pass") status = p.value === "pass" ? "[PASS]" : p.value === "ni" ? "[NEEDS IMPROVEMENT]" : "[not answered]";
      else status = p.value === undefined || p.value === "" || p.value === null ? "[no answer]" : `= ${p.value}${it.unit ? " " + it.unit : ""}`;
      let line = `- ${it.label} ${status}`;
      if (p.flag) line += "  ⚑ MANAGER FLAGGED FOR OWNER";
      if (p.note) line += `\n    note: ${p.note}`;
      lines.push(line);
    }
  }
  if (progress?.notes) lines.push(`\n## Manager's closing notes\n${progress.notes}`);
  return lines.join("\n");
}

export async function summarizeWeek(business, week, { force = false } = {}) {
  if (week.status !== "submitted") return { skipped: "not submitted" };
  if (week.summary && !force) return { skipped: "already summarized" };
  const template = week.template_snapshot || business.template;
  const total = countItems(template), done = countDone(template, week.progress);

  const prompt = `You are the operations assistant for Sloan, who owns eight family entertainment businesses (roller skating, escape rooms, axe throwing, go-kart raceway, glow games). A location manager just submitted their weekly checklist. Write what Sloan needs to know in under a minute of reading.

Business: ${business.name} (${business.location || ""}) — manager: ${business.manager_name || "unknown"}
Week: ${fmtWeek(week.week_start)}
Completion: ${done} of ${total} items completed.

Checklist responses:
${renderResponses(template, week.progress)}

Return ONLY a JSON object with this exact shape:
{
  "rating": "green" | "yellow" | "red",
  "headline": "one sentence, max 20 words, the single most important takeaway",
  "summary": "3-6 sentences of plain prose. Cover: what got done, what didn't, notable numbers, and anything the manager wrote in notes. No bullet points.",
  "flags": [ { "title": "short", "detail": "one or two sentences with the specifics the manager gave", "urgency": "urgent" | "soon" | "fyi" } ],
  "wins": [ "short phrase", ... ]
}
Rules for flags: every item marked NEEDS IMPROVEMENT gets a flag (use its note for the detail); anything the manager flagged ⚑ is at least "soon"; safety, legal, equipment-down, staffing gaps, cash discrepancies, or customer complaints are "urgent"; unchecked routine items are "fyi" unless a pattern suggests a real problem. Rating is red if any urgent flag exists, yellow if any "soon" flag or completion under 70%, otherwise green. Do not invent facts — if something is unclear, say the manager did not specify. Keep wins to 0-3 items.`;

  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": env("ANTHROPIC_API_KEY"),
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env("ANTHROPIC_MODEL", "claude-sonnet-4-5"),
      max_tokens: 1200,
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!r.ok) throw new Error(`Anthropic ${r.status}: ${await r.text()}`);
  const data = await r.json();
  const text = (data.content || []).map((c) => c.text || "").join("");
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Summary was not valid JSON: " + text.slice(0, 200));
    parsed = JSON.parse(m[0]);
  }
  const rating = ["green", "yellow", "red"].includes(parsed.rating) ? parsed.rating : "yellow";
  const flags = Array.isArray(parsed.flags) ? parsed.flags : [];
  const [updated] = await sb.patch(`weeks?id=eq.${week.id}`, {
    summary: parsed.summary || "",
    headline: parsed.headline || "",
    rating,
    flags,
    wins: Array.isArray(parsed.wins) ? parsed.wins : [],
    summarized_at: new Date().toISOString(),
  });
  return { ok: true, week: updated };
}
