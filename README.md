# Olympics 2024 Roaming Program

Portfolio demo — fictional data, not real operator agreements or live configs.

## Live dashboard

**https://e-mination.github.io/paris-olympics-2024-roaming-volte/**

Open that link for the graphs and stats: agreement completion, IR.21, track coverage, the node heatmap, and the IR.25 / SIGOS examples. Nothing to install. The screenshots below are the same board.

A static readiness board for **inbound and outbound roaming** ahead of the Paris 2024 Olympic and Paralympic Games. The home network is **Bouygues Telecom**. Partner names and TADIGs are the Olympics roaming partner set. IR.25 tables and SIGOS cards are illustrative examples, not live exports. There is no confidential data: no MSISDNs, IMSIs, program emails, or live SIGOS parameter dumps.

This is a personal portfolio piece by Elie Minassian. It is **not an official Bouygues Telecom publication or endorsement**, and it does not use a Bouygues logo.

![Olympics 2024 Roaming Program dashboard: agreement KPIs, inbound versus outbound bars, and the trend to June 2024](assets/dashboard.png)

## Thirty-second read

At the **12 June 2024** snapshot (44 days before the Opening Ceremony, 9 days before configuration freeze):

| | Inbound | Outbound |
| --- | ---: | ---: |
| Agreements signed or live | **16 / 17 · 94.12%** | **5 / 5 · 100%** |
| IR.21 validated | **12 / 17 · 70.59%** | **4 / 5 · 80%** |
| VoLTE track | **15 / 17** | **2 / 5** |

Counts are direction lines across 21 partners. Telefónica is in both directions. LG U+, NTT DOCOMO, and Swisscom keep separate inbound and outbound lines where the program did. VoLTE, R-IN, R-OUT, toll, and IR.25 are tracks under roaming, not a separate product. The monthly curve is illustrative and stops at this snapshot.

```
Olympics 2024 Roaming Program
Bouygues Telecom · home network · portfolio demo
Snapshot 12 Jun 2024 · freeze in 9 days · Opening Ceremony in 44 days

Inbound agreements     Outbound agreements     IR.21
94.12%   16/17         100%     5/5            70.59% · 80%

[ grouped bars: agreements, IR.21, VoLTE, IR.25 ]
[ line: both directions through Jun 2024        ]
[ track coverage: 3G LTE VoLTE R-IN R-OUT IR.25 toll ]
[ heatmap: derived checklist, real partner names ]
[ IR.25 examples: DOCOMO, Magenta, 3 UK ]
[ SIGOS cards: IMS register, 112, MO/MT, SMS ]
```

![Roaming enablement heatmap for the Olympics partner set, partner by checklist item](assets/dashboard-nodes.png)

![IR.25 / S8HR example tables for NTT DOCOMO, Magenta Austria, and 3 UK, plus SIGOS script cards](assets/dashboard-examples.png)

![Partner register, open agreements first, with real names, TADIGs, IR.21, and tracks](assets/dashboard-register.png)

## What this shows

1. **Agreement completion** — percent of partner operators with a roaming agreement signed or live, split by inbound and outbound, with a monthly curve up to the snapshot.
2. **IR.21 completeness** — validated, in progress, or pending. No RAEX file is included.
3. **Roaming enablement on the core** — per partner: IR.21, steering, APN, HSS/UDM, DRA/STP, PGW/SMF, firewall, IMS/CSCF (VoLTE track), and SIGOS. Cells are a derived sketch: done, in progress, blocked, or not started. Not a live node extract.
4. **Tracks** — 3G, LTE, VoLTE, R-IN, R-OUT, IR.25, and toll coverage by direction, plus illustrative IR.25 case tables (NTT DOCOMO, Magenta Austria, 3 UK) and SIGOS script cards.
5. **The path to the Games** — planning, agreements, IR.21, lab, node config, configuration freeze, Olympic Games, Paralympic Games.

The register filters by name, country, TADIG, direction, region, agreement (open or completed), IR.21, and track. Open agreements sort to the top.

## Role

**Elie Minassian · Bouygues Telecom (Olympics 2024 Roaming)**

