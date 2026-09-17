"""Converts the Customer Experience Checklist .docx files into templates/<slug>.json.

Usage:  python3 scripts/import-docx.py <folder with the .docx files>
Then:   node scripts/build-seed.mjs

Rules: numbered headings ("1. First Impression…") start a section; each table row's first cell is an item
(Pass / Needs Improvement); "Manager Operations" task lists become tick boxes; the Weekly Summary table
becomes short-answer questions; sample answers/notes in the drafts are NOT carried over.
"""
import json, re, sys, zipfile, pathlib
from xml.etree import ElementTree as ET

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
W = "{%s}" % NS["w"]
SLUGS = {
    "brass city": "brass-city-raceway", "deleta escape": "deleta-escape-rooms", "deleta": "deleta-skating",
    "getout": "get-out-games", "get out": "get-out-games", "glow": "glow-games",
    "pocatello": "heber-hatchets-pocatello", "provo": "heber-hatchets-provo", "spokane": "heber-hatchets-spokane",
}
SKIP_LABELS = {"customer experience item", "overall weekly result", "issue / opportunity", "issue / fix needed", ""}

def text(el):
    return "".join(t.text or "" for t in el.iter(W + "t")).strip()

def slug_for(name):
    n = name.lower().replace("_", " ")
    if "heber" in n:
        for k in ("pocatello", "provo", "spokane"):
            if k in n: return SLUGS[k]
    for k in ("brass city", "deleta escape", "getout", "get out", "glow", "deleta"):
        if k in n: return SLUGS[k]
    raise SystemExit(f"Don't know which business {name} is")

def convert(path):
    root = ET.fromstring(zipfile.ZipFile(path).read("word/document.xml"))
    body = root.find("w:body", NS)
    sections, cur, mode = [], None, None
    for el in body:
        tag = el.tag.replace(W, "")
        if tag == "p":
            t = text(el)
            m = re.match(r"^(\d+)\.\s+(.+)$", t)
            if m:
                title = m.group(2).strip()
                mode = "text" if "summary" in title.lower() else ("check" if "manager operations" in title.lower() else "pass")
                cur = {"title": title, "items": []}; sections.append(cur)
            elif re.match(r"^(weekly summary|weekly summary / priorities)$", t, re.I):
                mode = "text"; cur = {"title": "Weekly summary", "items": []}; sections.append(cur)
            elif re.match(r"^action items", t, re.I):
                mode = "action"; cur = {"title": "Action items", "items": [{"id": "actions", "type": "text",
                    "label": "Action items for next week — issue, owner, due date", "hint": "One per line"}]}; sections.append(cur)
            elif cur and mode == "pass" and t and not t.lower().startswith(("editing tip", "use this checklist", "instructions", "pass / fail guide")) and len(t) > 12:
                cur["items"].append({"label": t, "type": "check"})  # stray line inside a section (e.g. "Every video is posted…")
        elif tag == "tbl" and cur and mode in ("pass", "check", "text"):
            for tr in el.iter(W + "tr"):
                cells = [text(tc) for tc in tr.findall("w:tc", NS)]
                label = re.sub(r"_+", "", cells[0]).strip() if cells else ""
                if label.lower() in SKIP_LABELS or label.lower().startswith("checklist date"): continue
                if mode == "text":
                    label = re.sub(r"\s*1\.\s*2\.\s*3\.\s*$", "", label).strip()
                    if label.lower().startswith("would a first-time guest"):
                        label = "Would a first-time guest likely return? Why or why not?"
                cur["items"].append({"label": label, "type": mode})
    sections = [s for s in sections if s["items"]]
    for si, s in enumerate(sections, 1):
        for ii, it in enumerate(s["items"], 1):
            it.setdefault("id", f"s{si}_{ii}")
            it["hint"] = it.get("hint") or ("" if it["type"] != "pass" else "")
            if not it["hint"]: it.pop("hint")
    return {"sections": sections}

folder = pathlib.Path(sys.argv[1] if len(sys.argv) > 1 else ".")
out = pathlib.Path(__file__).resolve().parent.parent / "templates"; out.mkdir(exist_ok=True)
for f in sorted(folder.glob("*.docx")):
    slug = slug_for(f.name)
    tpl = convert(f)
    (out / f"{slug}.json").write_text(json.dumps(tpl, indent=2) + "\n")
    n = sum(len(s["items"]) for s in tpl["sections"])
    print(f"{f.name} -> templates/{slug}.json  ({len(tpl['sections'])} sections, {n} items)")
