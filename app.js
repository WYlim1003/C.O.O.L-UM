/* global L, UM_DEMO */

(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  const fmt = {
    n: (v, d = 0) => Number(v).toFixed(d),
    pct: (v, d = 0) => `${Number(v).toFixed(d)}%`,
    ts: (ms) => new Date(ms).toLocaleString(),
  };

  // Storage keys
  const STORAGE_KEY = "um_demo_green_points_v1";
  const HISTORY_KEY = "um_demo_green_points_history_v1";
  const ADJUST_KEY = "um_demo_adjustments_v1";
  const GOAL_HISTORY_KEY = "um_demo_goal_history_v1";

  const state = {
    goal: "temp",
    realtime: true,
    lastTickMs: Date.now(),
    tick: 0,
    gp: 0,
    history: [],

    sensors: {
      // populated at init
      tempByPlace: new Map(), // id -> { tempC, humidityPct, heatIndexC, iotCoolingOn, lastSeenMs }
      airByPlace: new Map(), // id -> { aqi, pm25, co2ppm, lastSeenMs }
    },

    energyByBuilding: new Map(), // id -> { kwNow, kwhToday, baselineKwhToday }
    waterByBuilding: new Map(), // id -> { lpmNow, m3Today, leakRisk }
    recycling: { diversionPct: 0, contaminationPct: 0, binsFull: 0 },
    buses: new Map(), // line -> { activeBuses, headwayMin, ridershipNow, onTimePct }
    busHistory: new Map(), // line -> [{ ts, headwayMin, ridershipNow, onTimePct, activeBuses }]
    adjustments: new Map(),
    goalHistory: new Map(),
    selectedBusLine: "AB",
    biodiversity: new Map(), // zone -> { canopyPct, nativeSpeciesIndex, pollinatorScore }
    filters: {
      category: "all",
      placeId: "all",
    },
  };

  // Load persisted data after state is initialized
  state.gp = loadGP();
  state.history = loadHistory();
  state.adjustments = loadAdjustments();
  state.goalHistory = loadGoalHistory();

  // ---------- Persistence ----------
  function loadGP() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return 0;
    try {
      const num = JSON.parse(raw);
      return Number.isFinite(num) ? num : 0;
    } catch {
      return 0;
    }
  }

  function saveGP() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.gp));
  }

  // Simple reward earn function
  function earnReward(rewardId, description = "") {
    const rewards = {
      recycle: { title: "Recycle correctly", points: 10 },
      transport: { title: "Green transport", points: 8 },
      report: { title: "Report campus issue", points: 5 },
      event: { title: "Sustainability program", points: 15 },
    };

    const reward = rewards[rewardId];
    if (!reward) return;

    const delta = reward.points;
    state.gp += delta;
    state.history.unshift({
      ts: Date.now(),
      delta,
      title: reward.title,
      description: description || reward.title,
    });

    // Limit history to 50 entries
    if (state.history.length > 50) {
      state.history = state.history.slice(0, 50);
    }

    saveGP();
    saveHistory();
    renderGP();
    renderRecentActivity();

    console.log(`Earned ${delta} GP for: ${reward.title}`);
    return { success: true, points: delta };
  }

  // Open submission dialog for proof submission
  function openSubmissionDialog(rewardId) {
    const rewards = {
      recycle: { 
        title: "Recycle correctly", 
        points: 10, 
        verificationType: "photo",
        subtitle: "Upload a photo of your recycling activity"
      },
      transport: { 
        title: "Green transport", 
        points: 8, 
        verificationType: "qr",
        subtitle: "Scan QR code at bus stop or bike station"
      },
      report: { 
        title: "Report campus issue", 
        points: 5, 
        verificationType: "location",
        subtitle: "Select location of environmental issue"
      },
      event: { 
        title: "Sustainability program", 
        points: 15, 
        verificationType: "attendance",
        subtitle: "Enter event code from organizer"
      },
    };

    const reward = rewards[rewardId];
    if (!reward) return;

    state.currentSubmission = {
      rewardId,
      reward,
      evidence: null,
    };

    $("#submissionTitle").textContent = reward.title;
    $("#submissionSubtitle").textContent = reward.subtitle;
    $("#submissionDescription").value = "";

    // Build appropriate form fields based on verification type
    const fieldsContainer = $("#submissionFields");
    fieldsContainer.innerHTML = "";

    if (reward.verificationType === "photo") {
      fieldsContainer.innerHTML = `
        <div class="submissionForm__group">
          <label class="submissionForm__label">Upload Photo</label>
          <input type="file" accept="image/*" id="photoInput" class="submissionForm__input" required />
          <div class="submissionForm__hint">Photo of your recycling activity (max 500KB)</div>
        </div>
      `;

      $("#photoInput").addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (file) {
          try {
            const dataUrl = await handlePhotoUpload(file);
            state.currentSubmission.evidence = { type: "photo", data: dataUrl };
          } catch (err) {
            alert(err.message);
            e.target.value = "";
          }
        }
      });
    } else if (reward.verificationType === "qr") {
      fieldsContainer.innerHTML = `
        <div class="submissionForm__group">
          <label class="submissionForm__label">QR Code</label>
          <button type="button" class="btn" id="btnMockQR">Simulate QR Scan</button>
          <div class="submissionForm__hint" id="qrResult">Click to scan QR code</div>
        </div>
      `;

      $("#btnMockQR").addEventListener("click", () => {
        const qrData = generateMockQRScan();
        state.currentSubmission.evidence = { type: "qr", ...qrData };
        $("#qrResult").textContent = `✓ Scanned: ${qrData.placeName}`;
        $("#qrResult").style.color = "#45ff9a";
      });
    } else if (reward.verificationType === "location") {
      const locations = UM_DEMO?.campusPlaces || [];
      const options = locations.map(p => 
        `<option value="${p.id}">${p.name}</option>`
      ).join("");

      fieldsContainer.innerHTML = `
        <div class="submissionForm__group">
          <label class="submissionForm__label">Location</label>
          <select id="locationSelect" class="submissionForm__input" required>
            <option value="">Select location...</option>
            ${options}
          </select>
          <div class="submissionForm__hint">Where did you notice the issue?</div>
        </div>
      `;

      $("#locationSelect").addEventListener("change", (e) => {
        const placeId = e.target.value;
        const place = locations.find(p => p.id === placeId);
        if (place) {
          state.currentSubmission.evidence = { 
            type: "location", 
            placeId: place.id,
            placeName: place.name
          };
        }
      });
    } else if (reward.verificationType === "attendance") {
      fieldsContainer.innerHTML = `
        <div class="submissionForm__group">
          <label class="submissionForm__label">Event Code</label>
          <input type="text" id="eventCodeInput" class="submissionForm__input" 
                 placeholder="e.g., TREE2026" required />
          <div class="submissionForm__hint">Enter the event code provided by organizer</div>
        </div>
      `;

      $("#eventCodeInput").addEventListener("input", (e) => {
        const code = e.target.value.trim().toUpperCase();
        if (code) {
          state.currentSubmission.evidence = { 
            type: "attendance", 
            eventCode: code
          };
        }
      });
    }

    $("#submissionDialog").showModal();
  }

  // Handle photo upload
  function handlePhotoUpload(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }

      if (file.size > 500000) {
        reject(new Error("File too large (max 500KB)"));
        return;
      }

      if (!file.type.startsWith("image/")) {
        reject(new Error("File must be an image"));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  // Generate mock QR scan data
  function generateMockQRScan() {
    const qrLocations = [
      { code: "QR_UMCENTRAL_BUS", placeId: "um-central", name: "UM Central Bus Stop" },
      { code: "QR_SPORT_BIKE", placeId: "sport-centre", name: "Sports Centre Bike Station" },
      { code: "QR_FSKTM_BUS", placeId: "fsktm", name: "FSKTM Bus Stop" },
      { code: "QR_KK7_BIKE", placeId: "kk7", name: "KK7 Bike Station" },
    ];
    const randomQR = qrLocations[Math.floor(Math.random() * qrLocations.length)];
    return {
      code: randomQR.code,
      placeId: randomQR.placeId,
      placeName: randomQR.name,
      scannedAt: Date.now()
    };
  }


  function loadHistory() {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveHistory() {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(state.history.slice(0, 60)));
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
              .slice(0, 80)
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
      obj[goalId] = list.slice(0, 80);
    });
    localStorage.setItem(ADJUST_KEY, JSON.stringify(obj));
  }

  function addAdjustment(goalId, description) {
    const trimmed = String(description || "").trim();
    if (!trimmed) return;
    const list = state.adjustments.get(goalId) || [];
    list.unshift({ ts: Date.now(), description: trimmed });
    state.adjustments.set(goalId, list.slice(0, 80));
    saveAdjustments();
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

  function saveGoalHistory() {
    const obj = {};
    state.goalHistory.forEach((list, goalId) => {
      obj[goalId] = list.slice(0, 5000);
    });
    localStorage.setItem(GOAL_HISTORY_KEY, JSON.stringify(obj));
  }

  function addGP(delta, title) {
    state.gp += delta;
    saveGP();
    state.history.unshift({ ts: Date.now(), delta, title });
    state.history = state.history.slice(0, 60);
    saveHistory();
    renderGP();
  }

  // ---------- Authentication ----------
  function login(matricNumber, password) {
    const student = UM_DEMO.DEMO_STUDENTS.find(
      s => s.matricNumber === matricNumber && s.password === password
    );
    
    if (!student) {
      return { success: false, message: "Invalid matric number or password" };
    }

    const { password: _, ...studentData } = student;
    state.currentStudent = studentData;
    saveCurrentStudent(studentData);
    
    const students = loadAllStudentsData();
    if (!students[matricNumber]) {
      students[matricNumber] = { ...studentData, gp: 0 };
      localStorage.setItem(STUDENTS_DATA_KEY, JSON.stringify(students));
    }
    
    state.gp = loadGP();
    state.history = loadHistory();
    
    return { success: true };
  }

  function logout() {
    state.currentStudent = null;
    saveCurrentStudent(null);
    state.gp = 0;
    state.history = [];
    hideStudentUI();
  }

  function showLoginScreen(onSuccess) {
    $("#loginScreen").classList.remove("hidden");
    state._loginCallback = onSuccess;
  }

  function hideLoginScreen() {
    $("#loginScreen").classList.add("hidden");
  }

  function showStudentUI() {
    $("#studentProfile").style.display = "flex";
    $("#gpKpi").style.display = "flex";
    // Admin panel hidden for demo
    // const adminBtn = $("#btnOpenAdmin");
    // if (adminBtn) adminBtn.style.display = "inline-flex";
    $("#btnLogout").style.display = "inline-flex";
  }

  function hideStudentUI() {
    $("#studentProfile").style.display = "none";
    $("#gpKpi").style.display = "none";
    const adminBtn = $("#btnOpenAdmin");
    if (adminBtn) adminBtn.style.display = "none";
    $("#btnLogout").style.display = "none";
  }

  // ---------- Claim Submission & Management ----------
  function generateClaimId() {
    return `claim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  function getClaimsForStudent(matricNumber) {
    return state.claims.filter(c => c.studentMatric === matricNumber);
  }

  function getClaimsByStatus(status) {
    if (!state.currentStudent) return [];
    return getClaimsForStudent(state.currentStudent.matricNumber)
      .filter(c => c.status === status)
      .sort((a, b) => b.submittedAt - a.submittedAt);
  }

  function getTodayClaimsForReward(rewardId) {
    if (!state.currentStudent) return [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return getClaimsForStudent(state.currentStudent.matricNumber).filter(c => 
      c.rewardId === rewardId && 
      c.submittedAt >= today.getTime() &&
      c.status !== UM_DEMO.CLAIM_STATUS.REJECTED
    );
  }

  function canSubmitClaim(rewardId) {
    const reward = UM_DEMO.REWARD_TYPES.find(r => r.id === rewardId);
    if (!reward) return { canSubmit: false, reason: "Invalid reward type" };
    
    if (reward.dailyLimit !== null) {
      const todayClaims = getTodayClaimsForReward(rewardId);
      if (todayClaims.length >= reward.dailyLimit) {
        return { 
          canSubmit: false, 
          reason: `Daily limit reached (${reward.dailyLimit} claims per day)` 
        };
      }
    }
    
    return { canSubmit: true };
  }

  function submitClaim(rewardId, evidence, location, description) {
    if (!state.currentStudent) return { success: false, message: "Not logged in" };
    
    const validation = canSubmitClaim(rewardId);
    if (!validation.canSubmit) {
      return { success: false, message: validation.reason };
    }

    const reward = UM_DEMO.REWARD_TYPES.find(r => r.id === rewardId);
    if (!reward) return { success: false, message: "Invalid reward" };

    if (!description || description.trim().length < 20) {
      return { success: false, message: "Description must be at least 20 characters" };
    }

    const claim = {
      claimId: generateClaimId(),
      studentMatric: state.currentStudent.matricNumber,
      studentName: state.currentStudent.name,
      rewardId: reward.id,
      rewardTitle: reward.title,
      rewardPoints: reward.points,
      status: reward.approvalFlow === "auto" ? UM_DEMO.CLAIM_STATUS.APPROVED : UM_DEMO.CLAIM_STATUS.PENDING,
      submittedAt: Date.now(),
      evidence: evidence,
      location: location,
      description: description.trim(),
      reviewedBy: reward.approvalFlow === "auto" ? "System (Auto-approved)" : null,
      reviewedAt: reward.approvalFlow === "auto" ? Date.now() : null,
      reviewNotes: reward.approvalFlow === "auto" ? "Automatically approved based on verification" : ""
    };

    state.claims.push(claim);
    saveClaims();

    if (claim.status === UM_DEMO.CLAIM_STATUS.APPROVED) {
      addGP(reward.points, reward.title);
    }

    return { success: true, claim, autoApproved: reward.approvalFlow === "auto" };
  }

  function approveClaim(claimId, notes = "") {
    const claim = state.claims.find(c => c.claimId === claimId);
    if (!claim) return { success: false, message: "Claim not found" };
    if (claim.status !== UM_DEMO.CLAIM_STATUS.PENDING) {
      return { success: false, message: "Claim already reviewed" };
    }

    claim.status = UM_DEMO.CLAIM_STATUS.APPROVED;
    claim.reviewedBy = "Admin";
    claim.reviewedAt = Date.now();
    claim.reviewNotes = notes;
    saveClaims();

    const students = loadAllStudentsData();
    if (students[claim.studentMatric]) {
      students[claim.studentMatric].gp = (students[claim.studentMatric].gp || 0) + claim.rewardPoints;
      localStorage.setItem(STUDENTS_DATA_KEY, JSON.stringify(students));
    }

    if (state.currentStudent && state.currentStudent.matricNumber === claim.studentMatric) {
      state.gp = loadGP();
      renderGP();
    }

    return { success: true };
  }

  function rejectClaim(claimId, notes = "") {
    const claim = state.claims.find(c => c.claimId === claimId);
    if (!claim) return { success: false, message: "Claim not found" };
    if (claim.status !== UM_DEMO.CLAIM_STATUS.PENDING) {
      return { success: false, message: "Claim already reviewed" };
    }

    claim.status = UM_DEMO.CLAIM_STATUS.REJECTED;
    claim.reviewedBy = "Admin";
    claim.reviewedAt = Date.now();
    claim.reviewNotes = notes || "Does not meet criteria";
    saveClaims();

    return { success: true };
  }

  // ---------- Evidence & Verification ----------
  function handlePhotoUpload(file) {
    return new Promise((resolve, reject) => {
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }

      if (file.size > 500000) {
        reject(new Error("File too large (max 500KB)"));
        return;
      }

      if (!file.type.startsWith("image/")) {
        reject(new Error("File must be an image"));
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => reject(new Error("Failed to read file"));
      reader.readAsDataURL(file);
    });
  }

  function generateMockQRScan() {
    const qrLocations = UM_DEMO.QR_LOCATIONS;
    const randomQR = qrLocations[Math.floor(Math.random() * qrLocations.length)];
    return {
      code: randomQR.code,
      placeId: randomQR.placeId,
      placeName: randomQR.name,
      scannedAt: Date.now()
    };
  }

  // ---------- Map ----------
  const map = L.map("map", { zoomControl: true });
  const umCenter = [UM_DEMO.UM_CENTER.lat, UM_DEMO.UM_CENTER.lng];
  map.setView(umCenter, 16);

  const campusById = new Map(UM_DEMO.campusPlaces.map((p) => [p.id, p]));

  // OSM tiles (works without API key). You can swap to Google Maps via embed/API if you have a key.
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  const markers = new Map(); // placeId -> marker
  const busRouteLayers = []; // Leaflet polylines for bus routes

  const PLACE_CATEGORY_CONFIG = [
    {
      id: "all",
      label: "All campus",
      matcher: () => true,
    },
    {
      id: "residential",
      label: "Residential colleges (KK / RC)",
      matcher: (p) =>
        p.zone === "Residential" ||
        /Residential College|Kolej Kediaman|RC/i.test(p.name || ""),
    },
    {
      id: "faculties",
      label: "Faculties & academies",
      matcher: (p) =>
        p.zone === "Academic" ||
        /(Faculty|Academy|Centre for Foundation)/i.test(p.name || ""),
    },
    {
      id: "admin",
      label: "Administration & student hubs",
      matcher: (p) =>
        /(Dewan Tunku Canselor|UM Central|Chancellery|Registrar|Bursar)/i.test(
          p.name || ""
        ) || p.zone === "Admin" || p.zone === "Student",
    },
    {
      id: "facilities",
      label: "Facilities & green",
      matcher: (p) =>
        /(Sports Centre|Tasik Varsiti|Stadium|Swimming Pool|Mosque|Health Centre|Library)/i.test(
          p.name || ""
        ) || p.zone === "Sports" || p.zone === "Green",
    },
    {
      id: "external",
      label: "Off-campus / external",
      matcher: (p) => p.zone === "External",
    },
  ];

  function markerColorForTemp(tempC) {
    if (tempC >= 33) return "#ff5d7a";
    if (tempC >= 31) return "#ffd25e";
    if (tempC >= 29) return "#46d6ff";
    return "#45ff9a";
  }

  function markerColorForAQI(aqi) {
    if (aqi <= 50) return "#45ff9a";
    if (aqi <= 100) return "#ffd25e";
    if (aqi <= 150) return "#ffb84a";
    return "#ff5d7a";
  }

  function makeDotIcon(color) {
    return L.divIcon({
      className: "dotIcon",
      html: `<div style="
        width: 14px;height:14px;border-radius:999px;
        background:${color};
        box-shadow:0 0 0 2px rgba(0,0,0,.35), 0 10px 22px rgba(0,0,0,.30);
        border:1px solid rgba(255,255,255,.25);
      "></div>`,
      iconSize: [14, 14],
      iconAnchor: [7, 7],
      popupAnchor: [0, -10],
    });
  }

  function ensureMarkers() {
    UM_DEMO.campusPlaces.forEach((p) => {
      if (markers.has(p.id)) return;
      const m = L.marker([p.lat, p.lng], { icon: makeDotIcon("#46d6ff") }).addTo(map);
      m.bindPopup("Loading…");
      markers.set(p.id, m);
    });
  }

  function clearBusRoutes() {
    busRouteLayers.forEach((l) => map.removeLayer(l));
    busRouteLayers.length = 0;
  }

  function drawBusRoutes() {
    clearBusRoutes();
    (UM_DEMO.busRoutes || []).forEach((route) => {
      const latlngs = route.stops
        .map((id) => campusById.get(id))
        .filter(Boolean)
        .map((p) => [p.lat, p.lng]);
      if (latlngs.length < 2) return;
      const line = L.polyline(latlngs, {
        color: route.color || "#46d6ff",
        weight: 4,
        opacity: 0.85,
      }).addTo(map);
      busRouteLayers.push(line);
    });
  }

  function updateMarkerPopups() {
    UM_DEMO.campusPlaces.forEach((p) => {
      const m = markers.get(p.id);
      if (!m) return;
      if (state.goal === "temp") {
        const t = state.sensors.tempByPlace.get(p.id);
        if (!t) return;
        m.setIcon(makeDotIcon(markerColorForTemp(t.tempC)));
        m.setPopupContent(`
          <div class="popupTitle">${escapeHtml(p.name)}</div>
          <div class="popupRow"><span>Temperature</span><strong>${fmt.n(t.tempC, 1)} °C</strong></div>
          <div class="popupRow"><span>Humidity</span><strong>${fmt.n(t.humidityPct, 0)}%</strong></div>
          <div class="popupRow"><span>Heat Index</span><strong>${fmt.n(t.heatIndexC, 1)} °C</strong></div>
          <div class="popupRow"><span>IoT Cooling</span><strong>${t.iotCoolingOn ? "ON" : "OFF"}</strong></div>
          <div class="popupRow"><span>Last seen</span><strong>${new Date(t.lastSeenMs).toLocaleTimeString()}</strong></div>
        `);
      } else if (state.goal === "air") {
        const a = state.sensors.airByPlace.get(p.id);
        if (!a) return;
        m.setIcon(makeDotIcon(markerColorForAQI(a.aqi)));
        const band = aqiBand(a.aqi);
        m.setPopupContent(`
          <div class="popupTitle">${escapeHtml(p.name)}</div>
          <div class="popupRow"><span>AQI</span><strong>${fmt.n(a.aqi, 0)} (${band.label})</strong></div>
          <div class="popupRow"><span>PM2.5</span><strong>${fmt.n(a.pm25, 1)} µg/m³</strong></div>
          <div class="popupRow"><span>CO₂</span><strong>${fmt.n(a.co2ppm, 0)} ppm</strong></div>
          <div class="popupRow"><span>Last seen</span><strong>${new Date(a.lastSeenMs).toLocaleTimeString()}</strong></div>
        `);
      } else {
        m.setIcon(makeDotIcon("#46d6ff"));
        m.setPopupContent(`<div class="popupTitle">${escapeHtml(p.name)}</div>`);
      }
    });
  }

  function renderLegend() {
    const el = $("#mapLegend");
    if (!el) return;
    if (state.goal === "temp") {
      el.innerHTML = [
        legendItem("#45ff9a", "Cooler"),
        legendItem("#46d6ff", "Warm"),
        legendItem("#ffd25e", "Hot"),
        legendItem("#ff5d7a", "Very hot"),
      ].join("");
    } else if (state.goal === "air") {
      el.innerHTML = [
        legendItem("#45ff9a", "AQI Good"),
        legendItem("#ffd25e", "AQI Moderate"),
        legendItem("#ffb84a", "AQI Sensitive"),
        legendItem("#ff5d7a", "AQI Unhealthy+"),
      ].join("");
    } else if (state.goal === "transport") {
      el.innerHTML = UM_DEMO.busLines.map((b) => legendItem(b.color, `Bus ${b.name}`)).join("");
    } else {
      el.innerHTML = legendItem("#46d6ff", "Campus place");
    }
  }

  function legendItem(color, label) {
    return `<div class="legendItem"><span class="legendDot" style="background:${color}"></span><span>${escapeHtml(
      label
    )}</span></div>`;
  }

  // ---------- Simulation ----------
  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function jitterToward(cur, target, step = 0.5) {
    const delta = clamp(target - cur, -step, step);
    return cur + delta + rand(-0.12, 0.12);
  }

  function heatIndexC(tempC, humidityPct) {
    // NOAA approximation (C) using Rothfusz regression (converted from F).
    // Not perfect, but adequate for a demo dashboard.
    const T = tempC * (9 / 5) + 32;
    const R = humidityPct;
    const HI =
      -42.379 +
      2.04901523 * T +
      10.14333127 * R -
      0.22475541 * T * R -
      0.00683783 * T * T -
      0.05481717 * R * R +
      0.00122874 * T * T * R +
      0.00085282 * T * R * R -
      0.00000199 * T * T * R * R;
    return (HI - 32) * (5 / 9);
  }

  function aqiBand(aqi) {
    return UM_DEMO.aqiBands.find((b) => aqi <= b.max) || UM_DEMO.aqiBands[UM_DEMO.aqiBands.length - 1];
  }

  function initSimState() {
    UM_DEMO.campusPlaces.forEach((p) => {
      // seed temperature slightly different by zone
      const base =
        p.zone === "Green" ? rand(27.2, 29.3) : p.zone === "Gateway" ? rand(29.0, 31.4) : rand(28.2, 30.8);
      const hum = rand(62, 82);
      const hi = heatIndexC(base, hum);
      state.sensors.tempByPlace.set(p.id, {
        tempC: base,
        humidityPct: hum,
        heatIndexC: hi,
        iotCoolingOn: base >= UM_DEMO.tempPolicy.coolingOnAboveC,
        lastSeenMs: Date.now(),
      });

      const aqiBase = p.zone === "Gateway" ? rand(55, 110) : p.zone === "Green" ? rand(28, 65) : rand(35, 85);
      state.sensors.airByPlace.set(p.id, {
        aqi: aqiBase,
        pm25: clamp(rand(6, 45) + (aqiBase - 50) * 0.15, 3, 120),
        co2ppm: clamp(rand(420, 780) + (aqiBase - 50) * 2.6, 380, 1400),
        lastSeenMs: Date.now(),
      });
    });

    UM_DEMO.buildings.forEach((b) => {
      const baseline = rand(1800, 6200);
      const today = baseline * rand(0.85, 1.25);
      state.energyByBuilding.set(b.id, {
        kwNow: rand(120, 620),
        kwhToday: today,
        baselineKwhToday: baseline,
      });
      state.waterByBuilding.set(b.id, {
        lpmNow: rand(20, 220),
        m3Today: rand(18, 120),
        leakRisk: rand(0.05, 0.35),
      });
    });

    state.recycling = {
      diversionPct: rand(22, 48),
      contaminationPct: rand(7, 18),
      binsFull: Math.round(rand(1, 8)),
    };

    UM_DEMO.busLines.forEach((line) => {
      state.buses.set(line.id, {
        activeBuses: Math.max(1, Math.round(rand(1, 4))),
        headwayMin: Math.round(rand(8, 22)),
        ridershipNow: Math.round(rand(40, 210)),
        onTimePct: rand(71, 96),
      });
    });

    UM_DEMO.biodiversityZones.forEach((z) => {
      state.biodiversity.set(z.id, {
        canopyPct: z.canopyPct,
        nativeSpeciesIndex: z.nativeSpeciesIndex,
        pollinatorScore: z.pollinatorScore,
      });
    });
  }

  function tickSim() {
    if (!state.realtime) return;
    state.tick += 1;
    state.lastTickMs = Date.now();

    // Temperature sensors + IoT cooling controller (simple hysteresis)
    UM_DEMO.campusPlaces.forEach((p) => {
      const t = state.sensors.tempByPlace.get(p.id);
      if (!t) return;

      // zone & diurnal drift
      const diurnal = Math.sin((Date.now() / 60000) * 0.12) * 0.35;
      const zoneBias = p.zone === "Green" ? -0.35 : p.zone === "Gateway" ? 0.35 : 0.1;
      const ambientTarget = 29.4 + diurnal + zoneBias;

      // If cooling is on, target closer to comfort
      const coolingPull = t.iotCoolingOn ? -0.55 : 0;
      const next = jitterToward(t.tempC, ambientTarget + coolingPull, 0.35);

      // humidity jitter
      const hum = clamp(t.humidityPct + rand(-1.5, 1.5), 55, 88);
      const hi = heatIndexC(next, hum);

      // IoT controller hysteresis
      let cooling = t.iotCoolingOn;
      if (!cooling && next >= UM_DEMO.tempPolicy.coolingOnAboveC) cooling = true;
      if (cooling && next <= UM_DEMO.tempPolicy.coolingOffBelowC) cooling = false;

      state.sensors.tempByPlace.set(p.id, {
        tempC: next,
        humidityPct: hum,
        heatIndexC: hi,
        iotCoolingOn: cooling,
        lastSeenMs: Date.now(),
      });
    });

    // Air quality sensors
    UM_DEMO.campusPlaces.forEach((p) => {
      const a = state.sensors.airByPlace.get(p.id);
      if (!a) return;
      const traffic = p.zone === "Gateway" ? 12 : p.zone === "Green" ? -10 : 2;
      const wind = Math.sin((Date.now() / 60000) * 0.08) * 6;
      const drift = rand(-4, 5) + traffic + wind * 0.25;
      const nextAqi = clamp(a.aqi + drift * 0.25, 18, 190);
      const pm25 = clamp(jitterToward(a.pm25, 10 + nextAqi * 0.22, 2.2), 2, 160);
      const co2 = clamp(jitterToward(a.co2ppm, 420 + nextAqi * 3.1, 18), 380, 1800);
      state.sensors.airByPlace.set(p.id, { aqi: nextAqi, pm25, co2ppm: co2, lastSeenMs: Date.now() });
    });

    // Energy (dummy realtime power) and daily accumulation
    UM_DEMO.buildings.forEach((b) => {
      const e = state.energyByBuilding.get(b.id);
      if (!e) return;
      const peak = b.type === "Academic" ? 1.2 : b.type === "Residential" ? 1.05 : 1.1;
      const dayWave = 0.6 + (Math.sin((Date.now() / 60000) * 0.10) + 1) * 0.35;
      const targetKw = clamp((e.baselineKwhToday / 24) * peak * dayWave * rand(0.7, 1.15), 60, 980);
      const kw = clamp(jitterToward(e.kwNow, targetKw, 18), 40, 1200);
      const kwhToday = e.kwhToday + kw / 3600; // per-second tick approx
      state.energyByBuilding.set(b.id, { ...e, kwNow: kw, kwhToday });
    });

    // Water (dummy)
    UM_DEMO.buildings.forEach((b) => {
      const w = state.waterByBuilding.get(b.id);
      if (!w) return;
      const dayWave = 0.55 + (Math.sin((Date.now() / 60000) * 0.09) + 1) * 0.38;
      const target = clamp(w.lpmNow * (0.85 + dayWave * 0.3) + rand(-10, 10), 10, 320);
      const lpm = clamp(jitterToward(w.lpmNow, target, 10), 8, 420);
      const leakRisk = clamp(w.leakRisk + rand(-0.01, 0.015), 0.02, 0.65);
      const m3Today = w.m3Today + lpm / 60000;
      state.waterByBuilding.set(b.id, { lpmNow: lpm, leakRisk, m3Today });
    });

    // Recycling (dummy)
    state.recycling = {
      diversionPct: clamp(state.recycling.diversionPct + rand(-0.4, 0.6), 15, 70),
      contaminationPct: clamp(state.recycling.contaminationPct + rand(-0.3, 0.3), 3, 28),
      binsFull: clamp(state.recycling.binsFull + Math.round(rand(-1, 1)), 0, 12),
    };

    // Transport (dummy bus KPIs + history)
    UM_DEMO.busLines.forEach((line) => {
      const b = state.buses.get(line.id);
      if (!b) return;
      const headway = clamp(Math.round(jitterToward(b.headwayMin, rand(7, 24), 2)), 5, 30);
      const active = clamp(Math.round(jitterToward(b.activeBuses, rand(1, 5), 1)), 1, 6);
      const ridership = clamp(Math.round(jitterToward(b.ridershipNow, rand(25, 260), 30)), 10, 380);
      const onTime = clamp(jitterToward(b.onTimePct, rand(70, 98), 2.2), 55, 99);
      const metrics = { activeBuses: active, headwayMin: headway, ridershipNow: ridership, onTimePct: onTime };
      state.buses.set(line.id, metrics);

      const arr = state.busHistory.get(line.id) || [];
      arr.unshift({ ts: Date.now(), ...metrics });
      state.busHistory.set(line.id, arr.slice(0, 240));
    });

    // Biodiversity (slow drift)
    UM_DEMO.biodiversityZones.forEach((z) => {
      const bio = state.biodiversity.get(z.id);
      if (!bio) return;
      state.biodiversity.set(z.id, {
        canopyPct: clamp(bio.canopyPct + rand(-0.03, 0.05), 5, 80),
        nativeSpeciesIndex: clamp(bio.nativeSpeciesIndex + rand(-0.005, 0.007), 0.1, 0.95),
        pollinatorScore: clamp(bio.pollinatorScore + rand(-0.006, 0.008), 0.1, 0.95),
      });
    });

    if (state.tick % 600 === 0) {
      recordGoalSnapshot();
    }
  }

  function recordGoalSnapshot() {
    const now = Date.now();

    // Temperature
    const tempPlaces = Array.from(state.sensors.tempByPlace.values());
    if (tempPlaces.length) {
      const avgTemp = tempPlaces.reduce((s, t) => s + t.tempC, 0) / tempPlaces.length;
      const hot = tempPlaces.filter((t) => t.tempC >= 31.5).length;
      const cooling = tempPlaces.filter((t) => t.iotCoolingOn).length;
      appendGoalHistory("temp", {
        ts: now,
        avgTemp,
        hotspots: hot,
        coolingOn: cooling,
        totalSensors: tempPlaces.length,
      });
    }

    // Energy
    const energyRows = Array.from(state.energyByBuilding.values());
    if (energyRows.length) {
      const totalKw = energyRows.reduce((s, e) => s + e.kwNow, 0);
      const totalKwh = energyRows.reduce((s, e) => s + e.kwhToday, 0);
      appendGoalHistory("energy", {
        ts: now,
        totalKw,
        totalKwh,
      });
    }

    // Green
    const zones = Array.from(state.biodiversity.values());
    if (zones.length) {
      const avgCanopy = zones.reduce((s, z) => s + z.canopyPct, 0) / zones.length;
      const avgNative = zones.reduce((s, z) => s + z.nativeSpeciesIndex, 0) / zones.length;
      const avgPoll = zones.reduce((s, z) => s + z.pollinatorScore, 0) / zones.length;
      appendGoalHistory("green", {
        ts: now,
        avgCanopy,
        avgNative,
        avgPoll,
      });
    }

    // Transport
    const busLinesData = Array.from(state.buses.values());
    if (busLinesData.length) {
      const ridership = busLinesData.reduce((s, b) => s + b.ridershipNow, 0);
      const onTime =
        busLinesData.reduce((s, b) => s + b.onTimePct, 0) / Math.max(1, busLinesData.length);
      const headway =
        busLinesData.reduce((s, b) => s + b.headwayMin, 0) / Math.max(1, busLinesData.length);
      appendGoalHistory("transport", {
        ts: now,
        ridership,
        avgOnTime: onTime,
        avgHeadway: headway,
      });
    }

    // Water
    const waterRows = Array.from(state.waterByBuilding.values());
    if (waterRows.length) {
      const totalLpm = waterRows.reduce((s, w) => s + w.lpmNow, 0);
      const totalM3 = waterRows.reduce((s, w) => s + w.m3Today, 0);
      appendGoalHistory("water", {
        ts: now,
        totalLpm,
        totalM3,
        diversionPct: state.recycling.diversionPct,
        binsFull: state.recycling.binsFull,
      });
    }

    // Air
    const airPlaces = Array.from(state.sensors.airByPlace.values());
    if (airPlaces.length) {
      const avgAqi = airPlaces.reduce((s, a) => s + a.aqi, 0) / airPlaces.length;
      const worstAqi = airPlaces.reduce((m, a) => (a.aqi > m ? a.aqi : m), 0);
      const alerts = airPlaces.filter((a) => a.aqi >= 120).length;
      appendGoalHistory("air", {
        ts: now,
        avgAqi,
        worstAqi,
        alerts,
      });
    }

    saveGoalHistory();
  }

  function appendGoalHistory(goalId, entry) {
    const list = state.goalHistory.get(goalId) || [];
    list.push(entry);
    if (list.length > 5000) list.shift();
    state.goalHistory.set(goalId, list);
  }

  // ---------- Rendering ----------
  function setUpdatedPill() {
    $("#pillUpdated").textContent = `Updated: ${new Date(state.lastTickMs).toLocaleTimeString()}`;
    $("#pillRealtime").textContent = `Realtime: ${state.realtime ? "ON" : "PAUSED"}`;
    $("#pillRealtime").style.borderColor = state.realtime ? "rgba(69,255,154,.35)" : "rgba(255,210,94,.35)";
    $("#pillRealtime").style.background = state.realtime ? "rgba(69,255,154,.10)" : "rgba(255,210,94,.08)";
  }

  function renderGP() {
    $("#gpTotal").textContent = String(state.gp);
  }

  function renderRecentActivity() {
    const list = $("#recentActivityList");
    if (!list) return;

    if (state.history.length === 0) {
      list.innerHTML = '<div class="recentActivity__empty">No activity yet. Claim your first reward above!</div>';
      return;
    }

    list.innerHTML = state.history.slice(0, 10).map(item => {
      const date = new Date(item.ts);
      const timeStr = date.toLocaleString('en-US', { 
        month: 'numeric', 
        day: 'numeric', 
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true 
      });
      
      return `
        <div class="activityItem">
          <div class="activityItem__left">
            <div class="activityItem__title">${item.title}</div>
            <div class="activityItem__time">${timeStr}</div>
          </div>
          <div class="activityItem__points">+${item.delta} GP</div>
        </div>
      `;
    }).join('');
  }

  function updateStudentProfile() {
    if (state.currentStudent) {
      $("#studentName").textContent = state.currentStudent.name;
      $("#studentMatric").textContent = state.currentStudent.matricNumber;
      const initials = state.currentStudent.name.split(" ").map(n => n[0]).join("").substr(0, 2).toUpperCase();
      $("#studentAvatar").textContent = initials;
      showStudentUI();
      renderGP();
    } else {
      hideStudentUI();
    }
  }

  function renderRewardCards() {
    const grid = $("#rewardGrid");
    if (!grid) return;

    grid.innerHTML = UM_DEMO.REWARD_TYPES.map(reward => {
      const validation = canSubmitClaim(reward.id);
      const todayCount = getTodayClaimsForReward(reward.id).length;
      const limitText = reward.dailyLimit 
        ? `${todayCount}/${reward.dailyLimit} today` 
        : "No daily limit";
      
      const verificationIcon = {
        photo: "📸 Photo",
        qr: "📱 QR Code",
        location: "📍 Location",
        attendance: "✅ Event Code"
      }[reward.verificationType] || "📋 Verification";

      return `
        <div class="rewardCard">
          <div class="rewardCard__title">${escapeHtml(reward.title)}</div>
          <div class="rewardCard__desc">${escapeHtml(reward.description)}</div>
          <div class="verificationIcon" style="margin-top: 6px;">${verificationIcon}</div>
          <div class="rewardCard__row">
            <div>
              <span class="pill">+${reward.points} GP</span>
              <div style="font-size: 10px; color: var(--muted2); margin-top: 4px;">${limitText}</div>
            </div>
            <button 
              class="btn" 
              data-reward="${reward.id}" 
              type="button"
              ${!validation.canSubmit ? 'disabled' : ''}
            >
              ${!validation.canSubmit ? 'Limit Reached' : 'Submit Claim'}
            </button>
          </div>
        </div>
      `;
    }).join("");
  }

  function renderClaimsHistory() {
    const list = $("#claimsHistory");
    if (!list) return;

    const claims = getClaimsByStatus(state.currentClaimTab);
    
    if (claims.length === 0) {
      list.innerHTML = `<div style="color: var(--muted2); font-size: 12px; text-align: center; padding: 20px;">
        No ${state.currentClaimTab} claims yet.
      </div>`;
      return;
    }

    list.innerHTML = claims.map(claim => {
      const statusBadge = `
        <span class="statusBadge statusBadge--${claim.status}">
          <span class="statusBadge__dot"></span>
          ${claim.status.charAt(0).toUpperCase() + claim.status.slice(1)}
        </span>
      `;

      let evidenceHTML = "";
      if (claim.evidence?.type === "photo" && claim.evidence?.data) {
        evidenceHTML = `
          <div class="claimCard__evidence">
            <img src="${claim.evidence.data}" alt="Evidence photo" />
          </div>
        `;
      } else if (claim.evidence?.type === "qr") {
        evidenceHTML = `<div class="claimCard__location">📱 QR: ${escapeHtml(claim.evidence.placeName || "Scanned")}</div>`;
      }

      let notesHTML = "";
      if (claim.reviewNotes && claim.status !== UM_DEMO.CLAIM_STATUS.PENDING) {
        notesHTML = `
          <div class="claimCard__notes">
            <strong>Review notes:</strong> ${escapeHtml(claim.reviewNotes)}
          </div>
        `;
      }

      return `
        <div class="claimCard">
          <div class="claimCard__header">
            <div>
              <div class="claimCard__title">${escapeHtml(claim.rewardTitle)}</div>
              <div class="claimCard__meta">
                ${new Date(claim.submittedAt).toLocaleString()} • ${claim.rewardPoints} GP
              </div>
            </div>
            ${statusBadge}
          </div>
          <div class="claimCard__body">${escapeHtml(claim.description)}</div>
          ${evidenceHTML}
          ${claim.location?.name ? `<div class="claimCard__location">📍 ${escapeHtml(claim.location.name)}</div>` : ""}
          ${notesHTML}
        </div>
      `;
    }).join("");
  }

  function renderAdminPanel() {
    const pendingClaims = state.claims.filter(c => c.status === UM_DEMO.CLAIM_STATUS.PENDING);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const approvedToday = state.claims.filter(c => 
      c.status === UM_DEMO.CLAIM_STATUS.APPROVED && 
      c.reviewedAt >= today.getTime()
    ).length;
    const rejectedToday = state.claims.filter(c => 
      c.status === UM_DEMO.CLAIM_STATUS.REJECTED && 
      c.reviewedAt >= today.getTime()
    ).length;

    $("#adminPendingCount").textContent = String(pendingClaims.length);
    $("#adminApprovedCount").textContent = String(approvedToday);
    $("#adminRejectedCount").textContent = String(rejectedToday);

    const list = $("#adminClaimsList");
    if (!list) return;

    list.innerHTML = pendingClaims.map(claim => {
      let evidenceHTML = "";
      if (claim.evidence?.type === "photo" && claim.evidence?.data) {
        evidenceHTML = `
          <div class="claimCard__evidence">
            <img src="${claim.evidence.data}" alt="Evidence photo" />
          </div>
        `;
      } else if (claim.evidence?.type === "qr") {
        evidenceHTML = `<div class="claimCard__location">📱 QR: ${escapeHtml(claim.evidence.placeName || "Scanned")}</div>`;
      }

      return `
        <div class="claimCard">
          <div class="claimCard__header">
            <div>
              <div class="claimCard__title">${escapeHtml(claim.rewardTitle)} • ${claim.rewardPoints} GP</div>
              <div class="claimCard__meta">
                ${escapeHtml(claim.studentName)} (${escapeHtml(claim.studentMatric)}) • ${new Date(claim.submittedAt).toLocaleString()}
              </div>
            </div>
            <span class="statusBadge statusBadge--pending">
              <span class="statusBadge__dot"></span>
              Pending
            </span>
          </div>
          <div class="claimCard__body">${escapeHtml(claim.description)}</div>
          ${evidenceHTML}
          ${claim.location?.name ? `<div class="claimCard__location">📍 ${escapeHtml(claim.location.name)}</div>` : ""}
          <div class="claimCard__footer">
            <div class="claimCard__actions">
              <button class="claimCard__btn claimCard__btn--approve" data-claim-id="${claim.claimId}" data-action="approve">
                Approve
              </button>
              <button class="claimCard__btn claimCard__btn--reject" data-claim-id="${claim.claimId}" data-action="reject">
                Reject
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");
  }

  function setGoalHeader(title, subtitle, tableTitle) {
    $("#goalTitle").textContent = title;
    $("#goalSubtitle").textContent = subtitle;
    $("#tableTitle").textContent = tableTitle;
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

  function tag(label, kind) {
    const cls =
      kind === "good" ? "tag tag--good" : kind === "warn" ? "tag tag--warn" : kind === "bad" ? "tag tag--bad" : "tag tag--info";
    return `<span class="${cls}">${escapeHtml(label)}</span>`;
  }

  function hexToRgba(hex, alpha) {
    const h = String(hex).trim().replace("#", "");
    if (h.length !== 6) return `rgba(70,214,255,${alpha})`;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function renderTemp() {
    setGoalHeader(
      "Campus Temperature (Urban Heat Monitoring)",
      "Live sensors by location, with IoT controller status to maintain target comfort.",
      "Sensor Readings"
    );

    const places = filteredCampusPlaces().map((p) => ({
      p,
      t: state.sensors.tempByPlace.get(p.id),
    })).filter((x) => x.t);
    const avg = places.reduce((s, x) => s + x.t.tempC, 0) / Math.max(1, places.length);
    const hotSpots = places.filter((x) => x.t.tempC >= 31.5).length;
    const coolingOn = places.filter((x) => x.t.iotCoolingOn).length;

    $("#cards").innerHTML = [
      card("Average Temp", `${fmt.n(avg, 1)} °C`, "Across instrumented places"),
      card("Hotspots", `${hotSpots}`, "Places ≥ 31.5 °C"),
      card("IoT Cooling", `${coolingOn}/${places.length} ON`, `Policy: ON ≥ ${UM_DEMO.tempPolicy.coolingOnAboveC} °C`),
    ].join("");

    renderTable(
      ["Place", "Zone", "Temp (°C)", "Heat Index (°C)", "Humidity", "IoT", "Status"],
      places
        .sort((a, b) => b.t.tempC - a.t.tempC)
        .map(({ p, t }) => {
          const status =
            t.tempC >= 33
              ? tag("Critical heat", "bad")
              : t.tempC >= 31
              ? tag("Hot", "warn")
              : t.tempC >= 29
              ? tag("Warm", "info")
              : tag("Comfort", "good");
          const iot = t.iotCoolingOn ? tag("ON", "info") : tag("OFF", "good");
          return [
            escapeHtml(p.name),
            escapeHtml(p.zone),
            `<span class="mono">${fmt.n(t.tempC, 1)}</span>`,
            `<span class="mono">${fmt.n(t.heatIndexC, 1)}</span>`,
            `${fmt.n(t.humidityPct, 0)}%`,
            iot,
            status,
          ];
        })
    );
  }

  function renderEnergy() {
    setGoalHeader(
      "Energy Usage in Buildings (Dummy Data)",
      "Track electricity demand by building. Replace with UM meter/BMS feeds for production.",
      "Building Energy Overview"
    );

    const rows = filteredBuildings().map((b) => {
      const e = state.energyByBuilding.get(b.id);
      const delta = ((e.kwhToday - e.baselineKwhToday) / e.baselineKwhToday) * 100;
      return { b, e, delta };
    });

    const totalKw = rows.reduce((s, r) => s + r.e.kwNow, 0);
    const totalKwh = rows.reduce((s, r) => s + r.e.kwhToday, 0);
    const avgDelta = rows.reduce((s, r) => s + r.delta, 0) / Math.max(1, rows.length);

    $("#cards").innerHTML = [
      card("Campus Demand", `${fmt.n(totalKw, 0)} kW`, "Simulated real-time power"),
      card("Energy Today", `${fmt.n(totalKwh, 0)} kWh`, "Accumulated since midnight (demo)"),
      card("Vs Baseline", `${fmt.n(avgDelta, 1)}%`, "Average deviation from baseline"),
    ].join("");

    renderTable(
      ["Building", "Type", "kW now", "kWh today", "Baseline", "Delta", "Signal"],
      rows
        .sort((a, b) => b.e.kwNow - a.e.kwNow)
        .map(({ b, e, delta }) => {
          const kind = delta > 12 ? "bad" : delta > 5 ? "warn" : delta < -5 ? "good" : "info";
          const signal = delta > 12 ? "Investigate" : delta > 5 ? "Watch" : delta < -5 ? "Efficient" : "Normal";
          return [
            escapeHtml(b.name),
            escapeHtml(b.type),
            `<span class="mono">${fmt.n(e.kwNow, 0)}</span>`,
            `<span class="mono">${fmt.n(e.kwhToday, 0)}</span>`,
            `<span class="mono">${fmt.n(e.baselineKwhToday, 0)}</span>`,
            `<span class="mono">${delta >= 0 ? "+" : ""}${fmt.n(delta, 1)}%</span>`,
            tag(signal, kind),
          ];
        })
    );
  }

  function renderGreen() {
    setGoalHeader(
      "Green Space & Biodiversity Tracking",
      "Monitor canopy coverage and biodiversity indicators across campus zones (demo metrics).",
      "Zone Biodiversity Indicators"
    );

    const zones = UM_DEMO.biodiversityZones.map((z) => ({ z, bio: state.biodiversity.get(z.id) })).filter((x) => x.bio);
    const avgCanopy = zones.reduce((s, x) => s + x.bio.canopyPct, 0) / Math.max(1, zones.length);
    const avgNative = zones.reduce((s, x) => s + x.bio.nativeSpeciesIndex, 0) / Math.max(1, zones.length);
    const avgPoll = zones.reduce((s, x) => s + x.bio.pollinatorScore, 0) / Math.max(1, zones.length);

    $("#cards").innerHTML = [
      card("Avg Canopy", `${fmt.n(avgCanopy, 0)}%`, "Higher canopy reduces urban heat"),
      card("Native Species Index", `${fmt.n(avgNative, 2)}`, "0–1, higher is better"),
      card("Pollinator Score", `${fmt.n(avgPoll, 2)}`, "0–1, proxy for ecosystem health"),
    ].join("");

    renderTable(
      ["Zone", "Canopy", "Native species", "Pollinators", "Priority"],
      zones
        .sort((a, b) => a.bio.canopyPct - b.bio.canopyPct)
        .map(({ z, bio }) => {
          const priorityScore = (1 - bio.nativeSpeciesIndex) * 0.45 + (1 - bio.pollinatorScore) * 0.35 + (40 - bio.canopyPct) * 0.005;
          const kind = priorityScore >= 0.55 ? "bad" : priorityScore >= 0.38 ? "warn" : "good";
          const label = kind === "bad" ? "High" : kind === "warn" ? "Medium" : "Low";
          return [
            escapeHtml(z.name),
            `${fmt.n(bio.canopyPct, 0)}%`,
            `<span class="mono">${fmt.n(bio.nativeSpeciesIndex, 2)}</span>`,
            `<span class="mono">${fmt.n(bio.pollinatorScore, 2)}</span>`,
            tag(`${label} restoration`, kind),
          ];
        })
    );
  }

  function renderTransport() {
    setGoalHeader(
      "Transportation Efficiency (UM Bus Monitoring)",
      "Track UM bus lines AB, BA, C, D, E and 13 with operational KPIs (demo).",
      "Bus Line Dashboard"
    );

    const lines = UM_DEMO.busLines.map((l) => ({ l, k: state.buses.get(l.id) })).filter((x) => x.k);
    const ridership = lines.reduce((s, x) => s + x.k.ridershipNow, 0);
    const onTime = lines.reduce((s, x) => s + x.k.onTimePct, 0) / Math.max(1, lines.length);
    const avgHeadway = lines.reduce((s, x) => s + x.k.headwayMin, 0) / Math.max(1, lines.length);

    const service = currentBusServiceStatus();

    $("#cards").innerHTML = [
      card("Ridership now", `${fmt.n(ridership, 0)}`, "Estimated passengers across all lines"),
      card("Avg headway", `${fmt.n(avgHeadway, 0)} min`, "Lower means better frequency"),
      card("On-time", `${fmt.n(onTime, 0)}%`, "Percent of trips within schedule window"),
    ].join("");

    renderTable(
      ["Line", "Active buses", "Headway", "Ridership", "On-time", "Status"],
      lines
        .sort((a, b) => a.k.headwayMin - b.k.headwayMin)
        .map(({ l, k }) => {
          const statusKind = k.onTimePct < 75 || k.headwayMin > 22 ? "warn" : k.onTimePct < 68 ? "bad" : "good";
          const status =
            statusKind === "bad" ? "Service issue" : statusKind === "warn" ? "Needs tuning" : "Healthy";
          return [
            `<span class="tag tag--info" style="border-color:${l.color}; background:${hexToRgba(l.color, 0.16)};">${escapeHtml(l.name)}</span>`,
            `<span class="mono">${fmt.n(k.activeBuses, 0)}</span>`,
            `<span class="mono">${fmt.n(k.headwayMin, 0)} min</span>`,
            `<span class="mono">${fmt.n(k.ridershipNow, 0)}</span>`,
            `<span class="mono">${fmt.n(k.onTimePct, 0)}%</span>`,
            tag(status, statusKind),
          ];
        })
    );
  }

  function currentBusServiceStatus() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun
    const minutes = now.getHours() * 60 + now.getMinutes();

    const withinOperatingWindow = minutes >= 7 * 60 + 30 && minutes <= 22 * 60;
    const isWeekend = day === 0 || day === 6;
    const isFriday = day === 5;
    const isFridayPrayer =
      isFriday && minutes >= 13 * 60 + 30 && minutes < 14 * 60 + 30; // 13:30–14:30

    if (isWeekend) {
      return {
        active: false,
        label: "Bus lines do not operate on weekends, public holidays, semester breaks or study week.",
      };
    }
    if (!withinOperatingWindow) {
      return {
        active: false,
        label: "Service hours are 7:30 AM – 10:00 PM (Mon–Fri).",
      };
    }
    if (isFridayPrayer) {
      return {
        active: false,
        label: "Service temporarily paused for Friday prayer (13:30–14:30).",
      };
    }
    return {
      active: true,
      label: "Service operating now (rules: Mon–Fri 7:30–22:00, closed on public holidays, mid-sem break and study week).",
    };
  }

  function renderWater() {
    setGoalHeader(
      "Water Management & Recycling (Dummy Data)",
      "Monitor water usage and recycling diversion. Replace with UM meters / waste contractor reports for production.",
      "Water & Recycling Overview"
    );

    const rows = filteredBuildings()
      .map((b) => ({ b, w: state.waterByBuilding.get(b.id) }))
      .filter((x) => x.w);
    const totalLpm = rows.reduce((s, x) => s + x.w.lpmNow, 0);
    const m3 = rows.reduce((s, x) => s + x.w.m3Today, 0);
    const highLeak = rows.filter((x) => x.w.leakRisk >= 0.42).length;

    $("#cards").innerHTML = [
      card("Water flow", `${fmt.n(totalLpm, 0)} L/min`, "Simulated real-time flow"),
      card("Water today", `${fmt.n(m3, 1)} m³`, "Accumulated (demo)"),
      card("Recycling diversion", `${fmt.n(state.recycling.diversionPct, 0)}%`, `Bins full: ${state.recycling.binsFull}`),
    ].join("");

    renderTable(
      ["Building", "L/min now", "m³ today", "Leak risk", "Action", "Recycling"],
      rows
        .sort((a, b) => b.w.leakRisk - a.w.leakRisk)
        .map(({ b, w }) => {
          const kind = w.leakRisk >= 0.52 ? "bad" : w.leakRisk >= 0.38 ? "warn" : "good";
          const action = kind === "bad" ? "Inspect immediately" : kind === "warn" ? "Schedule check" : "Normal";
          const recyclingSignal =
            state.recycling.contaminationPct > 18 ? tag("High contamination", "warn") : tag("Stable", "good");
          return [
            escapeHtml(b.name),
            `<span class="mono">${fmt.n(w.lpmNow, 0)}</span>`,
            `<span class="mono">${fmt.n(w.m3Today, 1)}</span>`,
            `<span class="mono">${fmt.n(w.leakRisk * 100, 0)}%</span>`,
            tag(action, kind),
            recyclingSignal,
          ];
        })
    );

    // small incentive: claiming recycling reward fits this goal
  }

  function renderAir() {
    setGoalHeader(
      "Air Quality Tracking (Sensor Demo)",
      "Monitor AQI, PM2.5 and CO₂ across campus. Flag hotspots and support mitigation planning.",
      "Air Quality Sensors"
    );

    const rows = filteredCampusPlaces()
      .map((p) => ({ p, a: state.sensors.airByPlace.get(p.id) }))
      .filter((x) => x.a);
    const avgAqi = rows.reduce((s, x) => s + x.a.aqi, 0) / Math.max(1, rows.length);
    const worst = rows.reduce((m, x) => (x.a.aqi > m ? x.a.aqi : m), 0);
    const alerts = rows.filter((x) => x.a.aqi >= 120).length;

    $("#cards").innerHTML = [
      card("Average AQI", `${fmt.n(avgAqi, 0)}`, `Worst observed: ${fmt.n(worst, 0)}`),
      card("Alerts", `${alerts}`, "Places with AQI ≥ 120"),
      card("Policy", `<span class="mono">Notify ≥ 120</span>`, "Demo rule for sensitive groups"),
    ].join("");

    renderTable(
      ["Place", "Zone", "AQI", "PM2.5", "CO₂", "Band", "Action"],
      rows
        .sort((a, b) => b.a.aqi - a.a.aqi)
        .map(({ p, a }) => {
          const band = aqiBand(a.aqi);
          const kind = band.tag === "good" ? "good" : band.tag === "warn" ? "warn" : "bad";
          const action = a.aqi >= 150 ? "Reduce exposure" : a.aqi >= 120 ? "Advisory" : "Normal";
          return [
            escapeHtml(p.name),
            escapeHtml(p.zone),
            `<span class="mono">${fmt.n(a.aqi, 0)}</span>`,
            `<span class="mono">${fmt.n(a.pm25, 1)}</span>`,
            `<span class="mono">${fmt.n(a.co2ppm, 0)}</span>`,
            tag(band.label, kind),
            tag(action, a.aqi >= 150 ? "bad" : a.aqi >= 120 ? "warn" : "good"),
          ];
        })
    );
  }

  function renderTable(headers, rows) {
    const head = $("#tableHead");
    const body = $("#tableBody");
    head.innerHTML = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")}</tr>`;
    body.innerHTML = rows
      .map((r) => `<tr>${r.map((c) => `<td>${typeof c === "string" ? c : escapeHtml(String(c))}</td>`).join("")}</tr>`)
      .join("");
  }

  function renderGoal() {
    renderLegend();
    updateFilterBarForGoal();
    const statsEl = $("#transportStats");
    if (state.goal === "temp") {
      clearBusRoutes();
      if (statsEl) statsEl.innerHTML = "";
      renderTemp();
    } else if (state.goal === "energy") {
      clearBusRoutes();
      if (statsEl) statsEl.innerHTML = "";
      renderEnergy();
    } else if (state.goal === "green") {
      clearBusRoutes();
      if (statsEl) statsEl.innerHTML = "";
      renderGreen();
    } else if (state.goal === "transport") {
      drawBusRoutes();
      renderTransport();
    } else if (state.goal === "water") {
      clearBusRoutes();
      if (statsEl) statsEl.innerHTML = "";
      renderWater();
    } else if (state.goal === "air") {
      clearBusRoutes();
      if (statsEl) statsEl.innerHTML = "";
      renderAir();
    }
    updateMarkerPopups();
  }

  function filteredCampusPlaces() {
    const { category, placeId } = state.filters;
    const catConfig =
      PLACE_CATEGORY_CONFIG.find((c) => c.id === category) ||
      PLACE_CATEGORY_CONFIG[0];
    let list = UM_DEMO.campusPlaces.filter(catConfig.matcher);
    if (placeId && placeId !== "all" && campusById.has(placeId)) {
      list = list.filter((p) => p.id === placeId);
    }
    return list;
  }

  function filteredBuildings() {
    const { category, placeId } = state.filters;
    if (placeId && placeId !== "all") {
      const match = UM_DEMO.buildings.find((b) => b.id === placeId);
      if (match) return [match];
    }
    if (category === "all") return UM_DEMO.buildings;
    return UM_DEMO.buildings.filter((b) => {
      if (category === "residential") return b.type === "Residential";
      if (category === "faculties") return b.type === "Academic";
      if (category === "facilities")
        return b.type === "Sports" || b.type === "Student";
      if (category === "admin") return /Admin/i.test(b.type || "");
      if (category === "external") return false;
      return true;
    });
  }

  // ---------- Events ----------
  function setGoal(goal) {
    state.goal = goal;
    $$(".goalBtn").forEach((b) => b.classList.toggle("is-active", b.dataset.goal === goal));
    renderGoal();
  }

  function openSubmissionDialog(rewardId) {
    const reward = UM_DEMO.REWARD_TYPES.find(r => r.id === rewardId);
    if (!reward) return;

    state.currentSubmission = { rewardId, evidence: null, location: null };
    
    $("#submissionTitle").textContent = `Submit: ${reward.title}`;
    $("#submissionSubtitle").textContent = reward.description;
    $("#submissionDescription").value = "";

    const fieldsContainer = $("#submissionFields");
    fieldsContainer.innerHTML = "";

    if (reward.verificationType === "photo") {
      fieldsContainer.innerHTML = `
        <div class="submissionForm__group">
          <label class="submissionForm__label">Upload Photo Evidence</label>
          <input type="file" id="photoInput" class="submissionForm__fileInput" accept="image/*" />
          <label for="photoInput" class="submissionForm__fileBtn" id="photoBtn">
            <div class="submissionForm__fileIcon">📸</div>
            <div class="submissionForm__fileText">Click to upload photo (max 500KB)</div>
          </label>
          <div id="photoPreview" class="submissionForm__preview" style="display: none;"></div>
          <div class="submissionForm__hint">Upload a clear photo showing your recycling activity</div>
        </div>
      `;

      $("#photoInput").addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        try {
          const dataUrl = await handlePhotoUpload(file);
          state.currentSubmission.evidence = { type: "photo", data: dataUrl };
          $("#photoBtn").classList.add("submissionForm__fileBtn--hasFile");
          $("#photoBtn").querySelector(".submissionForm__fileText").textContent = "Photo uploaded ✓";
          const preview = $("#photoPreview");
          preview.innerHTML = `<img src="${dataUrl}" alt="Preview" />`;
          preview.style.display = "block";
        } catch (err) {
          alert(err.message);
        }
      });
    } else if (reward.verificationType === "qr") {
      fieldsContainer.innerHTML = `
        <div class="submissionForm__group">
          <label class="submissionForm__label">Scan QR Code</label>
          <button type="button" class="submissionForm__qrBtn" id="qrScanBtn">
            📱 Simulate QR Scan
          </button>
          <div id="qrResult" style="display: none;"></div>
          <div class="submissionForm__hint">Scan QR code at bus stop, bike station, or designated location</div>
        </div>
      `;

      $("#qrScanBtn").addEventListener("click", () => {
        const qrData = generateMockQRScan();
        state.currentSubmission.evidence = { type: "qr", ...qrData };
        state.currentSubmission.location = { placeId: qrData.placeId, name: qrData.placeName };
        $("#qrResult").innerHTML = `
          <div class="submissionForm__qrSuccess">
            ✓ Scanned: ${escapeHtml(qrData.placeName)}<br/>
            <small>Code: ${escapeHtml(qrData.code)}</small>
          </div>
        `;
        $("#qrResult").style.display = "block";
        $("#qrScanBtn").disabled = true;
        $("#qrScanBtn").textContent = "✓ QR Code Scanned";
      });
    } else if (reward.verificationType === "location") {
      const locationOptions = UM_DEMO.campusPlaces.map(p => 
        `<option value="${p.id}">${escapeHtml(p.name)}</option>`
      ).join("");

      fieldsContainer.innerHTML = `
        <div class="submissionForm__group">
          <label class="submissionForm__label">Select Location</label>
          <select class="submissionForm__select" id="locationSelect" required>
            <option value="">Choose campus location...</option>
            ${locationOptions}
          </select>
          <div class="submissionForm__hint">Select where you observed the issue</div>
        </div>
      `;

      $("#locationSelect").addEventListener("change", (e) => {
        const placeId = e.target.value;
        const place = UM_DEMO.campusPlaces.find(p => p.id === placeId);
        if (place) {
          state.currentSubmission.location = { placeId: place.id, name: place.name };
          state.currentSubmission.evidence = { type: "location", placeId: place.id };
        }
      });
    } else if (reward.verificationType === "attendance") {
      const eventOptions = UM_DEMO.SUSTAINABILITY_EVENTS.map(e => 
        `<option value="${e.eventCode}">${escapeHtml(e.title)} (${escapeHtml(e.date)})</option>`
      ).join("");

      fieldsContainer.innerHTML = `
        <div class="submissionForm__group">
          <label class="submissionForm__label">Event Code</label>
          <select class="submissionForm__select" id="eventSelect" required>
            <option value="">Choose event...</option>
            ${eventOptions}
          </select>
          <div class="submissionForm__hint">Enter the event code provided at the sustainability program</div>
        </div>
      `;

      $("#eventSelect").addEventListener("change", (e) => {
        const eventCode = e.target.value;
        const event = UM_DEMO.SUSTAINABILITY_EVENTS.find(ev => ev.eventCode === eventCode);
        if (event) {
          state.currentSubmission.evidence = { type: "attendance", eventCode, eventTitle: event.title };
          state.currentSubmission.location = { name: event.location };
        }
      });
    }

    $("#submissionDialog").showModal();
  }

  function wireUI() {
    // Goal navigation
    $$(".goalBtn").forEach((btn) => btn.addEventListener("click", () => setGoal(btn.dataset.goal)));
    $("#btnCenterUM")?.addEventListener("click", () => map.setView(umCenter, 16, { animate: true }));
    $("#btnPause")?.addEventListener("click", () => {
      state.realtime = !state.realtime;
      $("#btnPause").textContent = state.realtime ? "Pause realtime" : "Resume realtime";
      setUpdatedPill();
    });

    // Rewards dialog
    const dlg = $("#rewardsDialog");
    const rewardsBtn = $("#btnOpenRewards");
    
    if (rewardsBtn) {
      rewardsBtn.addEventListener("click", () => {
        renderRecentActivity();
        dlg.showModal();
      });
    }

    // Reward buttons - open submission dialog
    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-reward]");
      if (btn) {
        const rewardId = btn.dataset.reward;
        openSubmissionDialog(rewardId);
      }
    });

    // Reset points button
    $("#btnResetPoints")?.addEventListener("click", () => {
      if (confirm("Are you sure you want to reset your Green Points to 0? This cannot be undone.")) {
        state.gp = 0;
        state.history = [];
        saveGP();
        saveHistory();
        renderGP();
        renderRecentActivity();
        alert("Green Points reset to 0.");
      }
    });

    // Submission form handler
    const submissionForm = $("#submissionForm");
    if (submissionForm) {
      submissionForm.addEventListener("submit", (e) => {
        e.preventDefault();

        if (!state.currentSubmission) return;

        const description = $("#submissionDescription").value.trim();
        
        if (description.length < 20) {
          alert("Please provide a description of at least 20 characters.");
          return;
        }

        if (!state.currentSubmission.evidence) {
          alert("Please provide proof (photo, QR scan, location, or event code).");
          return;
        }

        // Award points immediately
        const result = earnReward(state.currentSubmission.rewardId, description);
        
        if (result.success) {
          $("#submissionDialog").close();
          alert(`✓ Proof submitted! +${result.points} GP earned.`);
          state.currentSubmission = null;
        }
      });
    }

    // Cancel submission button
    $("#btnCancelSubmission")?.addEventListener("click", () => {
      $("#submissionDialog").close();
      state.currentSubmission = null;
    });

    // Area / building filters
    const catSelect = $("#filterCategory");
    const placeSelect = $("#filterPlace");
    if (catSelect && placeSelect) {
      catSelect.addEventListener("change", () => {
        state.filters.category = catSelect.value || "all";
        state.filters.placeId = "all";
        populatePlaceOptions();
        renderGoal();
      });
      placeSelect.addEventListener("change", () => {
        state.filters.placeId = placeSelect.value || "all";
        renderGoal();
      });
      populatePlaceOptions();
    }

    // Bus statistics: line selection + adjustment form (event delegation)
    document.addEventListener("click", (ev) => {
      const btn = ev.target.closest("[data-bus-line-btn]");
      if (!btn) return;
      const id = btn.dataset.line;
      if (!id) return;
      state.selectedBusLine = id;
      renderGoal();
    });

    document.addEventListener("submit", (ev) => {
      const form = ev.target.closest("#busAdjustmentForm");
      if (!form) return;
      ev.preventDefault();
      const goalId = form.dataset.goal || "transport";
      const textarea = form.querySelector("textarea[name='description']");
      const desc = textarea ? textarea.value : "";
      addAdjustment(goalId, desc);
      if (textarea) textarea.value = "";
      renderGoal();
    });
  }

  function populatePlaceOptions() {
    const placeSelect = $("#filterPlace");
    const catSelect = $("#filterCategory");
    if (!placeSelect || !catSelect) return;
    const category = catSelect.value || "all";

    const dir = UM_DEMO.buildingDirectory || [];
    let dirItems = dir;
    if (category === "residential")
      dirItems = dir.filter((d) => d.group === "Residential Colleges");
    else if (category === "faculties")
      dirItems = dir.filter((d) => d.group === "Faculties");
    else if (category === "admin")
      dirItems = dir.filter((d) => d.group === "Administration");
    else if (category === "facilities")
      dirItems = dir.filter((d) => d.group === "Facilities");

    const options = [
      `<option value="all">All in selected area</option>`,
      ...dirItems.map(
        (d) =>
          `<option value="${escapeHtml(d.id)}">${escapeHtml(d.name)}</option>`
      ),
    ];
    placeSelect.innerHTML = options.join("");
  }

  function updateFilterBarForGoal() {
    const filterBar = $("#filterBar");
    if (!filterBar) return;
    // Building-related goals: temp, energy, water, air
    const show =
      state.goal === "temp" ||
      state.goal === "energy" ||
      state.goal === "water" ||
      state.goal === "air";
    filterBar.style.display = show ? "flex" : "none";
  }

  // ---------- Helpers ----------
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // ---------- Boot ----------
  function initApp() {
    console.log("Initializing app...");
    try {
      // Initialize UI
      wireUI();
      console.log("UI wired successfully");

      // Initialize map and simulation
      ensureMarkers();
      initSimState();
      renderGoal();
      setUpdatedPill();
      renderGP();

      // Start simulation
      if (!window._simInterval) {
        window._simInterval = setInterval(() => {
          tickSim();
          setUpdatedPill();
          renderGoal();
        }, 1000);
      }
    } catch (err) {
      console.error("Error initializing app:", err);
      alert("Error loading application. Check console for details.");
    }
  }

  // Wait for DOM to be fully loaded
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initApp);
  } else {
    initApp();
  }
})();

