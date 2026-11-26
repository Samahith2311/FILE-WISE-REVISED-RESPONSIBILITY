"""Build src/data/seed.json from scripts/allocation.docx.

Usage:  python scripts/build_seed.py
Needs:  pip install python-docx

The docx has three tables (A-Files, D-Files, P-Files) with columns:
File | File content | Current maintenance | Previous maintenance (if changed) |
Current presentation | Previous presentation (if changed) | Related criteria
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

try:
    import docx  # python-docx
except ImportError:  # pragma: no cover
    sys.exit("python-docx is missing. Run: pip install python-docx")

ROOT = Path(__file__).resolve().parent.parent
DOCX = ROOT / "scripts" / "allocation.docx"
OUT = ROOT / "src" / "data" / "seed.json"

DOMAINS = [
    {"id": "D", "name": "Department", "range": "D01 to D33"},
    {"id": "A", "name": "Academic", "range": "A01 to A52"},
    {"id": "P", "name": "Program", "range": "P01 to P28"},
]

# D13 is not a row in the docx. It is a container for the A files.
D13 = {
    "code": "D13",
    "title": "Academic files",
    "note": "Container for A01 to A52. Its score is the average of the A files.",
}

PROPOSED_TITLE = re.compile(r"\s*\(proposed part title\)\s*", re.IGNORECASE)
PROPOSED = re.compile(r"\s*\(proposed\)\s*$", re.IGNORECASE)
CRITERIA = re.compile(r"\bC([1-9])\b")

# ---------------------------------------------------------------------------
# Starter checklists, picked by keywords in the title. First match wins.
# The admin edits these in the app.
# ---------------------------------------------------------------------------
CHECKLISTS: list[tuple[str, list[str], list[str]]] = [
    (
        "register",
        [
            "register", "stock", "consumable", "asset", "inventory", "first aid",
            "fire extinguisher", "calibration", "licen", "area", "library", "accounts",
            "purchase", "budget",
        ],
        [
            "Register opened for the academic year",
            "Entries up to date and signed",
            "Periodic verification done and recorded",
            "Discrepancies resolved and reported to HoD",
        ],
    ),
    (
        "meeting",
        [
            "meeting", "committee", "circular", "notice", "correspondence", "dac",
            "dec", "board of", "bos", "proceedings", "mentoring", "counselling",
            "association", "requisition",
        ],
        [
            "Constitution or order copy filed",
            "Notices and circulars filed in date order",
            "Minutes or proceedings recorded and signed",
            "Action taken report filed",
        ],
    ),
    (
        "policy",
        [
            "policy", "syllabus", "vision", "mission", "rules", "handbook", "sop",
            "code of conduct", "scheme", "curriculum", "peo", "pso", "philosophy",
            "electives", "calendar", "timetable", "introduction",
        ],
        [
            "Current approved version filed",
            "Approval record from the competent authority attached",
            "Dissemination evidence filed",
            "Review and revision history recorded",
        ],
    ),
    (
        "report",
        [
            "report", "analysis", "attainment", "result", "audit", "assessment",
            "marks", "review", "performance", "rubric", "cie", "evidence",
        ],
        [
            "Data collected for the period",
            "Analysis prepared",
            "Report reviewed and signed by HoD",
            "Corrective actions documented",
        ],
    ),
]
DEFAULT_CHECKLIST = (
    "default",
    [
        "Index sheet and contents page prepared",
        "Documents collected for the period",
        "Evidence verified by the maintainer",
        "File reviewed and signed by HoD",
    ],
)


def clean(text: str) -> str:
    """Normalise whitespace and treat dash-only cells as empty."""
    text = re.sub(r"\s+", " ", (text or "").replace(" ", " ")).strip()
    if re.fullmatch(r"[-‐-―−\s]*", text):
        return ""
    return text


def split_presentation(text: str) -> dict:
    """'C5 — Harish H K' -> {criteria: 'C5', person: 'Harish H K', proposed: False}."""
    text = clean(text)
    if not text:
        return {"criteria": "", "person": "", "proposed": False}
    proposed = bool(PROPOSED.search(text))
    text = PROPOSED.sub("", text)
    m = re.match(r"^(C[1-9])\s*[-‐-―]\s*(.+)$", text)
    if m:
        return {"criteria": m.group(1), "person": m.group(2).strip(), "proposed": proposed}
    return {"criteria": "", "person": text, "proposed": proposed}


def related(text: str) -> list[str]:
    return sorted({f"C{n}" for n in CRITERIA.findall(clean(text))}, key=lambda c: int(c[1:]))


def keyword_hit(keyword: str, title: str) -> bool:
    """Match at a word start. Short keywords (4 letters or fewer) must be whole words."""
    tail = r"\b" if len(keyword) <= 4 else ""
    return re.search(r"\b" + re.escape(keyword) + tail, title) is not None


def pick_checklist(title: str) -> tuple[str, list[str]]:
    t = title.lower()
    for kind, keywords, items in CHECKLISTS:
        if any(keyword_hit(k, t) for k in keywords):
            return kind, items
    return DEFAULT_CHECKLIST


def code_key(code: str) -> tuple[int, int]:
    m = re.match(r"^[ADP](\d+)(?:\.(\d+))?$", code)
    if not m:
        raise ValueError(f"Unexpected file code: {code}")
    return int(m.group(1)), int(m.group(2) or 0)


def read_table(table, domain: str) -> list[dict]:
    rows = []
    for row in table.rows[1:]:  # skip header
        cells = [c.text for c in row.cells]
        code = clean(cells[0])
        if not code:
            continue
        if not code.startswith(domain):
            raise ValueError(f"{code} found in the {domain} table")
        raw_title = clean(cells[1])
        proposed_title = bool(PROPOSED_TITLE.search(raw_title))
        title = PROPOSED_TITLE.sub(" ", raw_title).strip()
        m = re.match(r"^(P\d+)\.\d+$", code)
        rows.append(
            {
                "id": code,
                "code": code,
                "domain": domain,
                "order": 0,
                "title": title,
                "proposedTitle": proposed_title,
                "group": m.group(1) if m else None,
                "container": None,
                "maintainer": clean(cells[2]),
                "previousMaintainer": clean(cells[3]),
                "presentedIn": split_presentation(cells[4]),
                "previousPresentation": clean(cells[5]),
                "relatedCriteria": related(cells[6]),
                "physicalLocation": "",
                "notes": "",
            }
        )
    rows.sort(key=lambda r: code_key(r["code"]))
    return rows


def main() -> None:
    if not DOCX.exists():
        sys.exit(f"Missing {DOCX}")
    document = docx.Document(str(DOCX))

    by_domain: dict[str, list[dict]] = {}
    for table in document.tables:
        first = clean(table.rows[1].cells[0].text) if len(table.rows) > 1 else ""
        if not first:
            continue
        by_domain[first[0]] = read_table(table, first[0])

    for d in ("A", "D", "P"):
        if d not in by_domain:
            sys.exit(f"No {d}-Files table found in the docx")

    d_files = by_domain["D"]
    if any(f["code"] == "D13" for f in d_files):
        sys.exit("D13 unexpectedly present in docx; update build_seed.py")
    d_files.append(
        {
            "id": "D13",
            "code": "D13",
            "domain": "D",
            "order": 0,
            "title": D13["title"],
            "proposedTitle": False,
            "group": None,
            "container": "A",
            "maintainer": "Lokesh T P, Gagan P",
            "previousMaintainer": "",
            "presentedIn": {"criteria": "", "person": "", "proposed": False},
            "previousPresentation": "",
            "relatedCriteria": [],
            "physicalLocation": "",
            "notes": D13["note"],
        }
    )
    d_files.sort(key=lambda r: code_key(r["code"]))

    files: list[dict] = []
    items: list[dict] = []
    counts = {}
    for domain in ("D", "A", "P"):
        rows = by_domain[domain]
        counts[domain] = len(rows)
        for i, f in enumerate(rows, start=1):
            f["order"] = i
            files.append(f)
            if f["container"]:
                continue  # D13 has no checklist of its own
            kind, labels = pick_checklist(f["title"])
            for n, label in enumerate(labels, start=1):
                items.append(
                    {
                        "id": f"{f['code']}-i{n}",
                        "fileId": f["id"],
                        "order": n,
                        "label": label,
                        "repeating": False,
                        "note": "",
                        "template": kind,
                    }
                )

    expected = {"D": 33, "A": 52, "P": 31}
    if counts != expected:
        sys.exit(f"Row counts {counts} do not match expected {expected}")

    seed = {
        "version": 1,
        "source": "scripts/allocation.docx",
        "academicYear": "2026-27",
        "domains": DOMAINS,
        "files": files,
        "items": items,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(seed, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT.relative_to(ROOT)}: D={counts['D']} A={counts['A']} P={counts['P']}, {len(items)} checklist items")


if __name__ == "__main__":
    main()
