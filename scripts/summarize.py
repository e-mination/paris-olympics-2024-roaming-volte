#!/usr/bin/env python3
"""Recompute roaming-program KPIs from data/program.json.

The dashboard calculates the same figures in the browser. This script is the
checkable source for the snapshot: agreement completion, IR.21, SIGOS, test
pass rates, and node status. It refuses live-looking PLMNs and IP addresses.

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
SUMMARY_PATH = ROOT / "data" / "summary.json"
HTML_PATH = ROOT / "index.html"
README_PATH = ROOT / "README.md"

DIRECTIONS = ("inbound", "outbound")
AGREEMENT_STATUSES = {"not_started", "negotiation", "legal_review", "signed", "live"}
IR21_STATUSES = {"not_requested", "requested", "received", "validated"}
TEST_RESULTS = {"pass", "partial", "fail", "not_run"}
NODE_STATUSES = {"not_started", "in_progress", "done", "blocked"}
MILESTONE_STATUSES = {"done", "in_progress", "not_started"}
CAMPAIGN_RE = re.compile(r"^DEMO-SIGOS-(IN|OUT)-\d{5}$")
PLMN_RE = re.compile(r"^001-\d{2}$")
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")
PLMN_ANY_RE = re.compile(r"\b\d{3}-\d{2,3}\b")
PARTNER_RE = re.compile(r"^Partner-[A-Z]{2}-\d{2}$")

DISCLAIMER = (
    "Portfolio demo — fictional data, not real operator agreements or live configs"
)


def load() -> dict:
    return json.loads(DATA_PATH.read_text(encoding="utf-8"))


def pct(part: int, whole: int) -> float:
    if whole == 0:
        return 0.0
    return round(100.0 * part / whole, 2)


def decode_nodes(raw: str, checklist: list[dict], legend: dict[str, str]) -> list[str]:
    return [legend[ch] for ch in raw]


def direction_rows(data: dict, direction: str) -> list[dict]:
    rows = []
    for partner in data["partners"]:
        rec = partner[direction]
        rows.append({"partner": partner, "direction": direction, "rec": rec})
    return rows


def metrics_for(data: dict, direction: str) -> dict:
    checklist = data["checklist"]
    legend = data["node_legend"]
    completed = set(data["meta"]["completed_agreement_statuses"])
    rows = direction_rows(data, direction)
    total = len(rows)
    agreements = sum(1 for row in rows if row["rec"]["agreement_status"] in completed)
    ir21 = sum(1 for row in rows if row["rec"]["ir21_status"] == "validated")
    sigos_pass = sum(1 for row in rows if row["rec"]["sigos"]["result"] == "pass")
    sigos_tested = sum(1 for row in rows if row["rec"]["sigos"]["result"] != "not_run")
    node_counts: Counter[str] = Counter()
    by_item = []
    for item in checklist:
        by_item.append({"id": item["id"], "short": item["short"], "counts": Counter()})
    blocked = []
    tech_rates = {tech["id"]: [] for tech in data["technologies"]}
    tech_results = {tech["id"]: Counter() for tech in data["technologies"]}
    for row in rows:
        statuses = decode_nodes(row["rec"]["nodes"], checklist, legend)
        for item, status in zip(by_item, statuses):
            item["counts"][status] += 1
            node_counts[status] += 1
            if status == "blocked":
                blocked.append(
                    {
                        "partner": row["partner"]["id"],
                        "direction": direction,
                        "item": item["short"],
                    }
                )
        for tech in data["technologies"]:
            test = row["rec"]["tests"][tech["id"]]
            tech_results[tech["id"]][test["result"]] += 1
            if test["result"] != "not_run" and test["pass_rate"] is not None:
                tech_rates[tech["id"]].append(test["pass_rate"])
    node_total = total * len(checklist)
    return {
        "direction": direction,
        "partners": total,
        "agreements_completed": agreements,
        "agreements_pct": pct(agreements, total),
        "ir21_validated": ir21,
        "ir21_pct": pct(ir21, total),
        "sigos_pass": sigos_pass,
        "sigos_pass_pct": pct(sigos_pass, total),
        "sigos_tested": sigos_tested,
        "checklist_done": node_counts["done"],
        "checklist_total": node_total,
        "checklist_pct": pct(node_counts["done"], node_total),
        "node_counts": dict(node_counts),
        "by_item": [
            {"id": item["id"], "short": item["short"], "counts": dict(item["counts"])}
            for item in by_item
        ],
        "blocked": blocked,
        "tech_mean_pass_rate": {
            key: (round(sum(values) / len(values), 2) if values else None)
            for key, values in tech_rates.items()
        },
        "tech_results": {key: dict(counter) for key, counter in tech_results.items()},
    }


def build_report(data: dict) -> dict:
    return {
        "program": data["meta"]["program"],
        "host_operator": data["meta"]["host_operator"],
        "snapshot_date": data["meta"]["snapshot_date"],
        "partners": len(data["partners"]),
        "directions": {direction: metrics_for(data, direction) for direction in DIRECTIONS},
    }


def validate(data: dict, report: dict) -> list[str]:
    errors: list[str] = []
    meta = data["meta"]
    text = DATA_PATH.read_text(encoding="utf-8")
    if IP_RE.search(text):
        errors.append("program.json contains an IP address")
    for match in PLMN_ANY_RE.findall(text):
        if not match.startswith("001-"):
            errors.append(f"PLMN {match} is not an MCC 001 example")
    if meta.get("disclaimer") != DISCLAIMER:
        errors.append("meta.disclaimer does not match the required banner sentence")
    if meta.get("host_operator") != "Bouygues Telecom":
        errors.append("host operator must stay Bouygues Telecom")
    checklist_ids = [item["id"] for item in data["checklist"]]
    if len(checklist_ids) != len(set(checklist_ids)):
        errors.append("duplicate checklist ids")
    legend = data["node_legend"]
    if set(legend.values()) != NODE_STATUSES:
        errors.append("node legend must map onto not_started/in_progress/done/blocked")
    completed = set(meta["completed_agreement_statuses"])
    if not completed <= AGREEMENT_STATUSES:
        errors.append("completed agreement statuses are not a subset of known statuses")
    seen_ids = set()
    seen_plmn = set()
    for partner in data["partners"]:
        pid = partner["id"]
        if pid in seen_ids:
            errors.append(f"duplicate partner {pid}")
        seen_ids.add(pid)
        if not PARTNER_RE.match(pid):
            errors.append(f"partner id {pid} is not synthetic Partner-XX-00 form")
        if partner.get("demo") is not True:
            errors.append(f"{pid} must be marked demo")
        if partner["region"] not in meta["region_order"]:
            errors.append(f"{pid} has unknown region")
        plmn = partner["example_plmn"]
        if not PLMN_RE.match(plmn):
            errors.append(f"{pid} PLMN {plmn} must look like 001-01")
        if plmn in seen_plmn:
            errors.append(f"duplicate PLMN {plmn}")
        seen_plmn.add(plmn)
        for direction in DIRECTIONS:
            rec = partner[direction]
            if rec["agreement_status"] not in AGREEMENT_STATUSES:
                errors.append(f"{pid} {direction} agreement status")
            if rec["ir21_status"] not in IR21_STATUSES:
                errors.append(f"{pid} {direction} IR.21 status")
            if not isinstance(rec["volte_roaming"], bool):
                errors.append(f"{pid} {direction} volte_roaming must be boolean")
            nodes = rec["nodes"]
            if not isinstance(nodes, str) or len(nodes) != len(checklist_ids):
                errors.append(f"{pid} {direction} nodes must be a {len(checklist_ids)}-char code")
            elif any(ch not in legend for ch in nodes):
                errors.append(f"{pid} {direction} nodes contain an unknown code")
            sigos = rec["sigos"]
            if sigos["result"] not in TEST_RESULTS:
                errors.append(f"{pid} {direction} SIGOS result")
            if sigos["result"] == "not_run":
                if sigos["date"] is not None or sigos["campaign"] is not None:
                    errors.append(f"{pid} {direction} not-run SIGOS should have null date/campaign")
            else:
                if not sigos["date"] or not CAMPAIGN_RE.match(sigos["campaign"] or ""):
                    errors.append(f"{pid} {direction} SIGOS campaign must be a DEMO id")
            for tech in data["technologies"]:
                test = rec["tests"].get(tech["id"])
                if not test or test["result"] not in TEST_RESULTS:
                    errors.append(f"{pid} {direction} missing test {tech['id']}")
                    continue
                if test["result"] == "not_run" and test["pass_rate"] is not None:
                    errors.append(f"{pid} {direction} {tech['id']} not_run has a pass rate")
                if test["result"] != "not_run" and not isinstance(test["pass_rate"], (int, float)):
                    errors.append(f"{pid} {direction} {tech['id']} needs a pass rate")
    progress = data["progress"]
    months = [point["month"] for point in progress]
    if months != sorted(months) or len(months) != len(set(months)):
        errors.append("progress months must be unique and sorted")
    if not meta["snapshot_date"].startswith(progress[-1]["month"]):
        errors.append("snapshot date must fall in the last progress month")
    for direction in DIRECTIONS:
        series = [point[direction] for point in progress]
        if any(later < earlier for earlier, later in zip(series, series[1:])):
            errors.append(f"{direction} progress goes backwards")
        expected = report["directions"][direction]["agreements_pct"]
        if abs(series[-1] - expected) > 0.02:
            errors.append(
                f"{direction} progress ends at {series[-1]} but agreements are {expected}"
            )
    for milestone in data["milestones"]:
        if milestone["status"] not in MILESTONE_STATUSES:
            errors.append(f"milestone {milestone['id']} status")
        if milestone["start"] > milestone["end"]:
            errors.append(f"milestone {milestone['id']} dates")
    freeze = next((item for item in data["milestones"] if item["id"] == "freeze"), None)
    if freeze is None or freeze["start"] <= meta["snapshot_date"]:
        errors.append("config freeze must still be ahead of the snapshot")
    if meta["opening_ceremony"] <= meta["snapshot_date"]:
        errors.append("opening ceremony must be after the snapshot")
    html = HTML_PATH.read_text(encoding="utf-8")
    readme = README_PATH.read_text(encoding="utf-8")
    for label, blob in (("index.html", html), ("README.md", readme)):
        if DISCLAIMER not in blob:
            errors.append(f"{label} is missing the demo disclaimer")
        if "Bouygues Telecom" not in blob:
            errors.append(f"{label} should name Bouygues Telecom")
        if "minassianelie@gmail.com" not in blob:
            errors.append(f"{label} is missing the contact email")
        if "Olympics 2024 Roaming Program" not in blob:
            errors.append(f"{label} is missing the program title")
        if "not an official" not in blob.lower():
            errors.append(f"{label} should say this is not an official Bouygues publication")
    if "RoamSys" not in readme or "SIGOS" not in readme:
        errors.append("README should mention RoamSys and SIGOS")
    return errors


def format_report(report: dict) -> str:
    lines = [
        f"{report['program']}",
        f"Host: {report['host_operator']}",
        f"Snapshot: {report['snapshot_date']}",
        f"Partners: {report['partners']} (synthetic)",
        "",
    ]
    for direction, metrics in report["directions"].items():
        lines.append(direction.upper())
        lines.append(
            f"  Agreements completed: {metrics['agreements_completed']}/{metrics['partners']} ({metrics['agreements_pct']}%)"
        )
        lines.append(
            f"  IR.21 validated: {metrics['ir21_validated']}/{metrics['partners']} ({metrics['ir21_pct']}%)"
        )
        lines.append(
            f"  SIGOS pass: {metrics['sigos_pass']}/{metrics['partners']} ({metrics['sigos_pass_pct']}%)"
        )
        lines.append(
            f"  Checklist done: {metrics['checklist_done']}/{metrics['checklist_total']} ({metrics['checklist_pct']}%)"
        )
        means = ", ".join(
            f"{key} {value}" for key, value in metrics["tech_mean_pass_rate"].items()
        )
        lines.append(f"  Mean pass rate where tested: {means}")
        if metrics["blocked"]:
            blocked = ", ".join(
                f"{item['partner']} {item['item']}" for item in metrics["blocked"]
            )
            lines.append(f"  Blocked: {blocked}")
        lines.append("")
    return "\n".join(lines).rstrip() + "\n"


def main(argv: list[str]) -> int:
    data = load()
    report = build_report(data)
    errors = validate(data, report)
    sys.stdout.write(format_report(report))
    if "--write" in argv:
        SUMMARY_PATH.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {SUMMARY_PATH.relative_to(ROOT)}", file=sys.stderr)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