On the Paris 2024 roaming program at Bouygues Telecom, the work was project-style coverage of core network and services: follow inbound and outbound agreement progress with partner operators, IR.21 exchange and validation, roaming enablement on the core nodes, and active test campaigns. RoamSys was the system of record for the agreement footprint and IR.21 workflow. SIGOS was the active-test platform for 3G, LTE, VoLTE, and IMS, in both directions.

This repository rebuilds that steering view. Partner names and TADIGs come from the Olympics roaming partner set. Figures for the checklist are a derived sketch. IR.25 results and SIGOS script cards are illustrative examples, not live exports, and the repo holds no confidential data.

Contact: [minassianelie@gmail.com](mailto:minassianelie@gmail.com) · GitHub: [e-mination](https://github.com/e-mination)

## What is real, and what is demo

| Real context | Demo only |
| --- | --- |
| Elie worked at Bouygues Telecom on Paris 2024 inbound and outbound roaming | Checklist letters (derived from agreement, IR.21, and tracks) |
| Partner names and TADIGs from that roaming partner set | IR.25 case results and SIGOS script cards, which are illustrative |
| RoamSys for agreement / IR.21 workflow; SIGOS for active tests | The monthly agreement curve, which is not a RoamSys export |
| Public Games dates (opening 26 July 2024) | No MSISDNs, IMSIs, program emails, or live SIGOS parameter dumps |

There are no IP addresses and no IR.21 document bodies. The snapshot date is fixed at 12 June 2024 so the countdown still points at the Games. It is not a clock that runs from today. Test results on the page are illustrative examples, not live exports.

## Tools

**RoamSys** is a roaming-management platform operators use for the partner footprint and for GSMA RAEX document exchange: IR.21 distribution and receipt, roaming-agreement coverage, and IREG workflows that turn document changes into configuration follow-up. On this program it was where agreement stage and IR.21 completeness were followed. The board is not connected to a RoamSys tenant. Product reference: [roamsys.com](https://roamsys.com/).

**SIGOS** (the SITE test system, and the hosted GlobalRoamer service, now part of Mobileum) is an active-testing platform. Probes run end-to-end roaming tests inbound and outbound. The four cards on the dashboard (IMS register, emergency 112, MO/MT voice, SMS) are illustrative SIGOS-style examples, not screenshots of a production UI. Product reference: [GlobalRoamer](https://www.mobileum.com/ecosystems/globalroamer).

## Local development

The published board is the live dashboard above. To run a copy on your machine, serve the repo root (opening `index.html` as a file will not load the JSON):

```bash
python3 -m http.server 8080
```

Then open http://localhost:8080. Optional check of the snapshot figures: `python3 scripts/summarize.py --check`.

GitHub Pages already deploys `main` from the repository root (`index.html`, `css/`, `js/`, `data/`). Charts load Chart.js from the CDN; the figures load from the relative path `data/program.json`.

## Data

`data/enrichment.json` is the sanitized partner set. `data/program.json` is what the page loads. `python3 scripts/summarize.py --write` rebuilds the latter from the former.

- `partners[]` — name, country, TADIG, directions, tracks, IR.21, agreement, and a derived `nodes` sketch.
- `ir25_test_examples[]` — illustrative IR.25 / S8HR cases for NTT DOCOMO, Magenta Austria, and 3 UK.
- `sigos_examples[]` — illustrative script cards: `IMS_REGISTER_OK`, `VOLTE_EMERGENCYCALL`, `VOLTE_MO_MT_CALL`, `SMS_MO_MT`.
- `nodes` is nine characters in checklist order. `D` done, `P` in progress, `B` blocked, `N` not started.
- `progress[]` is an illustrative monthly curve of **agreements completed**. The last point is June 2024 and must match the direction-line count.

Completed means `signed` or `live`.

```json
{
  "id": "gbr-3uk",
  "name": "3 UK (Hutchison)",
  "tadig": "GBRHU",
  "directions": ["inbound"],
  "tracks": ["VoLTE", "R-IN"],
  "ir21_status": "validated",
  "agreement_status": "live"
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
