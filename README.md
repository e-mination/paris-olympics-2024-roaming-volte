# Olympics 2024 Roaming Program

Portfolio demo — fictional data, not real operator agreements or live configs.

## Live dashboard

**https://e-mination.github.io/paris-olympics-2024-roaming-volte/**

Open that link for the graphs and stats: agreement completion, IR.21, the node heatmap, and 3G / LTE / VoLTE / IMS. Nothing to install. The screenshots below are the same board.

A static readiness board for **inbound and outbound roaming** ahead of the Paris 2024 Olympic and Paralympic Games. The home network in this story is **Bouygues Telecom**. Every partner, PLMN, IR.21 state, test result, and node status is synthetic.

This is a personal portfolio piece by Elie Minassian. It is **not an official Bouygues Telecom publication or endorsement**, and it does not use a Bouygues logo.

![Olympics 2024 Roaming Program dashboard: agreement KPIs, inbound versus outbound bars, and the trend to June 2024](assets/dashboard.png)

## Thirty-second read

At the **12 June 2024** snapshot (44 days before the Opening Ceremony, 9 days before configuration freeze):

| | Inbound | Outbound |
| --- | ---: | ---: |
| Agreements signed or live | **13 / 16 · 81.25%** | **11 / 16 · 68.75%** |
| IR.21 validated | **12 / 16 · 75%** | **7 / 16 · 43.75%** |

Inbound commercial closure is ahead of outbound. IR.21 validation lags the signature, especially outbound. 3G and LTE tests are healthier than the VoLTE and IMS tracks. A handful of checklist cells are blocked (steering, DRA, firewall) before freeze.

VoLTE and IMS are **test tracks under the roaming program**, not the name of the product.

```
Olympics 2024 Roaming Program
Bouygues Telecom · home network · portfolio demo
Snapshot 12 Jun 2024 · freeze in 9 days · Opening Ceremony in 44 days

Inbound agreements     Outbound agreements     IR.21          SIGOS
81.25%   13/16         68.75%   11/16          75% · 43.75%   pass rates lower

[ grouped bars: agreements, IR.21, SIGOS, checklist ]
[ line: both directions climbing through Jun 2024     ]
[ 3G | LTE | VoLTE | IMS pass rates                   ]
[ partner × node heatmap: D done  P progress  B block ]
[ register: direction, IR.21, SIGOS, tech gap filters ]
```

![Inbound roaming enablement heatmap, partner by checklist item](assets/dashboard-nodes.png)

![Partner register filtered view, open agreements first, with IR.21 and SIGOS columns](assets/dashboard-register.png)

## What this shows

1. **Agreement completion** — percent of partner operators with a roaming agreement signed or live, split by inbound and outbound, with a monthly curve up to the snapshot.
2. **IR.21 completeness** — fictional exchange state: not requested, requested, received, validated. No RAEX file is included.
3. **Roaming enablement on the core** — per partner and per direction: IR.21, steering, APN, HSS/UDM, DRA/STP, PGW/SMF+UPF, firewall/ACL, IMS/CSCF (VoLTE track), and the SIGOS campaign. Status is `not_started`, `in_progress`, `done`, or `blocked`.
4. **Active tests** — 3G, LTE, VoLTE, and IMS pass rates, plus the latest SIGOS result.
5. **The path to the Games** — planning, agreements, IR.21, lab, node config, configuration freeze, Olympic Games, Paralympic Games.

The register filters by direction, region, agreement (open or completed), IR.21, SIGOS result, and a technology that is not yet passing. Open agreements sort to the top.

## Role

**Elie Minassian · Bouygues Telecom (Olympics 2024 Roaming)**

On the Paris 2024 roaming program at Bouygues Telecom, the work was project-style coverage of core network and services: follow inbound and outbound agreement progress with partner operators, IR.21 exchange and validation, roaming enablement on the core nodes, and active test campaigns. RoamSys was the system of record for the agreement footprint and IR.21 workflow. SIGOS was the active-test platform for 3G, LTE, VoLTE, and IMS, in both directions.

