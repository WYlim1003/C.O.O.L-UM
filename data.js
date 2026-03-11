/* Demo datasets for UM Smart Sustainability Dashboard.
   Replace these with real UM feeds / APIs when available. */

(() => {
  const UM_CENTER = { lat: 3.1202, lng: 101.6536 }; // Universiti Malaya (approx)

  const campusPlaces = [
    { id: "um-main-gate", name: "UM Main Gate", lat: 3.1207, lng: 101.6557, zone: "Gateway" },
    { id: "perdana-library", name: "Perpustakaan Utama", lat: 3.1187, lng: 101.6545, zone: "Academic" },
    { id: "dewan-tunku", name: "Dewan Tunku Canselor", lat: 3.1170, lng: 101.6518, zone: "Admin" },
    { id: "um-central", name: "UM Central (Student Hub)", lat: 3.1202, lng: 101.6519, zone: "Student" },
    { id: "fsktm", name: "FCSIT (FSKTM)", lat: 3.1262, lng: 101.6569, zone: "Academic" },
    { id: "sport-centre", name: "Sports Centre", lat: 3.1155, lng: 101.6527, zone: "Sports" },
    { id: "kolej-kediaman", name: "Residential College Area", lat: 3.1119, lng: 101.6574, zone: "Residential" },
    { id: "lakeside", name: "Tasik Varsiti (Lakeside)", lat: 3.1221, lng: 101.6469, zone: "Green" },
  ];

  // Buildings for energy/water (dummy)
  const buildings = [
    { id: "b-dtc", name: "Dewan Tunku Canselor", type: "Event/Admin" },
    { id: "b-lib", name: "Perpustakaan Utama", type: "Academic" },
    { id: "b-fcsit", name: "FCSIT (FSKTM)", type: "Academic" },
    { id: "b-sport", name: "Sports Centre", type: "Sports" },
    { id: "b-umcentral", name: "UM Central", type: "Student" },
    { id: "b-res", name: "Residential Colleges", type: "Residential" },
  ];

  // Green space & biodiversity (demo indicators per zone)
  const biodiversityZones = [
    { id: "z-green-core", name: "Green Core (Lakeside)", canopyPct: 62, nativeSpeciesIndex: 0.78, pollinatorScore: 0.71 },
    { id: "z-residential", name: "Residential Belt", canopyPct: 41, nativeSpeciesIndex: 0.54, pollinatorScore: 0.50 },
    { id: "z-academic", name: "Academic Ridge", canopyPct: 33, nativeSpeciesIndex: 0.46, pollinatorScore: 0.44 },
    { id: "z-gateway", name: "Gateway / Road Edge", canopyPct: 18, nativeSpeciesIndex: 0.28, pollinatorScore: 0.25 },
  ];

  // UM buses (demo)
  const busLines = [
    { id: "AB", name: "AB", color: "#46d6ff" },
    { id: "BA", name: "BA", color: "#45ff9a" },
    { id: "C", name: "C", color: "#ffd25e" },
    { id: "D", name: "D", color: "#ff5d7a" },
    { id: "E", name: "E", color: "#b59cff" },
    { id: "13", name: "13", color: "#ff9b4a" },
  ];

  // Sustainability targets / rules (demo)
  const tempPolicy = {
    comfortTargetC: 27.0,
    coolingOnAboveC: 28.5,
    coolingOffBelowC: 27.5,
  };

  const aqiBands = [
    { max: 50, label: "Good", tag: "good" },
    { max: 100, label: "Moderate", tag: "warn" },
    { max: 150, label: "Unhealthy (Sensitive)", tag: "warn" },
    { max: 200, label: "Unhealthy", tag: "bad" },
    { max: 300, label: "Very Unhealthy", tag: "bad" },
    { max: 999, label: "Hazardous", tag: "bad" },
  ];

  window.UM_DEMO = {
    UM_CENTER,
    campusPlaces,
    buildings,
    biodiversityZones,
    busLines,
    tempPolicy,
    aqiBands,
  };
})();

