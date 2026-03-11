(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const fmt = {
    n: (v, d = 0) => Number(v).toFixed(d),
  };

  const ADJUST_KEY = "um_demo_adjustments_v1";
  const GOAL_HISTORY_KEY = "um_demo_goal_history_v1";

  const state = {
    goal: "temp",
    adjustments: loadAdjustments(),
    goalHistory: loadGoalHistory(),
  };

  let currentCharts = [];

  // Seed with example 10-year data if nothing exists yet.
  if (state.goalHistory.size === 0) {
    seedExampleHistory();
  }

  function loadAdjustments() {
    const raw = localStorage.getItem(ADJUST_KEY);
    if (!raw) return new Map();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return new Map();
      const m = new Map();
      Object.entries(parsed).forEach(([goalId, list]) => {
        if (Array.isArray(list)) {
          m.set(
            goalId,
            list
              .filter((x) => x && typeof x.description === "string" && typeof x.ts === "number")
              .slice(0, 500)
          );
        }
      });
      return m;
    } catch {
      return new Map();
    }
  }

  function saveAdjustments() {
    const obj = {};
    state.adjustments.forEach((list, goalId) => {
      obj[goalId] = list.slice(0, 500);
    });
    localStorage.setItem(ADJUST_KEY, JSON.stringify(obj));
  }

  function loadGoalHistory() {
    const raw = localStorage.getItem(GOAL_HISTORY_KEY);
    if (!raw) return new Map();
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") return new Map();
      const m = new Map();
      Object.entries(parsed).forEach(([goalId, list]) => {
        if (Array.isArray(list)) {
          m.set(
            goalId,
            list
              .filter((x) => x && typeof x.ts === "number")
              .slice(0, 5000)
          );
        }
      });
      return m;
    } catch {
      return new Map();
    }
  }

  function addAdjustment(goalId, description) {
    const trimmed = String(description || "").trim();
    if (!trimmed) return;
    const list = state.adjustments.get(goalId) || [];
    list.unshift({ ts: Date.now(), description: trimmed });
    state.adjustments.set(goalId, list.slice(0, 500));
    saveAdjustments();
  }

  function seedExampleHistory() {
    const now = new Date();
    const baseYear = now.getFullYear() - 9;
    const history = new Map();

    function yearTs(y) {
      return new Date(y, 0, 1).getTime();
    }

    const goals = ["temp", "energy", "green", "transport", "water", "air"];
    goals.forEach((g) => history.set(g, []));

    for (let y = 0; y < 10; y++) {
      const year = baseYear + y;
      const ts = yearTs(year);

      history.get("temp").push({
        ts,
        avgTemp: 28 + y * 0.05,
        hotspots: 4 + (y % 3),
        coolingOn: 10 + y,
        totalSensors: 30,
      });

      history.get("energy").push({
        ts,
        totalKw: 2800 + y * 30,
        totalKwh: 48000 + y * 900,
      });

      history.get("green").push({
        ts,
        avgCanopy: 38 + y * 0.7,
        avgNative: 0.52 + y * 0.01,
        avgPoll: 0.48 + y * 0.012,
      });

      history.get("transport").push({
        ts,
        ridership: 520 + y * 35,
        avgHeadway: 16 - y * 0.2,
        avgOnTime: 82 + y * 0.6,
      });

      history.get("water").push({
        ts,
        totalLpm: 1800 + y * 25,
        totalM3: 260 + y * 8,
        diversionPct: 32 + y * 1.2,
        binsFull: 6,
      });

      history.get("air").push({
        ts,
        avgAqi: 65 - y * 0.4,
        worstAqi: 120 - y * 0.8,
        alerts: 14 - y,
      });
    }

    // Example adjustments for a richer view
    const adjustments = new Map();
    adjustments.set("temp", [
      {
        ts: yearTs(baseYear + 2),
        description: "Introduced tighter temperature setpoints for residential colleges.",
      },
      {
        ts: yearTs(baseYear + 6),
        description: "Rolled out smart thermostat pilot at selected faculties.",
      },
    ]);
    adjustments.set("energy", [
      {
        ts: yearTs(baseYear + 3),
        description: "Retrofitted lecture halls with LED lighting.",
      },
    ]);
    adjustments.set("transport", [
      {
        ts: yearTs(baseYear + 4),
        description: "Added one additional bus to line C during peak hours.",
      },
    ]);

    const histObj = {};
    history.forEach((list, id) => {
      histObj[id] = list;
    });
    localStorage.setItem(GOAL_HISTORY_KEY, JSON.stringify(histObj));

    const adjObj = {};
    adjustments.forEach((list, id) => {
      adjObj[id] = list;
    });
    localStorage.setItem(ADJUST_KEY, JSON.stringify(adjObj));

    state.goalHistory = history;
    state.adjustments = adjustments;
  }

  function setGoal(goalId) {
    state.goal = goalId;
    $$(".goalNav .goalBtn").forEach((btn) =>
      btn.classList.toggle("is-active", btn.dataset.statGoal === goalId)
    );
    const form = $("#statAdjustmentForm");
    if (form) form.dataset.goal = goalId;
    render();
  }

  function groupByYear(entries) {
    const byYear = new Map();
    entries.forEach((e) => {
      const year = new Date(e.ts).getFullYear();
      const key = String(year);
      const arr = byYear.get(key) || [];
      arr.push(e);
      byYear.set(key, arr);
    });
    return Array.from(byYear.entries())
      .sort((a, b) => Number(a[0]) - Number(b[0]))
      .map(([year, arr]) => ({ year, entries: arr }));
  }

  function render() {
    const goalId = state.goal;
    const entries = state.goalHistory.get(goalId) || [];
    const yearly = groupByYear(entries);

    const titleEl = $("#statGoalTitle");
    const subtitleEl = $("#statGoalSubtitle");
    const cardsEl = $("#statCards");
    const tableTitleEl = $("#statTableTitle");

    if (goalId === "temp") {
      titleEl.textContent = "Campus Temperature – Long-Term Overview";
      subtitleEl.textContent =
        "Average campus temperature, hotspots and IoT cooling activity summarised by year.";
      tableTitleEl.textContent = "Yearly temperature statistics";
    } else if (goalId === "energy") {
      titleEl.textContent = "Energy Usage – Long-Term Overview";
      subtitleEl.textContent =
        "Total campus demand and consumption, supporting efficiency benchmarking across years.";
      tableTitleEl.textContent = "Yearly energy statistics";
    } else if (goalId === "green") {
      titleEl.textContent = "Green Space & Biodiversity – Long-Term Overview";
      subtitleEl.textContent =
        "Canopy coverage and biodiversity indicators to track restoration programmes over time.";
      tableTitleEl.textContent = "Yearly green space statistics";
    } else if (goalId === "transport") {
      titleEl.textContent = "Transportation Efficiency – Long-Term Overview";
      subtitleEl.textContent =
        "Ridership, headway and punctuality statistics derived from UM bus sensor snapshots.";
      tableTitleEl.textContent = "Yearly transport statistics";
    } else if (goalId === "water") {
      titleEl.textContent = "Water & Recycling – Long-Term Overview";
      subtitleEl.textContent =
        "Water usage, leak risk and recycling diversion, based on periodic sensor snapshots.";
      tableTitleEl.textContent = "Yearly water & recycling statistics";
    } else if (goalId === "air") {
      titleEl.textContent = "Air Quality – Long-Term Overview";
      subtitleEl.textContent =
        "Campus AQI distribution and alert counts to support mitigation planning.";
      tableTitleEl.textContent = "Yearly air quality statistics";
    }

    const totalYears = yearly.length;
    const totalSamples = entries.length;
    cardsEl.innerHTML = [
      card("History span", totalYears ? `${yearly[0].year} – ${yearly[yearly.length - 1].year}` : "No data", "Based on snapshots stored from the live dashboard in this browser."),
      card("Snapshots", String(totalSamples), "Number of sensor snapshots aggregated into these statistics."),
      card("Max retention", "10 years", "Design target – in production, connect to UM data warehouse."),
    ].join("");

    renderTable(goalId, yearly);
    renderChart(goalId, yearly);
    renderAdjustments(goalId);
  }

  function card(title, valueHtml, hint) {
    return `
      <div class="card">
        <div class="card__title">${escapeHtml(title)}</div>
        <div class="card__value">${valueHtml}</div>
        <div class="card__hint">${escapeHtml(hint)}</div>
      </div>
    `;
  }

  function renderTable(goalId, yearly) {
    const headEl = $("#statTableHead");
    const bodyEl = $("#statTableBody");

    let headers;
    if (goalId === "temp") {
      headers = ["Year", "Avg temp (°C)", "Avg hotspots", "Avg cooling ON"];
    } else if (goalId === "energy") {
      headers = ["Year", "Avg demand (kW)", "Avg energy (kWh)"];
    } else if (goalId === "green") {
      headers = ["Year", "Avg canopy (%)", "Native index", "Pollinator score"];
    } else if (goalId === "transport") {
      headers = ["Year", "Avg ridership", "Avg headway (min)", "Avg on-time (%)"];
    } else if (goalId === "water") {
      headers = ["Year", "Avg flow (L/min)", "Avg volume (m³)", "Avg diversion (%)"];
    } else {
      headers = ["Year", "Avg AQI", "Worst AQI", "Alerts / year"];
    }

    headEl.innerHTML = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;

    const rows = yearly.map(({ year, entries }) => {
      const n = entries.length || 1;
      if (goalId === "temp") {
        const sums = entries.reduce(
          (acc, e) => {
            acc.avgTemp += e.avgTemp || 0;
            acc.hotspots += e.hotspots || 0;
            acc.cooling += e.coolingOn || 0;
            return acc;
          },
          { avgTemp: 0, hotspots: 0, cooling: 0 }
        );
        return [
          year,
          fmt.n(sums.avgTemp / n, 2),
          fmt.n(sums.hotspots / n, 1),
          fmt.n(sums.cooling / n, 1),
        ];
      }
      if (goalId === "energy") {
        const sums = entries.reduce(
          (acc, e) => {
            acc.kw += e.totalKw || 0;
            acc.kwh += e.totalKwh || 0;
            return acc;
          },
          { kw: 0, kwh: 0 }
        );
        return [year, fmt.n(sums.kw / n, 1), fmt.n(sums.kwh / n, 1)];
      }
      if (goalId === "green") {
        const sums = entries.reduce(
          (acc, e) => {
            acc.canopy += e.avgCanopy || 0;
            acc.native += e.avgNative || 0;
            acc.poll += e.avgPoll || 0;
            return acc;
          },
          { canopy: 0, native: 0, poll: 0 }
        );
        return [
          year,
          fmt.n(sums.canopy / n, 1),
          fmt.n(sums.native / n, 3),
          fmt.n(sums.poll / n, 3),
        ];
      }
      if (goalId === "transport") {
        const sums = entries.reduce(
          (acc, e) => {
            acc.ridership += e.ridership || 0;
            acc.headway += e.avgHeadway || 0;
            acc.onTime += e.avgOnTime || 0;
            return acc;
          },
          { ridership: 0, headway: 0, onTime: 0 }
        );
        return [
          year,
          fmt.n(sums.ridership / n, 0),
          fmt.n(sums.headway / n, 1),
          fmt.n(sums.onTime / n, 1),
        ];
      }
      if (goalId === "water") {
        const sums = entries.reduce(
          (acc, e) => {
            acc.flow += e.totalLpm || 0;
            acc.volume += e.totalM3 || 0;
            acc.diversion += e.diversionPct || 0;
            return acc;
          },
          { flow: 0, volume: 0, diversion: 0 }
        );
        return [
          year,
          fmt.n(sums.flow / n, 1),
          fmt.n(sums.volume / n, 2),
          fmt.n(sums.diversion / n, 1),
        ];
      }

      const sums = entries.reduce(
        (acc, e) => {
          acc.avgAqi += e.avgAqi || 0;
          acc.worstAqi = Math.max(acc.worstAqi, e.worstAqi || 0);
          acc.alerts += e.alerts || 0;
          return acc;
        },
        { avgAqi: 0, worstAqi: 0, alerts: 0 }
      );
      return [
        year,
        fmt.n(sums.avgAqi / n, 1),
        fmt.n(sums.worstAqi, 0),
        fmt.n(sums.alerts, 0),
      ];
    });

    bodyEl.innerHTML = rows
      .map(
        (r) => `<tr>${r.map((c) => `<td>${typeof c === "string" ? escapeHtml(c) : String(c)}</td>`).join("")}</tr>`
      )
      .join("");
  }

  function renderAdjustments(goalId) {
    const listEl = $("#statAdjustmentList");
    const list = state.adjustments.get(goalId) || [];
    if (!list.length) {
      listEl.innerHTML =
        '<div class="transportStats__itemMeta">No adjustments recorded yet for this goal.</div>';
      return;
    }
    listEl.innerHTML = list
      .slice(0, 50)
      .map(
        (a) => `
        <div class="transportStats__item">
          <div class="transportStats__itemMain">
            <div>${escapeHtml(a.description)}</div>
            <div class="transportStats__itemMeta">
              ${escapeHtml(new Date(a.ts).toLocaleString())}
            </div>
          </div>
        </div>
      `
      )
      .join("");
  }

  function exportCsv() {
    const goalId = state.goal;
    const entries = state.goalHistory.get(goalId) || [];
    if (!entries.length) {
      alert("No history stored yet for this goal. Keep the live dashboard open to accumulate data.");
      return;
    }

    const headers = ["timestamp", "iso_date", ...Object.keys(entries[0]).filter((k) => k !== "ts")];
    const rows = entries.map((e) => {
      const date = new Date(e.ts);
      const base = [String(e.ts), date.toISOString()];
      const rest = headers.slice(2).map((k) => (e[k] == null ? "" : String(e[k])));
      return base.concat(rest);
    });

    const csv = [headers.join(","), ...rows.map((r) => r.map(csvEscape).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const now = new Date();
    a.href = url;
    a.download = `cool-um-${goalId}-statistics-${now.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function csvEscape(v) {
    if (v.includes(",") || v.includes('"') || v.includes("\n")) {
      return `"${v.replaceAll('"', '""')}"`;
    }
    return v;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function wireUI() {
    $$(".goalNav .goalBtn").forEach((btn) => {
      btn.addEventListener("click", () => setGoal(btn.dataset.statGoal));
    });

    const form = $("#statAdjustmentForm");
    if (form) {
      form.addEventListener("submit", (ev) => {
        ev.preventDefault();
        const goalId = form.dataset.goal || "temp";
        const textarea = form.querySelector("textarea[name='description']");
        const desc = textarea ? textarea.value : "";
        addAdjustment(goalId, desc);
        if (textarea) textarea.value = "";
        renderAdjustments(goalId);
      });
    }

    const btnExport = $("#btnExportCsv");
    if (btnExport) {
      btnExport.addEventListener("click", exportCsv);
    }
  }

  function renderChart(goalId, yearly) {
    const grid = document.getElementById("chartGrid");
    if (!grid) return;

    // 1. Destroy all existing charts to prevent overlap/glitches
    currentCharts.forEach(chart => chart.destroy());
    currentCharts = [];
    grid.innerHTML = ""; // Clear the grid

    const labels = yearly.map((y) => y.year);

    // Helper function to dynamically build chart cards
    function createChart(type, title, datasets, yAxisStartsAtZero = false) {
      // Create HTML structure for the chart card
      const wrapper = document.createElement("div");
      wrapper.style.cssText = "background: rgba(4,16,33,.60); border: 1px solid var(--line); border-radius: 16px; padding: 14px; height: 280px; display: flex; flex-direction: column;";
      
      const titleEl = document.createElement("div");
      titleEl.style.cssText = "font-weight: 800; font-size: 13px; margin-bottom: 10px; color: var(--text);";
      titleEl.textContent = title;

      const canvasWrap = document.createElement("div");
      canvasWrap.style.cssText = "flex: 1; min-height: 0; position: relative;";
      
      const canvas = document.createElement("canvas");
      canvasWrap.appendChild(canvas);
      wrapper.appendChild(titleEl);
      wrapper.appendChild(canvasWrap);
      grid.appendChild(wrapper);

      // Render the Chart.js instance
      const chart = new Chart(canvas, {
        type: type,
        data: { labels, datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { labels: { color: "#f3f7ff", font: { family: 'ui-sans-serif, system-ui', size: 11 } } }
          },
          scales: {
            x: { 
              ticks: { color: "#8fa2ce" }, 
              grid: { color: "rgba(195,210,240,0.08)" } 
            },
            y: { 
              ticks: { color: "#8fa2ce" }, 
              grid: { color: "rgba(195,210,240,0.08)" },
              beginAtZero: yAxisStartsAtZero // False allows line charts to zoom in on small changes
            }
          }
        }
      });
      currentCharts.push(chart);
    }

    // --- 2. Build specific charts based on the active goal ---
    
    // GOAL 1: TEMPERATURE
    if (goalId === "temp") {
      const temp = yearly.map(y => y.entries.reduce((s, e) => s + (e.avgTemp||0), 0) / Math.max(1, y.entries.length));
      const hotspots = yearly.map(y => y.entries.reduce((s, e) => s + (e.hotspots||0), 0) / Math.max(1, y.entries.length));
      const cooling = yearly.map(y => y.entries.reduce((s, e) => s + (e.coolingOn||0), 0) / Math.max(1, y.entries.length));

      createChart('line', 'Average Campus Temperature (°C)', [
        { label: "Avg Temp (°C)", data: temp, borderColor: "#ff5d7a", backgroundColor: "rgba(255, 93, 122, 0.2)", fill: true, tension: 0.3 }
      ], false); // beginAtZero: false so the line isn't flat

      createChart('bar', 'Hotspots vs IoT Cooling Activations', [
        { label: "Hotspots Detected", data: hotspots, backgroundColor: "#ffb347" },
        { label: "IoT Cooling ON", data: cooling, backgroundColor: "#46d6ff" }
      ], true);
    } 
    
    // GOAL 2: ENERGY
    else if (goalId === "energy") {
      const kw = yearly.map(y => y.entries.reduce((s, e) => s + (e.totalKw||0), 0) / Math.max(1, y.entries.length));
      const kwh = yearly.map(y => y.entries.reduce((s, e) => s + (e.totalKwh||0), 0) / Math.max(1, y.entries.length));

      createChart('line', 'Average Demand (kW)', [
        { label: "Demand (kW)", data: kw, borderColor: "#ffd100", backgroundColor: "rgba(255, 209, 0, 0.2)", fill: true, tension: 0.3 }
      ], false);

      createChart('bar', 'Average Daily Consumption (kWh)', [
        { label: "Energy (kWh)", data: kwh, backgroundColor: "rgba(255, 209, 0, 0.8)" }
      ], true);
    } 
    
    // GOAL 3: GREEN
    else if (goalId === "green") {
      const canopy = yearly.map(y => y.entries.reduce((s, e) => s + (e.avgCanopy||0), 0) / Math.max(1, y.entries.length));
      const native = yearly.map(y => y.entries.reduce((s, e) => s + (e.avgNative||0), 0) / Math.max(1, y.entries.length));
      const poll = yearly.map(y => y.entries.reduce((s, e) => s + (e.avgPoll||0), 0) / Math.max(1, y.entries.length));

      createChart('line', 'Canopy Coverage (%)', [
        { label: "Canopy (%)", data: canopy, borderColor: "#45ff9a", backgroundColor: "rgba(69, 255, 154, 0.2)", fill: true, tension: 0.3 }
      ], false);

      createChart('line', 'Biodiversity Indicators (0 - 1.0)', [
        { label: "Native Index", data: native, borderColor: "#46d6ff", backgroundColor: "transparent", tension: 0.3 },
        { label: "Pollinator Score", data: poll, borderColor: "#ffb347", backgroundColor: "transparent", tension: 0.3 }
      ], false);
    } 
    
    // GOAL 4: TRANSPORT
    else if (goalId === "transport") {
      const ridership = yearly.map(y => y.entries.reduce((s, e) => s + (e.ridership||0), 0) / Math.max(1, y.entries.length));
      const headway = yearly.map(y => y.entries.reduce((s, e) => s + (e.avgHeadway||0), 0) / Math.max(1, y.entries.length));
      const onTime = yearly.map(y => y.entries.reduce((s, e) => s + (e.avgOnTime||0), 0) / Math.max(1, y.entries.length));

      createChart('bar', 'Daily Ridership', [
        { label: "Total Ridership", data: ridership, backgroundColor: "#b59cff" }
      ], true);

      createChart('line', 'Efficiency: Headway vs On-Time', [
        { label: "Avg Headway (mins)", data: headway, borderColor: "#ff5d7a", backgroundColor: "transparent", tension: 0.3 },
        { label: "On-Time (%)", data: onTime, borderColor: "#45ff9a", backgroundColor: "transparent", tension: 0.3 }
      ], false);
    } 
    
    // GOAL 5: WATER
    else if (goalId === "water") {
      const flow = yearly.map(y => y.entries.reduce((s, e) => s + (e.totalLpm||0), 0) / Math.max(1, y.entries.length));
      const volume = yearly.map(y => y.entries.reduce((s, e) => s + (e.totalM3||0), 0) / Math.max(1, y.entries.length));
      const diversion = yearly.map(y => y.entries.reduce((s, e) => s + (e.diversionPct||0), 0) / Math.max(1, y.entries.length));

      createChart('bar', 'Water Flow & Volume', [
        { label: "Flow (L/min)", data: flow, backgroundColor: "#46d6ff" },
        { label: "Volume (m³)", data: volume, backgroundColor: "#064b8f" }
      ], true);

      createChart('line', 'Recycling Diversion Rate (%)', [
        { label: "Diversion (%)", data: diversion, borderColor: "#45ff9a", backgroundColor: "rgba(69, 255, 154, 0.2)", fill: true, tension: 0.3 }
      ], false);
    } 
    
    // GOAL 6: AIR
    else if (goalId === "air") {
      const avgAqi = yearly.map(y => y.entries.reduce((s, e) => s + (e.avgAqi||0), 0) / Math.max(1, y.entries.length));
      const worstAqi = yearly.map(y => y.entries.reduce((max, e) => Math.max(max, e.worstAqi||0), 0));
      const alerts = yearly.map(y => y.entries.reduce((s, e) => s + (e.alerts||0), 0) / Math.max(1, y.entries.length));

      createChart('line', 'Air Quality Index (AQI)', [
        { label: "Average AQI", data: avgAqi, borderColor: "#46d6ff", backgroundColor: "transparent", tension: 0.3 },
        { label: "Worst AQI", data: worstAqi, borderColor: "#ffb347", backgroundColor: "transparent", tension: 0.3 }
      ], false);

      createChart('bar', 'Air Quality Alerts per Year', [
        { label: "Alerts", data: alerts, backgroundColor: "#ff5d7a" }
      ], true);
    }
  }

  wireUI();
  render();
})();