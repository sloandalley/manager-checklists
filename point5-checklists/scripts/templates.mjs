// Checklist definitions.
// The 8 business checklists come from Sloan's Customer Experience Checklist documents,
// imported into templates/<slug>.json by scripts/import-docx.py. Edit those JSON files (or edit
// from the dashboard) — the two role checklists below are defined inline.
import { readFileSync } from "node:fs";
const C = (id, label, hint) => ({ id, label, type: "check", ...(hint ? { hint } : {}) });
const N = (id, label, unit, hint) => ({ id, label, type: "number", ...(unit ? { unit } : {}), ...(hint ? { hint } : {}) });
const T = (id, label, hint) => ({ id, label, type: "text", ...(hint ? { hint } : {}) });

const fromFile = (slug) => JSON.parse(readFileSync(new URL(`../templates/${slug}.json`, import.meta.url), "utf8"));

export const businesses = [
  { slug: "deleta-skating",           name: "Deleta Skating",            location: "Pocatello, ID",  template: fromFile("deleta-skating") },
  { slug: "deleta-escape-rooms",      name: "Deleta Escape Rooms",       location: "Pocatello, ID",  template: fromFile("deleta-escape-rooms") },
  { slug: "heber-hatchets-spokane",   name: "Heber Hatchets Spokane",    location: "Spokane, WA",    template: fromFile("heber-hatchets-spokane") },
  { slug: "heber-hatchets-pocatello", name: "Heber Hatchets Pocatello",  location: "Pocatello, ID",  template: fromFile("heber-hatchets-pocatello") },
  { slug: "heber-hatchets-provo",     name: "Heber Hatchets Provo",      location: "Provo, UT",      template: fromFile("heber-hatchets-provo") },
  { slug: "glow-games",               name: "Glow Games",                location: "Twin Falls, ID", template: fromFile("glow-games") },
  { slug: "get-out-games",            name: "GetOut Games Provo",        location: "Provo, UT",      template: fromFile("get-out-games") },
  { slug: "brass-city-raceway",       name: "Brass City Raceway",        location: "Waterbury, CT",  template: fromFile("brass-city-raceway") },
  // ---------- Role-based checklists (not tied to one location) ----------
  {
    slug: "social-media", name: "Social Media Coordinator", location: "All 8 businesses",
    template: { sections: [
      { title: "Daily posting (per the weekly posting checklist)", items: [
        C("sm_tiktok", "TikTok: one post per day for every business", "Uncheck and note which businesses/days were missed"),
        C("sm_ig", "Instagram: one post per day for every business"),
        C("sm_fb", "Facebook: one post per day for every business"),
        C("sm_yt", "YouTube: one post per day for every business"),
        N("sm_missed", "Total scheduled posts that did NOT go out this week", "posts"),
        C("sm_gbp", "2 Google Business Profile posts published for every business"),
      ]},
      { title: "Weekly framework", items: [
        C("sm_focus", "This week's 3 marketing focuses posted across every business"),
        C("sm_trends", "2 easy trends of the week produced and posted"),
        C("sm_tag", "Weekly tag-a-friend post went out for every business"),
        C("sm_email", "Weekly marketing emails sent (Square for 5 brands, SendGrid for Brass City)"),
        C("sm_monthly", "Monthly focus content is on track / ready for the paid Meta ads"),
        C("sm_nextweek", "Next week's plan pulled and content queued", "Ask Sloan/Claude for the filled-in weekly plan if it's not done"),
      ]},
      { title: "Engagement & reviews", items: [
        C("sm_dms", "All DMs and comments across every business answered within 24 hours"),
        C("sm_reviews", "Every new Google/Facebook review replied to for every business"),
        N("sm_negative", "Negative reviews or public complaints this week", "reviews", "Flag anything that needs Sloan's response"),
        C("sm_ugc", "Customer tags / user-generated content reshared"),
      ]},
      { title: "Content & media library", items: [
        C("sm_library", "New photos/video from the locations filed into the content library"),
        T("sm_gaps", "Which businesses are short on usable media? What do you need filmed?"),
        C("sm_ads", "Checked that the Meta ads are running (no rejected ads, no paused campaigns)"),
      ]},
      { title: "Results", items: [
        T("sm_top", "Top-performing post of the week (business, platform, why it worked)"),
        T("sm_flop", "Biggest flop and what you'd change"),
        N("sm_followers", "Net new followers across all accounts (rough total)", "followers"),
        T("sm_needs", "What do you need from Sloan to do this job better next week?"),
      ]},
    ]},
  },
  {
    // From Sloan's "Weekly Checklists" PDF for the executive assistant — labels kept as written.
    slug: "executive-assistant", name: "Executive Assistant", location: "Point 5 Fun",
    template: { sections: [
      { title: "Overall", items: [
        C("ea_email", "Clear Sloan's email"),
        C("ea_rent_payroll", "Double check rent and payroll"),
        C("ea_social", "Week of social media posts"),
        C("ea_call", "Call with Sloan after manager check-ins"),
      ]},
      { title: "Deleta", items: [
        C("de_payroll", "Payroll"),
        C("de_contractors", "Payroll for Contractors"),
        C("de_bizdoc", "Business Doc"),
        C("de_salestax", "Sales tax"),
        C("de_partywirks", "Monthly partywirks contacts"),
        C("de_checklist", "Manager's Checklist", "Reviewed on the dashboard"),
        C("de_checkin", "Call/Text check in with manager to review checklist"),
      ]},
      { title: "Glow Games", items: [
        C("gg_payroll", "Payroll"),
        C("gg_bizdoc", "Business Doc"),
        C("gg_salestax", "Sales tax"),
        C("gg_checklist", "Manager's Checklist"),
        C("gg_checkin", "Call/Text check in with manager to review checklist"),
      ]},
      { title: "Get Out Games", items: [
        C("go_payroll", "Submit Payroll"),
        C("go_checklist", "Manager's Checklist"),
        C("go_checkin", "Call/Text check in with manager to review checklist"),
      ]},
      { title: "Hatchets", items: [
        C("hh_rent", "Rent (3 locations)"),
        C("hh_payroll", "Submit Payroll"),
        C("hh_provo_checklist", "Provo Manager's Checklist"),
        C("hh_poc_checklist", "Pocatello Manager's Checklist"),
        C("hh_spo_checklist", "Spokane Manager's Checklist"),
        C("hh_provo_checkin", "Call/Text check in with Provo manager to review checklist"),
        C("hh_poc_checkin", "Call/Text check in with Pocatello manager to review checklist"),
        C("hh_spo_checkin", "Call/Text check in with Spokane manager to review checklist"),
      ]},
      { title: "Brass City", items: [
        C("bc_payroll", "Payroll"),
        C("bc_myconnect", "myconneCT"),
        C("bc_checklist", "Manager's Checklist"),
        C("bc_checkin", "Call/Text check in with manager to review checklist"),
      ]},
      { title: "For Sloan", items: [
        T("ea_escalate", "Anything from the manager check-ins that needs Sloan's attention this week?"),
        T("ea_blocked", "What's stuck or waiting on Sloan?"),
      ]},
    ]},
  },
];

// Sanity check: unique item ids within each business.
for (const b of businesses) {
  const seen = new Set();
  for (const s of b.template.sections) for (const it of s.items) {
    if (seen.has(it.id)) throw new Error(`Duplicate item id ${it.id} in ${b.slug}`);
    seen.add(it.id);
  }
}
