(function () {
  "use strict";

  var STATE = {
    direction: "all",
    heatmapDirection: "inbound",
    region: "all",
    agreement: "all",
    ir21: "all",
    sigos: "all",
    tech: "all",
    q: "",
    sortKey: "agreement",
    sortDir: 1
  };

  var DATA = null;
  var charts = {};
  var bound = false;

  var STATUS_LABELS = {
    not_started: "Not started",
    negotiation: "Negotiation",
    legal_review: "Legal review",
    signed: "Signed",
    live: "Live",
    not_requested: "Not requested",
    requested: "Requested",
    received: "Received",
    validated: "Validated",
    pass: "Pass",
    partial: "Partial",
    fail: "Fail",
    not_run: "Not run",
    done: "Done",
    in_progress: "In progress",
    blocked: "Blocked",
    inbound: "Inbound",
    outbound: "Outbound"
  };

  var RANK = {
    not_requested: 0,
    requested: 1,
    received: 2,
    validated: 3,
    not_started: 0,
    negotiation: 1,
    legal_review: 2,
    signed: 3,
    live: 4,
    not_run: 0,
    fail: 1,
    partial: 2,
    pass: 3
  };

  document.addEventListener("DOMContentLoaded", boot);

  function boot() {
    applyTheme(currentTheme(), false);
    bind();
    var params = new URLSearchParams(location.search);
    var view = params.get("view");
    STATE.direction = directionFromHash();
    if (STATE.direction !== "all") STATE.heatmapDirection = STATE.direction;
    load().then(function () {
      if (view) {
        var target = document.getElementById(view);
        if (target) target.scrollIntoView();
      }
    });
  }

  function currentTheme() {
    var params = new URLSearchParams(location.search);
    var query = params.get("theme");
    if (query === "light" || query === "dark") return query;
    try {
      var stored = localStorage.getItem("roaming-demo-theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch (err) {
      /* private mode */
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function applyTheme(theme, persist) {
    document.documentElement.setAttribute("data-theme", theme);
    if (persist) {
      try {
        localStorage.setItem("roaming-demo-theme", theme);
      } catch (err) {
        /* ignore */
      }
    }
    var button = document.getElementById("theme-toggle");
    if (!button) return;
    var dark = theme === "dark";
    button.setAttribute("aria-pressed", String(dark));
    button.textContent = dark ? "Light mode" : "Dark mode";
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.getElementById("theme-toggle").addEventListener("click", function () {
      var next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      applyTheme(next, true);
      if (DATA && window.Chart) renderCharts();
    });
    document.getElementById("direction-switch").addEventListener("click", function (event) {
      var button = event.target.closest("[data-direction]");
      if (!button) return;
      setDirection(button.getAttribute("data-direction"));
    });
    document.getElementById("direction").addEventListener("change", function (event) {
      setDirection(event.target.value);
    });
    document.getElementById("heat-switch").addEventListener("click", function (event) {
      var button = event.target.closest("[data-heat]");
      if (!button) return;
      STATE.heatmapDirection = button.getAttribute("data-heat");
      renderHeatmap();
    });
    ["region", "agreement", "ir21", "sigos", "tech"].forEach(function (id) {
      document.getElementById(id).addEventListener("change", function (event) {
        STATE[id] = event.target.value;
        renderTable();
      });
    });
    document.getElementById("q").addEventListener("input", function (event) {
      STATE.q = event.target.value.trim();
      renderTable();
    });
    document.getElementById("clear-filters").addEventListener("click", function () {
      STATE.region = "all";
      STATE.agreement = "all";
      STATE.ir21 = "all";
      STATE.sigos = "all";
      STATE.tech = "all";
      STATE.q = "";
      document.getElementById("region").value = "all";
      document.getElementById("agreement").value = "all";
      document.getElementById("ir21").value = "all";
      document.getElementById("sigos").value = "all";
      document.getElementById("tech").value = "all";
      document.getElementById("q").value = "";
      renderTable();
    });
    document.getElementById("partner-head").addEventListener("click", function (event) {
      var th = event.target.closest("th[data-sort]");
      if (!th) return;
      var key = th.getAttribute("data-sort");
      if (STATE.sortKey === key) STATE.sortDir *= -1;
      else {
        STATE.sortKey = key;
        STATE.sortDir = 1;
      }
      renderTable();
    });
    document.getElementById("attention").addEventListener("click", function (event) {
      var button = event.target.closest("[data-jump]");
      if (!button) return;
      STATE.q = button.getAttribute("data-jump");
      document.getElementById("q").value = STATE.q;
      setDirection(button.getAttribute("data-dir"));
      var motion = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      document.getElementById("register").scrollIntoView({ behavior: motion });
    });
  }

  function directionFromHash() {
    var hash = location.hash.replace("#", "");
    return hash === "inbound" || hash === "outbound" ? hash : "all";
  }

  function setDirection(direction) {
    STATE.direction = direction;
    if (direction !== "all") STATE.heatmapDirection = direction;
    var hash = direction === "all" ? "" : "#" + direction;
    var next = location.pathname + location.search + hash;
    if (location.pathname + location.search + location.hash !== next) {
      history.replaceState(null, "", next);
    }
    if (DATA) renderAll();
  }

  function load() {
    return fetch("data/program.json", { cache: "no-cache" })
      .then(function (response) {
        if (!response.ok) throw new Error(String(response.status));
        return response.json();
      })
      .then(function (data) {
        DATA = data;
        initRegions();
        renderAll();
        if (document.fonts && document.fonts.ready) {
          document.fonts.ready.then(function () {
            if (DATA && window.Chart) renderCharts();
          });
        }
      })
      .catch(function () {
        var box = document.getElementById("error");
        box.hidden = false;
        box.innerHTML =
          "<strong>Could not load data/program.json.</strong> " +
          "Open the demo through a local server so the browser can read the file." +
          "<br><code>python3 -m http.server 8080</code> then visit <code>http://localhost:8080</code>.";
      });
  }

  function initRegions() {
    var select = document.getElementById("region");
    var options = ['<option value="all">All regions</option>'];
    DATA.meta.region_order.forEach(function (region) {
      options.push('<option value="' + esc(region) + '">' + esc(region) + "</option>");
    });
    select.innerHTML = options.join("");
  }

  function renderAll() {
    renderFacts();
    renderDirectionControls();
    renderKpis();
    renderAttention();
    renderCharts();
    renderRegions();
    renderHeatmap();
    renderTimeline();
    renderTools();
    renderTable();
  }

  function renderFacts() {
    var meta = DATA.meta;
    var freeze = DATA.milestones.filter(function (item) { return item.id === "freeze"; })[0];
    var facts = [
      ["Snapshot", formatDate(meta.snapshot_date), "Program view, not a live feed"],
      ["Opening Ceremony", formatDate(meta.opening_ceremony), daysBetween(meta.snapshot_date, meta.opening_ceremony) + " days"],
      ["Config freeze", formatDate(freeze.start), daysBetween(meta.snapshot_date, freeze.start) + " days"],
      ["Partners", String(DATA.partners.length) + " synthetic", "Inbound and outbound"]
    ];
    document.getElementById("facts").innerHTML = facts.map(function (fact) {
      return "<div><dt>" + esc(fact[0]) + "</dt><dd>" + esc(fact[1]) + "<span>" + esc(fact[2]) + "</span></dd></div>";
    }).join("");
    document.getElementById("definition").textContent =
      "Main KPI: share of partner roaming agreements that are signed or live. " +
      "IR.21, node enablement, and SIGOS results are the readiness underneath that number. " +
      "VoLTE and IMS are test tracks, not the name of the program.";
  }

  function renderDirectionControls() {
    document.querySelectorAll("#direction-switch [data-direction]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-direction") === STATE.direction));
    });
    document.getElementById("direction").value = STATE.direction;
  }

  function renderKpis() {
    var inbound = metrics("inbound");
    var outbound = metrics("outbound");
    var focus = STATE.direction === "all" ? null : metrics(STATE.direction);
    var cards = [
      kpiCard("Inbound agreements", inbound, "agreements", "kpi-primary-in", STATE.direction === "outbound"),
      kpiCard("Outbound agreements", outbound, "agreements", "kpi-primary-out", STATE.direction === "inbound"),
      secondaryCard("IR.21 validated", inbound, outbound, focus, "ir21"),
      secondaryCard("Latest SIGOS pass", inbound, outbound, focus, "sigos"),
      secondaryCard("Checklist done", inbound, outbound, focus, "checklist")
    ];
    document.getElementById("kpis").innerHTML = cards.join("");
  }

  function kpiCard(label, metric, kind, klass, dim) {
    var value = metric.agreements_pct;
    var sub = metric.agreements_completed + " of " + metric.partners + " signed or live";
    return (
      '<article class="kpi ' + klass + (dim ? " is-dim" : "") + '">' +
      '<span class="kpi-label">' + esc(label) + "</span>" +
      "<strong>" + esc(fmtPct(value)) + "%</strong>" +
      '<span class="kpi-sub">' + esc(sub) + "</span>" +
      '<div class="bar' + (kind === "out" ? " out" : "") + '"><span style="width:' + value + '%"></span></div>' +
      "</article>"
    );
  }

  function secondaryCard(labelText, inbound, outbound, focus, kind) {
    var field = kind === "ir21" ? "ir21_pct" : kind === "sigos" ? "sigos_pass_pct" : "checklist_pct";
    var countField = kind === "ir21" ? "ir21_validated" : kind === "sigos" ? "sigos_pass" : "checklist_done";
    var totalField = kind === "checklist" ? "checklist_total" : "partners";
    if (focus) {
      return (
        '<article class="kpi">' +
        '<span class="kpi-label">' + esc(labelText) + "</span>" +
        "<strong>" + esc(fmtPct(focus[field])) + "%</strong>" +
        '<span class="kpi-sub">' + esc(focus[countField] + " of " + focus[totalField]) + "</span>" +
        '<div class="bar"><span style="width:' + focus[field] + '%"></span></div>' +
        "</article>"
      );
    }
    return (
      '<article class="kpi">' +
      '<span class="kpi-label">' + esc(labelText) + "</span>" +
      '<strong class="kpi-pair"><span>' + esc(fmtPct(inbound[field])) + '%</span><span class="pair-out">' + esc(fmtPct(outbound[field])) + "%</span></strong>" +
      '<span class="kpi-sub">Inbound · outbound</span>' +
      '<div class="bar"><span style="width:' + inbound[field] + '%"></span></div>' +
      '<div class="bar out"><span style="width:' + outbound[field] + '%"></span></div>' +
      "</article>"
    );
  }

  function renderAttention() {
    var box = document.getElementById("attention");
    var items = blockers(STATE.direction);
    if (!items.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
    box.hidden = false;
    var noun = items.length === 1 ? "item is" : "items are";
    box.innerHTML =
      "<h2>" + items.length + " checklist " + noun + " blocked at this snapshot</h2>" +
      "<ul>" + items.map(function (item) {
        return '<li><button type="button" class="text-btn" data-jump="' + esc(item.partner.id) + '" data-dir="' + esc(item.direction) + '">' +
          esc(item.partner.id) + " · " + esc(label(item.direction)) + " · " + esc(item.node.name) +
          "</button></li>";
      }).join("") + "</ul>";
  }

  function renderCharts() {
    if (!window.Chart) {
      document.getElementById("chart-fallback").hidden = false;
      return;
    }
    document.getElementById("chart-fallback").hidden = true;
    Chart.defaults.font.family = '"IBM Plex Sans", "Segoe UI", sans-serif';
    Chart.defaults.font.size = 12;
    Chart.defaults.color = token("--chart-text");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    Chart.defaults.animation = reduce ? false : { duration: 400 };
    renderCompareChart();
    renderTrendChart();
    renderTechChart();
    renderNodeChart();
  }

  function renderCompareChart() {
    var inbound = metrics("inbound");
    var outbound = metrics("outbound");
    var labels = ["Agreements", "IR.21", "SIGOS pass", "Checklist"];
    mountChart("chart-compare", {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          dataset("Inbound", [
            inbound.agreements_pct,
            inbound.ir21_pct,
            inbound.sigos_pass_pct,
            inbound.checklist_pct
          ], "--inbound", [
            inbound.agreements_completed + "/" + inbound.partners,
            inbound.ir21_validated + "/" + inbound.partners,
            inbound.sigos_pass + "/" + inbound.partners,
            inbound.checklist_done + "/" + inbound.checklist_total
          ], STATE.direction === "outbound"),
          dataset("Outbound", [
            outbound.agreements_pct,
            outbound.ir21_pct,
            outbound.sigos_pass_pct,
            outbound.checklist_pct
          ], "--outbound", [
            outbound.agreements_completed + "/" + outbound.partners,
            outbound.ir21_validated + "/" + outbound.partners,
            outbound.sigos_pass + "/" + outbound.partners,
            outbound.checklist_done + "/" + outbound.checklist_total
          ], STATE.direction === "inbound")
        ]
      },
      options: barOptions(false)
    });
  }

  function renderTrendChart() {
    var labels = DATA.progress.map(function (point) { return monthLabel(point.month); });
    mountChart("chart-trend", {
      type: "line",
      plugins: [lastPointLabels()],
      data: {
        labels: labels,
        datasets: [
          lineDataset("Inbound", DATA.progress.map(function (point) { return point.inbound; }), "--inbound", STATE.direction === "outbound"),
          lineDataset("Outbound", DATA.progress.map(function (point) { return point.outbound; }), "--outbound", STATE.direction === "inbound")
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 58, top: 8 } },
        plugins: {
          legend: legendOptions(),
          tooltip: {
            callbacks: {
              label: function (ctx) {
                return ctx.dataset.label + ": " + fmtPct(ctx.raw) + "% completed";
              }
            }
          }
        },
        scales: {
          x: categoryScale(),
          y: percentScale()
        }
      }
    });
  }

  function renderTechChart() {
    var labels = DATA.technologies.map(function (tech) { return tech.label; });
    mountChart("chart-tech", {
      type: "bar",
      data: {
        labels: labels,
        datasets: ["inbound", "outbound"].map(function (direction) {
          var stats = techStats(direction);
          return dataset(
            label(direction),
            DATA.technologies.map(function (tech) { return stats[tech.id].mean; }),
            direction === "inbound" ? "--inbound" : "--outbound",
            DATA.technologies.map(function (tech) {
              var stat = stats[tech.id];
              return stat.tested + " tested · " + stat.pass + " pass";
            }),
            STATE.direction !== "all" && STATE.direction !== direction
          );
        })
      },
      options: barOptions(false)
    });
  }

  function renderNodeChart() {
    var title = document.getElementById("node-chart-title");
    var note = document.getElementById("node-chart-note");
    if (STATE.direction === "all") {
      title.textContent = "Checklist completion, inbound vs outbound";
      note.textContent = "Share of partners with that item done. Open the heatmap for blocked and in-progress cells.";
      var inboundItems = itemDonePct("inbound");
      var outboundItems = itemDonePct("outbound");
      mountChart("chart-nodes", {
        type: "bar",
        data: {
          labels: DATA.checklist.map(function (item) { return item.short; }),
          datasets: [
            dataset("Inbound done", inboundItems, "--inbound", null, false),
            dataset("Outbound done", outboundItems, "--outbound", null, false)
          ]
        },
        options: barOptions(true)
      });
      return;
    }
    var mix = itemMix(STATE.direction);
    title.textContent = label(STATE.direction) + " checklist mix";
    note.textContent = "Counts across " + DATA.partners.length + " synthetic partners. IMS/CSCF is the VoLTE roaming track.";
    mountChart("chart-nodes", {
      type: "bar",
      data: {
        labels: DATA.checklist.map(function (item) { return item.short; }),
        datasets: [
          stackSet("Done", mix.done, "--ok"),
          stackSet("In progress", mix.in_progress, "--warn"),
          stackSet("Blocked", mix.blocked, "--bad"),
          stackSet("Not started", mix.not_started, "--idle")
        ]
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: legendOptions(),
          tooltip: { callbacks: { label: countTip } }
        },
        scales: {
          x: {
            stacked: true,
            beginAtZero: true,
            max: DATA.partners.length,
            ticks: { color: token("--chart-text"), precision: 0 },
            grid: { color: token("--chart-grid") }
          },
          y: {
            stacked: true,
            ticks: { color: token("--chart-text") },
            grid: { display: false }
          }
        }
      }
    });
  }

  function renderRegions() {
    var directions = STATE.direction === "all" ? ["inbound", "outbound"] : [STATE.direction];
    var html = DATA.meta.region_order.map(function (region) {
      var partners = DATA.partners.filter(function (partner) { return partner.region === region; });
      var rows = directions.map(function (direction) {
        var done = partners.filter(function (partner) {
          return isComplete(partner[direction].agreement_status);
        }).length;
        var value = partners.length ? (100 * done) / partners.length : 0;
        return (
          '<div class="pair"><span class="lbl">' + esc(shortDir(direction)) + " " + done + "/" + partners.length + "</span>" +
          '<div class="track' + (direction === "outbound" ? " out" : "") + '"><span style="width:' + value + '%"></span></div></div>'
        );
      }).join("");
      return '<div class="region"><div class="region-name">' + esc(region) + "<span>" + partners.length + " partners</span></div><div>" + rows + "</div></div>";
    }).join("");
    document.getElementById("regions").innerHTML = html;
  }

  function renderHeatmap() {
    var direction = STATE.direction === "all" ? STATE.heatmapDirection : STATE.direction;
    document.getElementById("heat-switch").hidden = STATE.direction !== "all";
    document.querySelectorAll("#heat-switch [data-heat]").forEach(function (button) {
      button.setAttribute("aria-pressed", String(button.getAttribute("data-heat") === direction));
    });
    var head = "<tr><th>Partner</th>" + DATA.checklist.map(function (item) {
      return '<th title="' + esc(item.name) + '">' + esc(item.short) + "</th>";
    }).join("") + "</tr>";
    var body = DATA.partners.map(function (partner) {
      var nodes = decodeNodes(partner[direction].nodes);
      var cells = nodes.map(function (node) {
        var letter = node.status === "not_started" ? "—" : node.code;
        return '<td class="cell cell-' + node.status + '" title="' + esc(partner.id + " · " + label(direction) + " · " + node.name + " · " + label(node.status)) + '">' + esc(letter) + "</td>";
      }).join("");
      return "<tr><td><span class=\"partner-id\">" + esc(partner.id) + '</span> <span class="demo-tag">DEMO</span></td>' + cells + "</tr>";
    }).join("");
    document.getElementById("heatmap").innerHTML = '<table class="heatmap"><thead>' + head + "</thead><tbody>" + body + "</tbody></table>";
    document.getElementById("legend").innerHTML = [
      ["D", "done", "Done"],
      ["P", "in_progress", "In progress"],
      ["B", "blocked", "Blocked"],
      ["—", "not_started", "Not started"]
    ].map(function (item) {
      return '<li><i class="cell-' + item[1] + '">' + item[0] + "</i> " + item[2] + "</li>";
    }).join("");
    document.getElementById("heatmap-caption").textContent =
      label(direction) + " roaming enablement. Example PLMNs use test MCC 001 and are not live networks.";
  }

  function renderTimeline() {
    var meta = DATA.meta;
    document.getElementById("timeline-now").textContent =
      "You are here · " + formatDate(meta.snapshot_date) +
      " · config freeze starts " + formatDate(DATA.milestones.filter(function (item) { return item.id === "freeze"; })[0].start) +
      " · Opening Ceremony " + formatDate(meta.opening_ceremony);
    document.getElementById("timeline").innerHTML = DATA.milestones.map(function (item) {
      return '<li class="is-' + item.status + '">' +
        '<span class="phase">' + esc(item.phase) + "</span>" +
        "<h3>" + esc(item.name) + "</h3>" +
        '<span class="when">' + esc(formatDate(item.start)) + " – " + esc(formatDate(item.end)) + "</span>" +
        '<span class="status">' + esc(item.status === "not_started" ? "Upcoming" : label(item.status)) + "</span>" +
        "<p>" + esc(item.detail) + "</p></li>";
    }).join("");
  }

  function renderTools() {
    var links = {
      roamsys: "https://roamsys.com/",
      sigos: "https://www.mobileum.com/ecosystems/globalroamer"
    };
    var linkLabels = {
      roamsys: "RoamSys product reference",
      sigos: "GlobalRoamer product reference"
    };
    document.getElementById("tools").innerHTML = DATA.tools.map(function (tool) {
      return '<article class="card"><p class="tool-role">' + esc(tool.role) + "</p><h3>" + esc(tool.name) + "</h3><p>" +
        esc(tool.summary) + '</p><a href="' + links[tool.id] + '" rel="noopener noreferrer">' + linkLabels[tool.id] + "</a></article>";
    }).join("");
  }

  function renderTable() {
    var rows = filteredRows();
    sortRows(rows);
    document.querySelectorAll("#partner-head th[data-sort]").forEach(function (th) {
      var active = th.getAttribute("data-sort") === STATE.sortKey;
      th.setAttribute("aria-sort", active ? (STATE.sortDir === 1 ? "ascending" : "descending") : "none");
    });
    document.getElementById("row-count").textContent = rows.length + (rows.length === 1 ? " row" : " rows");
    var body = document.getElementById("partner-rows");
    if (!rows.length) {
      body.innerHTML = '<tr><td class="empty" colspan="12">No partners match these filters.</td></tr>';
      return;
    }
    body.innerHTML = rows.map(function (row) {
      var rec = row.rec;
      var nodes = decodeNodes(rec.nodes);
      var done = nodes.filter(function (node) { return node.status === "done"; }).length;
      var blocked = nodes.some(function (node) { return node.status === "blocked"; });
      var sigosTitle = rec.sigos.campaign ? rec.sigos.campaign : "No campaign";
      return "<tr>" +
        "<td><span class=\"partner-id\">" + esc(row.partner.id) + '</span> <span class="demo-tag">DEMO</span></td>' +
        "<td>" + esc(row.partner.region) + "</td>" +
        "<td>" + esc(label(row.direction)) + "</td>" +
        "<td><span class=\"pill " + rec.agreement_status + "\">" + esc(label(rec.agreement_status)) + "</span>" +
          '<div class="mini"><span class="sub">' + rec.agreement_pct + '% stage</span><div class="bar"><span style="width:' + rec.agreement_pct + '%"></span></div></div></td>' +
        "<td><span class=\"pill " + rec.ir21_status + "\">" + esc(label(rec.ir21_status)) + "</span></td>" +
        techCell(rec, "3g") + techCell(rec, "lte") + techCell(rec, "volte") + techCell(rec, "ims") +
        '<td title="' + esc(sigosTitle) + '"><span class="pill ' + rec.sigos.result + '">' + esc(label(rec.sigos.result)) + "</span>" +
          (rec.sigos.date ? '<span class="sub">' + esc(formatDate(rec.sigos.date)) + "</span>" : "") + "</td>" +
        "<td>" + done + "/" + nodes.length + (blocked ? ' <span class="pill blocked">Blocked</span>' : "") + "</td>" +
        '<td><span class="sub">' + esc(row.partner.example_plmn) + "</span></td>" +
        "</tr>";
    }).join("");
  }

  function techCell(rec, id) {
    var test = rec.tests[id];
    var rate = test.result === "not_run" ? "" : '<span class="sub">' + fmtPct(test.pass_rate) + "%</span>";
    return '<td><span class="pill ' + test.result + '">' + esc(label(test.result)) + "</span>" + rate + "</td>";
  }

  function filteredRows() {
    var directions = STATE.direction === "all" ? ["inbound", "outbound"] : [STATE.direction];
    var query = STATE.q.toLowerCase();
    var rows = [];
    DATA.partners.forEach(function (partner) {
      directions.forEach(function (direction) {
        var rec = partner[direction];
        if (STATE.region !== "all" && partner.region !== STATE.region) return;
        if (STATE.agreement === "completed" && !isComplete(rec.agreement_status)) return;
        if (STATE.agreement === "open" && isComplete(rec.agreement_status)) return;
        if (STATE.ir21 !== "all" && rec.ir21_status !== STATE.ir21) return;
        if (STATE.sigos !== "all" && rec.sigos.result !== STATE.sigos) return;
        if (STATE.tech !== "all" && rec.tests[STATE.tech].result === "pass") return;
        if (query) {
          var hay = (partner.id + " " + partner.region + " " + partner.example_plmn + " " + (rec.sigos.campaign || "")).toLowerCase();
          if (hay.indexOf(query) === -1) return;
        }
        rows.push({ partner: partner, direction: direction, rec: rec });
      });
    });
    return rows;
  }

  function sortRows(rows) {
    var dir = STATE.sortDir;
    rows.sort(function (a, b) {
      var av = sortValue(a);
      var bv = sortValue(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      if (a.partner.id < b.partner.id) return -1;
      if (a.partner.id > b.partner.id) return 1;
      if (a.direction < b.direction) return -1;
      if (a.direction > b.direction) return 1;
      return 0;
    });
  }

  function sortValue(row) {
    if (STATE.sortKey === "partner") return row.partner.id;
    if (STATE.sortKey === "region") return row.partner.region;
    if (STATE.sortKey === "direction") return row.direction;
    if (STATE.sortKey === "agreement") return row.rec.agreement_pct;
    if (STATE.sortKey === "ir21") return RANK[row.rec.ir21_status];
    if (STATE.sortKey === "sigos") return RANK[row.rec.sigos.result];
    if (STATE.sortKey === "nodes") {
      return decodeNodes(row.rec.nodes).filter(function (node) { return node.status === "done"; }).length;
    }
    return row.partner.id;
  }

  function metrics(direction) {
    var rows = DATA.partners.map(function (partner) { return partner[direction]; });
    var total = rows.length;
    var agreements = rows.filter(function (rec) { return isComplete(rec.agreement_status); }).length;
    var ir21 = rows.filter(function (rec) { return rec.ir21_status === "validated"; }).length;
    var sigosPass = rows.filter(function (rec) { return rec.sigos.result === "pass"; }).length;
    var done = 0;
    rows.forEach(function (rec) {
      decodeNodes(rec.nodes).forEach(function (node) {
        if (node.status === "done") done += 1;
      });
    });
    var cells = total * DATA.checklist.length;
    return {
      partners: total,
      agreements_completed: agreements,
      agreements_pct: percent(agreements, total),
      ir21_validated: ir21,
      ir21_pct: percent(ir21, total),
      sigos_pass: sigosPass,
      sigos_pass_pct: percent(sigosPass, total),
      checklist_done: done,
      checklist_total: cells,
      checklist_pct: percent(done, cells)
    };
  }

  function techStats(direction) {
    var stats = {};
    DATA.technologies.forEach(function (tech) {
      var rates = [];
      var pass = 0;
      var tested = 0;
      DATA.partners.forEach(function (partner) {
        var test = partner[direction].tests[tech.id];
        if (test.result === "not_run") return;
        tested += 1;
        if (test.result === "pass") pass += 1;
        if (typeof test.pass_rate === "number") rates.push(test.pass_rate);
      });
      var mean = rates.length ? rates.reduce(function (sum, value) { return sum + value; }, 0) / rates.length : null;
      stats[tech.id] = { mean: mean, tested: tested, pass: pass };
    });
    return stats;
  }

  function itemDonePct(direction) {
    return DATA.checklist.map(function (item, index) {
      var done = DATA.partners.filter(function (partner) {
        return decodeNodes(partner[direction].nodes)[index].status === "done";
      }).length;
      return percent(done, DATA.partners.length);
    });
  }

  function itemMix(direction) {
    var mix = { done: [], in_progress: [], blocked: [], not_started: [] };
    DATA.checklist.forEach(function (item, index) {
      var counts = { done: 0, in_progress: 0, blocked: 0, not_started: 0 };
      DATA.partners.forEach(function (partner) {
        counts[decodeNodes(partner[direction].nodes)[index].status] += 1;
      });
      Object.keys(mix).forEach(function (key) { mix[key].push(counts[key]); });
    });
    return mix;
  }

  function blockers(direction) {
    var directions = direction === "all" ? ["inbound", "outbound"] : [direction];
    var items = [];
    DATA.partners.forEach(function (partner) {
      directions.forEach(function (dir) {
        decodeNodes(partner[dir].nodes).forEach(function (node) {
          if (node.status === "blocked") items.push({ partner: partner, direction: dir, node: node });
        });
      });
    });
    return items;
  }

  function decodeNodes(code) {
    return DATA.checklist.map(function (item, index) {
      var letter = code.charAt(index);
      return {
        id: item.id,
        short: item.short,
        name: item.name,
        code: letter,
        status: DATA.node_legend[letter]
      };
    });
  }

  function isComplete(status) {
    return DATA.meta.completed_agreement_statuses.indexOf(status) !== -1;
  }

  function mountChart(id, config) {
    if (charts[id]) charts[id].destroy();
    var canvas = document.getElementById(id);
    charts[id] = new Chart(canvas, config);
  }

  function dataset(name, data, colorVar, fractions, dim) {
    var color = token(colorVar);
    return {
      label: name,
      data: data,
      fractions: fractions,
      backgroundColor: withAlpha(color, dim ? 0.25 : 0.85),
      borderColor: withAlpha(color, dim ? 0.35 : 1),
      borderWidth: 1,
      borderRadius: 4,
      maxBarThickness: 28
    };
  }

  function lineDataset(name, data, colorVar, dim) {
    var color = token(colorVar);
    return {
      label: name,
      data: data,
      borderColor: withAlpha(color, dim ? 0.35 : 1),
      backgroundColor: withAlpha(color, dim ? 0.05 : 0.12),
      pointBackgroundColor: withAlpha(color, dim ? 0.35 : 1),
      pointRadius: 3,
      pointHoverRadius: 4,
      borderWidth: 2,
      tension: 0.25,
      fill: true
    };
  }

  function stackSet(name, data, colorVar) {
    return {
      label: name,
      data: data,
      backgroundColor: withAlpha(token(colorVar), 0.9),
      borderWidth: 0,
      maxBarThickness: 18
    };
  }

  function barOptions(horizontal) {
    var valueScale = percentScale();
    var catScale = categoryScale();
    return {
      indexAxis: horizontal ? "y" : "x",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: legendOptions(),
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var fraction = ctx.dataset.fractions && ctx.dataset.fractions[ctx.dataIndex];
              var text = ctx.dataset.label + ": " + fmtPct(ctx.raw) + "%";
              return fraction ? text + " (" + fraction + ")" : text;
            }
          }
        }
      },
      scales: horizontal ? { x: valueScale, y: catScale } : { x: catScale, y: valueScale }
    };
  }

  function percentScale() {
    return {
      beginAtZero: true,
      max: 100,
      ticks: {
        color: token("--chart-text"),
        callback: function (value) { return value + "%"; }
      },
      grid: { color: token("--chart-grid") }
    };
  }

  function categoryScale() {
    return {
      ticks: { color: token("--chart-text") },
      grid: { display: false }
    };
  }

  function legendOptions() {
    return {
      position: "bottom",
      labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: "rectRounded" }
    };
  }

  function countTip(ctx) {
    return ctx.dataset.label + ": " + ctx.raw;
  }

  function lastPointLabels() {
    return {
      id: "lastPointLabels",
      afterDatasetsDraw: function (chart) {
        var ctx = chart.ctx;
        ctx.save();
        ctx.font = '600 12px "IBM Plex Sans", sans-serif';
        ctx.fillStyle = token("--ink");
        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        chart.data.datasets.forEach(function (ds, index) {
          var meta = chart.getDatasetMeta(index);
          if (meta.hidden) return;
          var point = meta.data[meta.data.length - 1];
          var value = ds.data[ds.data.length - 1];
          ctx.fillText(fmtPct(value) + "%", point.x + 8, point.y);
        });
        ctx.restore();
      }
    };
  }

  function token(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function withAlpha(hex, alpha) {
    var raw = hex.replace("#", "");
    if (raw.length !== 6) return hex;
    var num = parseInt(raw, 16);
    var r = (num >> 16) & 255;
    var g = (num >> 8) & 255;
    var b = num & 255;
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function percent(part, whole) {
    if (!whole) return 0;
    return (100 * part) / whole;
  }

  function fmtPct(value) {
    if (value == null || isNaN(value)) return "—";
    var rounded = Math.round(value * 100) / 100;
    return String(rounded);
  }

  function label(key) {
    return STATUS_LABELS[key] || key;
  }

  function shortDir(direction) {
    return direction === "inbound" ? "In" : "Out";
  }

  function formatDate(iso) {
    var parts = iso.split("-");
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return Number(parts[2]) + " " + months[Number(parts[1]) - 1] + " " + parts[0];
  }

  function monthLabel(iso) {
    var parts = iso.split("-");
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[Number(parts[1]) - 1] + " " + parts[0].slice(2);
  }

  function daysBetween(start, end) {
    var a = Date.UTC(Number(start.slice(0, 4)), Number(start.slice(5, 7)) - 1, Number(start.slice(8, 10)));
    var b = Date.UTC(Number(end.slice(0, 4)), Number(end.slice(5, 7)) - 1, Number(end.slice(8, 10)));
    return Math.round((b - a) / 86400000);
  }

  function esc(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }
})();
