/* Demo datasets for UM Smart Sustainability Dashboard.
   Replace these with real UM feeds / APIs when available. */

(() => {
  const UM_CENTER = { lat: 3.1202, lng: 101.6536 }; // Universiti Malaya (approx)

  const campusPlaces = [
    { id: "um-main-gate", name: "UM Main Gate", lat: 3.1207, lng: 101.6557, zone: "Gateway" },
    { id: "perdana-library", name: "Perpustakaan Utama", lat: 3.1187, lng: 101.6545, zone: "Academic" },
    { id: "dewan-tunku", name: "Dewan Tunku Canselor", lat: 3.117, lng: 101.6518, zone: "Admin" },
    { id: "um-central", name: "UM Central (Student Hub)", lat: 3.1202, lng: 101.6519, zone: "Student" },
    { id: "fsktm", name: "Faculty of Computer Science and Information Technology", lat: 3.1262, lng: 101.6569, zone: "Academic" },
    { id: "sport-centre", name: "Sports Centre", lat: 3.1155, lng: 101.6527, zone: "Sports" },
    { id: "kolej-kediaman", name: "Residential College Area", lat: 3.1119, lng: 101.6574, zone: "Residential" },
    { id: "lakeside", name: "Tasik Varsiti (Lakeside)", lat: 3.1221, lng: 101.6469, zone: "Green" },

    // Residential colleges KK1–KK13 (approximate locations)
    { id: "kk1", name: "Kolej Kediaman Tuanku Abdul Rahman (ASTAR) – KK1", lat: 3.1180, lng: 101.6525, zone: "Residential" },
    { id: "kk2", name: "Kolej Kediaman Tuanku Bahiyah – KK2", lat: 3.1188, lng: 101.6535, zone: "Residential" },
    { id: "kk3", name: "Kolej Kediaman Tuanku Kurshiah – KK3", lat: 3.1192, lng: 101.6545, zone: "Residential" },
    { id: "kk4", name: "Kolej Kediaman Bestari – KK4", lat: 3.1184, lng: 101.6572, zone: "Residential" },
    { id: "kk5", name: "Kolej Kediaman Dayasari – KK5", lat: 3.1211, lng: 101.6563, zone: "Residential" },
    { id: "kk6", name: "Kolej Kediaman Dayasari – KK6", lat: 3.1205, lng: 101.6555, zone: "Residential" },
    { id: "kk7", name: "Kolej Kediaman Za'ba – KK7", lat: 3.1218, lng: 101.6527, zone: "Residential" },
    { id: "kk8", name: "Kolej Kediaman Kinabalu – KK8", lat: 3.1224, lng: 101.6534, zone: "Residential" },
    { id: "kk9", name: "Kolej Kediaman Tun Syed Zahiruddin – KK9", lat: 3.1106, lng: 101.6528, zone: "Residential" },
    { id: "kk10", name: "Kolej Kediaman Tun Ahmad Zaidi – KK10", lat: 3.123, lng: 101.6515, zone: "Residential" },
    { id: "kk11", name: "Kolej Kediaman Ungku Aziz – KK11", lat: 3.1195, lng: 101.6485, zone: "Residential" },
    { id: "kk12", name: "Kolej Kediaman Raja Dr. Nazrin Shah – KK12", lat: 3.1182, lng: 101.6498, zone: "Residential" },
    { id: "kk13", name: "Kolej Kediaman Tiga Belas – KK13", lat: 3.1125, lng: 101.6475, zone: "Residential" },

    // Key academic stops
    { id: "eng-faculty", name: "Faculty of Engineering", lat: 3.1238, lng: 101.6558, zone: "Academic" },
    { id: "science-faculty", name: "Faculty of Science", lat: 3.1183, lng: 101.6522, zone: "Academic" },
    { id: "api", name: "Academy of Islamic Studies (API)", lat: 3.1212, lng: 101.6495, zone: "Academic" },
    { id: "academy-malay-studies", name: "Academy of Malay Studies", lat: 3.1198, lng: 101.6532, zone: "Academic" },
    { id: "cff", name: "Centre for Foundation in Science", lat: 3.1222, lng: 101.6548, zone: "Academic" },

    // External / off-campus points
    { id: "angkasapuri", name: "Angkasapuri", lat: 3.104, lng: 101.6635, zone: "External" },
    { id: "pantai-permai", name: "Pantai Permai", lat: 3.1003, lng: 101.6655, zone: "External" },
    { id: "bangsar-south", name: "Bangsar South", lat: 3.1122, lng: 101.663, zone: "External" },
    { id: "ummc", name: "UM Medical Centre", lat: 3.0945, lng: 101.6545, zone: "External" },

    { id: "eng-faculty-west", name: "Faculty of Engineering (West Gate)", lat: 3.1252, lng: 101.6547, zone: "Academic" },
    { id: "international-house", name: "International House", lat: 3.1251, lng: 101.6529, zone: "Residential" },
    { id: "rapid-ss17", name: "Rapid Stop 1 - Flat SS17", lat: 3.1092, lng: 101.6338, zone: "External" },
    { id: "rapid-sri-damai", name: "Rapid Stop 2 - S.K. Sri Damai", lat: 3.108, lng: 101.6365, zone: "External" },
    { id: "rapid-happy-mansion", name: "Rapid Stop 3 - PJ 219 Happy Mansion", lat: 3.1044, lng: 101.634, zone: "External" },
    { id: "rapid-happy-apartment", name: "Rapid Stop 4 - PJ 220 Happy Apartment Gate A", lat: 3.1029, lng: 101.6337, zone: "External" },
    { id: "rapid-shell-1722", name: "Rapid Stop 5 - PJ 233 Shell 17/22", lat: 3.0998, lng: 101.635, zone: "External" },
    { id: "seksyen-16", name: "Perumahan Seksyen 16", lat: 3.1057, lng: 101.6405, zone: "External" },
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

  // Campus directory for user-friendly listing
  const buildingDirectory = [
    // Residential colleges (KK1–KK13 with official names)
    { id: "kk1", name: "Kolej Kediaman Tuanku Abdul Rahman (ASTAR) – KK1", group: "Residential Colleges" },
    { id: "kk2", name: "Kolej Kediaman Tuanku Bahiyah – KK2", group: "Residential Colleges" },
    { id: "kk3", name: "Kolej Kediaman Tuanku Kurshiah – KK3", group: "Residential Colleges" },
    { id: "kk4", name: "Kolej Kediaman Bestari – KK4", group: "Residential Colleges" },
    { id: "kk5", name: "Kolej Kediaman Dayasari – KK5", group: "Residential Colleges" },
    { id: "kk6", name: "Kolej Kediaman Dayasari – KK6", group: "Residential Colleges" },
    { id: "kk7", name: "Kolej Kediaman Za'ba – KK7", group: "Residential Colleges" },
    { id: "kk8", name: "Kolej Kediaman Kinabalu – KK8", group: "Residential Colleges" },
    { id: "kk9", name: "Kolej Kediaman Tun Syed Zahiruddin – KK9", group: "Residential Colleges" },
    { id: "kk10", name: "Kolej Kediaman Tun Ahmad Zaidi – KK10", group: "Residential Colleges" },
    { id: "kk11", name: "Kolej Kediaman Ungku Aziz – KK11", group: "Residential Colleges" },
    { id: "kk12", name: "Kolej Kediaman Raja Dr. Nazrin Shah – KK12", group: "Residential Colleges" },
    { id: "kk13", name: "Kolej Kediaman 13 – KK13", group: "Residential Colleges" },

    // Faculties (aligned with UM list)
    { id: "f-built-env", name: "Faculty of Built Environment", group: "Faculties" },
    { id: "f-language", name: "Faculty of Languages and Linguistics", group: "Faculties" },
    { id: "f-pharmacy", name: "Faculty of Pharmacy", group: "Faculties" },
    { id: "f-eng", name: "Faculty of Engineering", group: "Faculties" },
    { id: "f-education", name: "Faculty of Education", group: "Faculties" },
    { id: "f-dentistry", name: "Faculty of Dentistry", group: "Faculties" },
    { id: "f-business", name: "Faculty of Business and Economics", group: "Faculties" },
    { id: "f-medicine", name: "Faculty of Medicine", group: "Faculties" },
    { id: "f-science", name: "Faculty of Science", group: "Faculties" },
    { id: "f-fcsit", name: "Faculty of Computer Science and Information Technology", group: "Faculties" },
    { id: "f-arts", name: "Faculty of Arts and Social Sciences", group: "Faculties" },
    { id: "f-creative", name: "Faculty of Creative Arts", group: "Faculties" },
    { id: "f-law", name: "Faculty of Law", group: "Faculties" },
    { id: "f-sport", name: "Faculty of Sport and Exercise Sciences", group: "Faculties" },
    { id: "f-isis", name: "Academy of Islamic Studies (API)", group: "Faculties" },
    { id: "f-malay", name: "Academy of Malay Studies", group: "Faculties" },
    { id: "cff-dir", name: "Centre for Foundation in Science", group: "Faculties" },

    // Administration
    { id: "admin-dtc", name: "Dewan Tunku Canselor", group: "Administration" },
    { id: "admin-chancellery", name: "Chancellery Building", group: "Administration" },
    { id: "admin-registrar", name: "Registrar's Office", group: "Administration" },
    { id: "admin-bursar", name: "Bursar's Office", group: "Administration" },
    { id: "admin-umsentral", name: "UM Central Administration", group: "Administration" },

    // Facilities & shared services
    { id: "fac-library", name: "Perpustakaan Utama (Main Library)", group: "Facilities" },
    { id: "fac-sport-centre", name: "Sports Centre", group: "Facilities" },
    { id: "fac-stadium", name: "UM Stadium & Track", group: "Facilities" },
    { id: "fac-swimming", name: "Swimming Pool Complex", group: "Facilities" },
    { id: "fac-health", name: "University Health Centre", group: "Facilities" },
    { id: "fac-mosque", name: "UM Mosque", group: "Facilities" },
    { id: "fac-lakeside", name: "Tasik Varsiti (Lakeside)", group: "Facilities" },
    { id: "fac-student-affairs", name: "Student Affairs Division (HEPA)", group: "Facilities" },
    { id: "fac-ptm", name: "Information Technology Centre (PTM)", group: "Facilities" },
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

  // Detailed bus routes: closed loops connecting key stops (demo geometry)
  const busRoutes = [
    {
      id: "AB",
      name: "AB",
      color: "#46d6ff",
      stops: [
        "um-central",
        "kk7",
        "kk10",
        "api",
        "kk11",
        "kk12",
        "kk1",
        "eng-faculty",
        "um-central",
      ],
      description:
        "UM Central → Za'ba RC → Tun Ahmad Zaidi RC → API → Ungku Aziz RC → Raja Dr Nazrin Shah RC → Tunku Abdul Rahman RC → Faculty of Engineering → UM Central",
    },
    {
      id: "BA",
      name: "BA",
      color: "#45ff9a",
      stops: [
        "um-central",
        "cff",
        "kk5",
        "api",
        "kk10",
        "academy-malay-studies",
        "kk3",
        "kk4",
        "kk7",
        "science-faculty",
        "um-central",
      ],
      description:
        "UM Central → Centre for Foundation in Science → Dayasari RC → API → Tun Ahmad Zaidi RC → Academy of Malay Studies → Kurshiah/Bestari/Za'ba RC → Faculty of Science → UM Central",
    },
    {
      id: "C",
      name: "C",
      color: "#ffd25e",
      stops: [
        "um-central",
        "cff",
        "angkasapuri",
        "pantai-permai",
        "bangsar-south",
        "eng-faculty",
        "um-central",
      ],
      description:
        "UM Central → Centre for Foundation in Science → Angkasapuri → Pantai Permai → Bangsar South → Faculty of Engineering → UM Central",
    },
    {
      id: "D",
      name: "D",
      color: "#ff5d7a",
      stops: [
        "um-central",
        "eng-faculty-west",
        "international-house",
        "rapid-ss17",
        "rapid-sri-damai",
        "rapid-happy-mansion",
        "rapid-happy-apartment",
        "rapid-shell-1722",
        "seksyen-16",
        "kk13",
        "um-central",
      ],
      description:
        "UM Central → Faculty of Engineering (West) → International House → Rapid SS17 → Rapid Sri Damai → Rapid PJ 219 Happy Mansion → Rapid PJ 220 Happy Apartment → Rapid PJ 233 Shell 17/22 → Perumahan Seksyen 16 → Kolej Kediaman KK13 → UM Central",
    },
    {
      id: "E",
      name: "E",
      color: "#b59cff",
      stops: ["um-central", "kk9", "science-faculty", "um-central"],
      description:
        "UM Central → Tun Syed Zahiruddin RC → Faculty of Science → UM Central",
    },
    {
      id: "13",
      name: "13",
      color: "#ff9b4a",
      stops: ["um-central", "kk13", "um-central"],
      description: "UM Central → Kolej Kediaman KK13 → UM Central",
    },
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
    buildingDirectory,
    biodiversityZones,
    busLines,
    busRoutes,
    tempPolicy,
    aqiBands,
  };
})();

