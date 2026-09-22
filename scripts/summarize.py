#!/usr/bin/env python3
"""Rebuild and check the roaming dashboard from data/enrichment.json.

Partner names and TADIGs come from the sanitized Olympics partner set.
Checklist letters are a readiness sketch derived from agreement, IR.21, and
tracks — not a live node extract. IR.25 cases and SIGOS cards are copied
through as illustrative examples. The script rejects IP addresses, IMSIs,
MSISDNs, and unexpected email addresses.

Usage:
  python3 scripts/summarize.py
  python3 scripts/summarize.py --check
  python3 scripts/summarize.py --write
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA_PATH = ROOT / "data" / "program.json"
ENRICHMENT_PATH = ROOT / "data" / "enrichment.json"
SUMMARY_PATH = ROOT / "data" / "summary.json"
HTML_PATH = ROOT / "index.html"
README_PATH = ROOT / "README.md"

DIRECTIONS = ("inbound", "outbound")
AGREEMENT_STATUSES = {"negotiation", "signed", "live"}
IR21_STATUSES = {"pending", "in_progress", "validated"}
COMPLETED = {"signed", "live"}
NODE_STATUSES = {"not_started", "in_progress", "done", "blocked"}
MILESTONE_STATUSES = {"done", "in_progress", "not_started"}
TRACKS = [
    {"id": "3G", "label": "3G"},
    {"id": "LTE", "label": "LTE"},
    {"id": "VoLTE", "label": "VoLTE"},
    {"id": "R-IN", "label": "R-IN"},
    {"id": "R-OUT", "label": "R-OUT"},
    {"id": "IR25", "label": "IR.25"},
    {"id": "toll", "label": "Toll"},
]
TRACK_IDS = {item["id"] for item in TRACKS}
REGIONS = {
    "United Kingdom": "Europe",
    "Austria": "Europe",
    "Belgium": "Europe",
    "Croatia": "Europe",
    "Denmark": "Europe",
    "Luxembourg": "Europe",
    "Poland": "Europe",
    "Switzerland": "Europe",
    "Spain": "Europe",
    "Germany": "Europe",
    "Canada": "Americas",
    "Mexico": "Americas",
    "China": "Asia-Pacific",
    "Japan": "Asia-Pacific",
    "South Korea": "Asia-Pacific",
}
REGION_ORDER = ["Europe", "Americas", "Asia-Pacific"]
IR21_CODE = {"validated": "D", "in_progress": "P", "pending": "N"}
SIGOS_SCRIPTS = {
    "IMS_REGISTER_OK",
    "VOLTE_EMERGENCYCALL",
    "VOLTE_MO_MT_CALL",
    "SMS_MO_MT",
}
ALLOWED_EMAIL = "minassianelie@gmail.com"
DISCLAIMER = (
    "Portfolio demo — fictional data, not real operator agreements or live configs"
)

IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
EMAIL_RE = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
IMSI_RE = re.compile(r"\b\d{14,16}\b")
MSISDN_RE = re.compile(r"(?<!\d)(?:\+|00)\d{8,15}(?!\d)")
FORBIDDEN_KEYS = {"msisdn", "imsi", "imei", "ki", "opc", "password", "passwd"}


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def pct(part: int, whole: int) -> float:
    if whole == 0:
        return 0.0
    return round(100.0 * part / whole, 2)


def agreement_pct(status: str) -> int:
    if status in COMPLETED:
        return 100
    if status == "negotiation":
        return 40
    return 0


def directions_for(raw: str) -> list[str]:
    if raw == "both":
        return ["inbound", "outbound"]
    return [raw]


def node_code(partner: dict) -> str:
    """Sketch checklist state from public status fields only."""
    tracks = set(partner["tracks"])
    agreement = partner["agreement"]
    if agreement == "live":
        core = "D"
    elif agreement == "signed":
        core = "P"
    else:
        core = "N"
    steering = "P" if agreement == "negotiation" else core
    apn = "P" if agreement == "negotiation" else core
    if "VoLTE" in tracks:
        ims = {"live": "D", "signed": "P"}.get(agreement, "N")
    else:
        ims = "N"
    if "IR25" in tracks:
        sigos = "D" if agreement == "live" else "P"
    elif "VoLTE" in tracks and agreement in COMPLETED:
        sigos = "P"
    else:
        sigos = "N"
    return IR21_CODE[partner["ir21"]] + steering + apn + (core * 4) + ims + sigos


def build_partner(raw: dict) -> dict:
    directions = directions_for(raw["direction"])
    return {
        "id": raw["id"],
        "name": raw["name"],
        "country": raw["country"],
        "region": REGIONS[raw["country"]],
        "tadig": raw["tadig"],
        "demo": True,
        "directions": directions,
        "tracks": list(raw["tracks"]),
        "ir21_status": raw["ir21"],
        "agreement_status": raw["agreement"],
        "agreement_pct": agreement_pct(raw["agreement"]),
        "nodes": node_code(raw),
        "checklist_note": "derived",
    }


def direction_rows(partners: list[dict], direction: str) -> list[dict]:
    return [partner for partner in partners if direction in partner["directions"]]


def metrics_for(partners: list[dict], direction: str, checklist_len: int) -> dict:
    rows = direction_rows(partners, direction)
    total = len(rows)
    agreements = sum(1 for row in rows if row["agreement_status"] in COMPLETED)
    ir21 = sum(1 for row in rows if row["ir21_status"] == "validated")
    tracks = {
        track["id"]: sum(1 for row in rows if track["id"] in row["tracks"]) for track in TRACKS
    }
    done = 0
    for row in rows:
        done += sum(1 for char in row["nodes"] if char == "D")
    cells = total * checklist_len
    return {
        "direction": direction,
        "lines": total,
        "agreements_completed": agreements,
        "agreements_pct": pct(agreements, total),
        "ir21_validated": ir21,
        "ir21_pct": pct(ir21, total),
        "tracks": tracks,
        "track_pct": {key: pct(value, total) for key, value in tracks.items()},
        "checklist_done": done,
        "checklist_total": cells,
        "checklist_pct": pct(done, cells),
    }


def illustrative_progress(inbound_final: float, outbound_final: float) -> list[dict]:
    months: list[str] = []
    year, month = 2023, 3
    while (year, month) <= (2024, 6):
        months.append(f"{year:04d}-{month:02d}")
        month += 1
        if month == 13:
            month = 1
            year += 1
    last_in = 0.0
    last_out = 0.0
    series = []
    last = len(months) - 1
    for index, label in enumerate(months):
        if index == last:
            inbound, outbound = inbound_final, outbound_final
        else:
            weight = (index / last) ** 1.4
            inbound = max(round(inbound_final * weight, 2), last_in)
            outbound = max(round(outbound_final * weight, 2), last_out)
        last_in, last_out = inbound, outbound
        series.append({"month": label, "inbound": inbound, "outbound": outbound})
    return series


def build_view(existing: dict, enrichment: dict) -> dict:
    partners = [build_partner(raw) for raw in enrichment["partners"]]
    inbound = metrics_for(partners, "inbound", len(existing["checklist"]))
    outbound = metrics_for(partners, "outbound", len(existing["checklist"]))
    program = json.loads(json.dumps(existing))
    program["partners"] = partners
    program["progress"] = illustrative_progress(
        inbound["agreements_pct"], outbound["agreements_pct"]
    )
    program["tracks"] = TRACKS
    program.pop("technologies", None)
    program["ir25_test_examples"] = enrichment["ir25_test_examples"]
    program["sigos_examples"] = enrichment["sigos_examples"]
    meta = program["meta"]
    meta["region_order"] = REGION_ORDER
    meta["partner_count"] = len(partners)
    meta["disclaimer"] = DISCLAIMER
    meta.pop("plmn_note", None)
    meta["tadig_note"] = (
        "TADIG codes are the public operator codes from the Olympics roaming partner set. "
        "Checklist letters are a readiness sketch derived from agreement, IR.21, and tracks, "
        "not a live node extract."
    )
    meta["examples_note"] = (
        "IR.25 tables and SIGOS cards are illustrative examples derived from IR.25 S8HR "
        "structure and SIGOS-style test scripts (IMS register, emergency 112, MO/MT, SMS), "
        "not live exports."
    )
    meta["kpi_definition"] = (
        "An agreement is completed when its status is signed or live. "
        "Percentages use direction lines: a partner marked both is counted inbound and outbound."
    )
    for tool in program.get("tools", []):
        if tool.get("id") == "sigos":
            tool["summary"] = (
                "Active test platform (SITE / GlobalRoamer family) used for probe-based "
                "roaming tests. The SIGOS cards on this page are illustrative script examples "
                "(IMS register, emergency 112, MO/MT voice, SMS), not a live export and not a screenshot of a production UI."
            )
    return program


def scan_secrets(label: str, text: str) -> list[str]:
    errors = []
    if IP_RE.search(text):
        errors.append(f"{label} contains an IP address")
    if IMSI_RE.search(text):
        errors.append(f"{label} contains a 14–16 digit identifier")
    if MSISDN_RE.search(text):
        errors.append(f"{label} contains a phone-number pattern")
    for email in EMAIL_RE.findall(text):
        if email.lower() != ALLOWED_EMAIL:
            errors.append(f"{label} contains unexpected email {email}")
    return errors


def scan_keys(label: str, value, path: str = "") -> list[str]:
    errors = []
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in FORBIDDEN_KEYS:
                errors.append(f"{label} has forbidden field {path}.{key}")
            errors.extend(scan_keys(label, child, f"{path}.{key}"))
    elif isinstance(value, list):
        for index, child in enumerate(value):
            errors.extend(scan_keys(label, child, f"{path}[{index}]"))
    return errors


def validate(program: dict, enrichment: dict, rebuilt: dict) -> list[str]:
    errors: list[str] = []
    for label, blob in (
        ("enrichment.json", json.dumps(enrichment)),
        ("program.json", DATA_PATH.read_text(encoding="utf-8")),
    ):
        errors.extend(scan_secrets(label, blob))
    errors.extend(scan_keys("enrichment.json", enrichment))
    errors.extend(scan_keys("program.json", program))
    if len(enrichment["partners"]) != 21:
        errors.append("enrichment must list 21 partners")
    if program.get("partners") != rebuilt["partners"]:
        errors.append("program.json partners are not derived from enrichment.json")
    if program.get("progress") != rebuilt["progress"]:
        errors.append("program.json progress curve does not match the partner set")
    if program.get("ir25_test_examples") != enrichment["ir25_test_examples"]:
        errors.append("IR.25 examples drifted from enrichment.json")
    if program.get("sigos_examples") != enrichment["sigos_examples"]:
        errors.append("SIGOS examples drifted from enrichment.json")
    if "Partner-" in json.dumps(program["partners"]):
        errors.append("synthetic Partner- ids are still in the register")
    names = {partner["name"] for partner in program["partners"]}
    for required in ("3 UK (Hutchison)", "NTT DOCOMO (inbound VoLTE)", "Swisscom (inbound VoLTE)", "Telefónica", "China Mobile", "Bell Canada"):
        if required not in names:
            errors.append(f"missing partner {required}")
    ir25_names = {item["partner"] for item in program["ir25_test_examples"]}
    for required in ("NTT DOCOMO", "Magenta Telekom (Austria)", "3 UK Hutchison"):
        if required not in ir25_names:
            errors.append(f"missing IR.25 example {required}")
    scripts = {item["script"] for item in program["sigos_examples"]}
    if scripts != SIGOS_SCRIPTS:
        errors.append(f"SIGOS scripts must be {sorted(SIGOS_SCRIPTS)}")
    seen = set()
    for raw in enrichment["partners"]:
        if raw["id"] in seen:
            errors.append(f"duplicate id {raw['id']}")
        seen.add(raw["id"])
        if raw["country"] not in REGIONS:
            errors.append(f"no region for {raw['country']}")
        if raw["agreement"] not in AGREEMENT_STATUSES:
            errors.append(f"{raw['id']} agreement")
        if raw["ir21"] not in IR21_STATUSES:
            errors.append(f"{raw['id']} IR.21")
        if raw["direction"] not in {"inbound", "outbound", "both"}:
            errors.append(f"{raw['id']} direction")
        if any(track not in TRACK_IDS for track in raw["tracks"]):
            errors.append(f"{raw['id']} has an unknown track")
        code = node_code(raw)
        if len(code) != 9 or any(char not in "DPBN" for char in code):
            errors.append(f"{raw['id']} node sketch")
    inbound = metrics_for(program["partners"], "inbound", len(program["checklist"]))
    outbound = metrics_for(program["partners"], "outbound", len(program["checklist"]))
    progress = program["progress"]
    if not program["meta"]["snapshot_date"].startswith(progress[-1]["month"]):
        errors.append("snapshot date must fall in the last progress month")
    for direction, metrics in (("inbound", inbound), ("outbound", outbound)):
        series = [point[direction] for point in progress]
        if any(later < earlier for earlier, later in zip(series, series[1:])):
            errors.append(f"{direction} progress goes backwards")
        if abs(series[-1] - metrics["agreements_pct"]) > 0.02:
            errors.append(
                f"{direction} progress ends at {series[-1]} but agreements are {metrics['agreements_pct']}"
            )
    for milestone in program["milestones"]:
        if milestone["status"] not in MILESTONE_STATUSES:
            errors.append(f"milestone {milestone['id']} status")
    html = HTML_PATH.read_text(encoding="utf-8")
    readme = README_PATH.read_text(encoding="utf-8")
    for label, blob in (("index.html", html), ("README.md", readme)):
        if DISCLAIMER not in blob:
            errors.append(f"{label} is missing the demo disclaimer")
        if "Bouygues Telecom" not in blob:
            errors.append(f"{label} should name Bouygues Telecom")
        if ALLOWED_EMAIL not in blob:
            errors.append(f"{label} is missing the contact email")
        if "Olympics 2024 Roaming Program" not in blob:
            errors.append(f"{label} is missing the program title")
        if "not an official" not in blob.lower():
            errors.append(f"{label} should say this is not an official Bouygues publication")
        if "illustrative" not in blob.lower():
            errors.append(f"{label} should say IR.25 and SIGOS examples are illustrative")
    if "IR.25 / S8HR test examples" not in html or "SIGOS active testing examples" not in html:
        errors.append("index.html is missing the IR.25 or SIGOS example sections")
    if "https://e-mination.github.io/paris-olympics-2024-roaming-volte/" not in readme:
        errors.append("README is missing the live dashboard URL")
    if "RoamSys" not in readme or "SIGOS" not in readme or "IR.25" not in readme:
        errors.append("README should mention RoamSys, SIGOS, and IR.25")
    if "confidential" not in readme.lower() and "not live exports" not in readme.lower():
        errors.append("README should state that confidential live exports are not included")
    legend = set(program["node_legend"].values())
    if legend != NODE_STATUSES:
        errors.append("node legend drifted")
    return errors


def format_report(partners: list[dict], checklist_len: int) -> str:
    lines = [
        "Olympics 2024 Roaming Program",
        f"Partners: {len(partners)}",
        "",
    ]
    for direction in DIRECTIONS:
        metrics = metrics_for(partners, direction, checklist_len)
        lines.append(direction.upper())
        lines.append(
            f"  Agreements completed: {metrics['agreements_completed']}/{metrics['lines']} ({metrics['agreements_pct']}%)"
        )
        lines.append(
            f"  IR.21 validated: {metrics['ir21_validated']}/{metrics['lines']} ({metrics['ir21_pct']}%)"
        )
        track_bits = ", ".join(
            f"{key} {metrics['tracks'][key]}/{metrics['lines']}" for key in metrics["tracks"]
        )
        lines.append(f"  Tracks: {track_bits}")
        lines.append(
            f"  Checklist sketch done: {metrics['checklist_done']}/{metrics['checklist_total']} ({metrics['checklist_pct']}%)"
        )
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main(argv: list[str]) -> int:
    enrichment = load_json(ENRICHMENT_PATH)
    existing = load_json(DATA_PATH)
    rebuilt = build_view(existing, enrichment)
    if "--write" in argv:
        DATA_PATH.write_text(
            json.dumps(rebuilt, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        existing = rebuilt
        print(f"Wrote {DATA_PATH.relative_to(ROOT)}", file=sys.stderr)
    program = load_json(DATA_PATH)
    rebuilt = build_view(existing if "--write" not in argv else program, enrichment)
    # After --write, existing in memory is rebuilt; reload comparison from disk.
    if "--write" in argv:
        program = load_json(DATA_PATH)
        rebuilt = build_view(program, enrichment)
        # build_view copies program then overwrites derived fields, so a second
        # pass matches. Checklist length is unchanged.
    errors = validate(program, enrichment, rebuilt)
    sys.stdout.write(format_report(rebuilt["partners"], len(program["checklist"])))
    if "--write" in argv and not errors:
        summary = {
            "partners": len(rebuilt["partners"]),
            "directions": {
                direction: metrics_for(rebuilt["partners"], direction, len(program["checklist"]))
                for direction in DIRECTIONS
            },
        }
        if "--summary" in argv:
            SUMMARY_PATH.write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
