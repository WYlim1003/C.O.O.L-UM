# UM Smart Sustainability Dashboard (Demo)

Single-page website demo for a **Smart Sustainability Dashboard** for **Universiti Malaya (UM), Malaysia**.

## Features included

- **Campus map (UM-centered)** using OpenStreetMap tiles (Leaflet)
- **6 sustainability goal buttons**:
  1. **Campus Temperature (Urban Heat Monitoring)**: per-place temperature + humidity + heat index + **IoT cooling ON/OFF** (demo control logic)
  2. **Energy usage in buildings**: dummy but live-updating building KPIs
  3. **Green space & biodiversity**: canopy + biodiversity indicators (demo metrics)
  4. **Transportation efficiency**: UM bus lines **AB, BA, C, D, E, 13** with a dashboard (demo KPIs)
  5. **Water management & recycling**: dummy water + recycling diversion KPIs
  6. **Air quality tracking**: AQI + PM2.5 + CO₂ sensors (simulated)
- **Green Points Reward System** (top-right “Rewards”): claim demo actions, points stored in your browser (localStorage)

## How to run

### Option A (simplest): open the HTML file

Open `index.html` in a browser:

- `UM-Smart-Sustainability-Dashboard/index.html`

### Option B (recommended): run a tiny local web server

Some browsers restrict map tile loading when opening a file directly. If you see a blank map, start a local server:

PowerShell (Windows):

```powershell
cd "C:\Users\User\UM-Smart-Sustainability-Dashboard"
python -m http.server 8080
```

Then open:

- `http://localhost:8080`

## Replace demo data with real UM data (later)

- **Sensors (temperature/air quality)**: connect to IoT gateways (MQTT/HTTP) and replace the simulator in `app.js`
- **Energy/Water**: connect to UM BMS / meters and replace the dummy building maps in `data.js`
- **Transportation**: connect bus GPS + ridership counters to replace demo KPIs