This repository rebuilds the steering view from that kind of work — what is closed, what is late, what is blocked before freeze — with invented partners and figures. It is not a dump of contracts, IR.21 documents, or live Bouygues configuration.

Contact: [minassianelie@gmail.com](mailto:minassianelie@gmail.com) · GitHub: [e-mination](https://github.com/e-mination)

## What is real, and what is demo

| Real context | Demo only |
| --- | --- |
| Elie worked at Bouygues Telecom on Paris 2024 inbound and outbound roaming | Partner names (`Partner-EU-01` and the rest), all marked DEMO |
| The job of tracking agreements, IR.21, node readiness, and tests | Every percentage, status, and milestone mix |
| RoamSys for agreement / IR.21 workflow; SIGOS for active tests | Campaign IDs such as `DEMO-SIGOS-IN-24061` |
| Public Games dates (opening 26 July 2024) | Example PLMNs on test MCC `001` (`001-01` … `001-16`) |

There are no real IP addresses, no live PLMNs, and no IR.21 document bodies. The snapshot date is fixed at 12 June 2024 so the countdown still points at the Games. It is not a clock that runs from today.

## Tools

**RoamSys** is a roaming-management platform operators use for the partner footprint and for GSMA RAEX document exchange: IR.21 distribution and receipt, roaming-agreement coverage, and IREG workflows that turn document changes into configuration follow-up. On this program it was where agreement stage and IR.21 completeness were followed. The board is not connected to a RoamSys tenant. Product reference: [roamsys.com](https://roamsys.com/).

**SIGOS** (the SITE test system, and the hosted GlobalRoamer service, now part of Mobileum) is an active-testing platform. Probes run end-to-end roaming tests — voice, data, VoLTE, IMS — inbound and outbound. Pass rates on this page stand in for that test desk. Product reference: [GlobalRoamer](https://www.mobileum.com/ecosystems/globalroamer).

## Local development

The published board is the live dashboard above. To run a copy on your machine, serve the repo root (opening `index.html` as a file will not load the JSON):

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. Optional check of the snapshot figures: `python3 scripts/summarize.py --check`.

GitHub Pages already deploys `main` from the repository root (`index.html`, `css/`, `js/`, `data/`). Charts load Chart.js from the CDN; the figures load from the relative path `data/program.json`.

## Data

`data/program.json` is the only source the page reads.

- `partners[]` — region, example PLMN, and an `inbound` / `outbound` record.
- Each direction has `agreement_status`, `agreement_pct`, `ir21_status`, `volte_roaming`, `tests` for `3g` / `lte` / `volte` / `ims`, a `sigos` result, and `nodes`.
- `nodes` is nine characters in checklist order. `D` done, `P` in progress, `B` blocked, `N` not started.
- `progress[]` is the fictional monthly curve of **agreements completed**. The last point is June 2024 and must match the partner count.
- `milestones[]` runs from planning to the Paralympics.

Completed means `signed` or `live`. Negotiation and legal review stay in the open count, with `agreement_pct` showing how far that stage is.

```json
{
  "id": "Partner-EU-01",
  "demo": true,
  "region": "Europe",
  "example_plmn": "001-01",
  "inbound": {
    "agreement_status": "live",
    "agreement_pct": 100,
    "ir21_status": "validated",
    "volte_roaming": true,
    "nodes": "DDDDDDDDD"
  }
}
```

## Tech stack

- One static page: HTML, CSS, and vanilla JavaScript
- [Chart.js 4](https://www.chartjs.org/) from a CDN
- Local JSON, no backend
- Python 3 script to recompute and check the snapshot
- A small GitHub Actions workflow that runs that check

License: [MIT](LICENSE).

Elie Minassian · Bouygues Telecom (Olympics 2024 Roaming) · minassianelie@gmail.com
