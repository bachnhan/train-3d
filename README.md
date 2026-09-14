# Tokyo 3D — Procedural Multi-Vehicle Urban Simulation & Diorama Engine

A zero-dependency, high-performance WebGL/Three.js procedural multi-vehicle urban simulation and Tokyo diorama platform. Features procedural geometry batching, multi-modal vehicle kinematics (Series 2026 commuter train, commercial airliner, Shibuya River patrol boat, city buses, taxis, and walking pedestrians), real-time dynamic weather (clear, sunset, night, rain, snow, storm with lightning), synthesized Web Audio, geographic GIS terrain integration (PLATEAU & OpenStreetMap), and accessible screen-reader navigation.

---

## Features

- **Procedural Mesh Builder (`src/builder.js`)**: 12-float interleaved vertex batching (`Float32Array`) directly into unified WebGL material groups. Strict budgets: $\le 60$ draw calls, $\le 420,000$ triangles, $\le 1,500$ triangles per individual asset.
- **Multi-Modal Vehicle Kinematics (`src/train.js`, `src/traffic.js`, `src/riverboat.js`, `src/pedestrians.js`)**: Real-time 60Hz physics and tracking across rail, airspace, waterways, and street networks. Features dual-bogie train kinematics with pantograph catenary tracking, cruising commercial airliners, watercraft canal navigation, looping city buses and taxis, and animated pedestrians.
- **Dynamic Atmospheric Weather (`src/weather.js`, `src/sky.js`)**: Real-time celestial sun motion, sunset scattering, Tokyo night sky glow with window illumination, instanced rain with surface splash rings, gentle drift snowfall, and dynamic storm system with thunderous procedural lightning bolts.
- **Dynamic Shibuya River Simulation (`src/water.js`)**: Procedural water ribbon mesh with physical wave heaving, flowing currents, specular caustics, shoreline foam along retaining walls, patrol boat wake interaction, and atmospheric weather tinting.
- **Authentic Streetlife & Architecture (`src/architecture.js`, `src/streetlife.js`)**: Shibuya Scramble landmarks, telephone booths, bus stops, delivery vans, Koban police boxes, rooftop water tanks, and PLATEAU-aligned architectural facades.
- **Resilient Procedural Audio (`src/audio.js`)**: Zero audio asset downloads. Synthesized VVVF inverter motor acceleration, flange squeal, rail joint clicks, rain patter, and thunder rumbles.
- **Physical Clearance & Geometry Invariant QA (`scripts/`)**: Headless Node.js regression suites verifying rolling stock loading gauge clearance, vertex stride invariance, and procedural mesh budgets without requiring Puppeteer or GPU canvas.
- **Accessible Digital Twin (`src/accessible-twin.js`)**: Synchronized semantic 2D HTML navigation and ARIA landmarks for screen-reader accessibility.

---

## Quick Start

### 1. Prerequisites
- **Node.js**: $\ge 18.0.0$ (for headless test suites)
- **Browser**: Modern desktop or mobile browser with WebGL support

### 2. Run Locally
```bash
# Clone the repository
git clone https://github.com/bachnhan/train-3d.git
cd train-3d

# Start local static server
npm start
# or: python3 -m http.server 8008
```
Open [http://localhost:8008/index.html](http://localhost:8008/index.html) in your browser.

### 3. Run Automated QA Tests
```bash
npm test
# Runs headless clearance & geometry regression suites:
# node scripts/qa.mjs
# node scripts/geometry-qa.mjs
```

---

## Interactive Controls & Navigation

| Category | Shortcut / Control | Description |
| :--- | :--- | :--- |
| **Mobility Tracking** | Click vehicle pills in dock | Track Series 2026 Train, Boeing 777 Airliner, Patrol Boat, Tokyo City Bus, or Crown Taxi |
| **Camera Views** | `1` / `Follow` | Third-person tracking camera behind the focused vehicle |
| | `2` / `Cab` | Cockpit / driver perspective |
| | `3` / `Orbit` | Orbit camera circling the vehicle |
| | `4` / `Roadside` | Stationary trackside / roadside telephoto view |
| | `5` / `Overhead` | Angled architectural diorama overview |
| | `6` / `Wide` | Panoramic corridor bird's-eye perspective |
| **Weather Presets** | Top Horizon Bar | Toggle Clear, Sunset, Night, Rain, Snow, or Storm |
| **Storm Lightning** | Lightning button | Manually trigger procedural cloud-to-ground lightning discharge |
| **Sound Toggle** | Audio button / `M` | Toggle synthesized VVVF motor, rail joint, and ambient weather audio |
| **Zen / Clean Mode** | Eye button / `H` | Hide all HUD overlays for cinematic screenshots |
| **Fullscreen** | `F` | Toggle browser fullscreen display |

---

## Repository Structure

```text
train-3d/
├── index.html              # Main simulation entry point & import map
├── css/
│   └── train-3d.css        # Responsive dark glassmorphism HUD stylesheet
├── src/
│   ├── main.js             # Simulation initialization & render loop
│   ├── builder.js          # Procedural low-poly interleaved geometry compiler
│   ├── water.js            # Dynamic Shibuya River water mesh & shader
│   ├── traffic.js          # Surveyed road bus & taxi kinematics
│   ├── train.js            # Series 2026 train bogie & pantograph kinematics
│   ├── riverboat.js        # Patrol boat navigation & wake generation
│   ├── sky.js              # Celestial atmosphere, cloud generation & airliner
│   ├── weather.js          # Real-time weather manager (rain, snow, lightning)
│   ├── audio.js            # Zero-dependency Web Audio procedural sound engine
│   ├── architecture.js     # Landmarks (Scramble Square, Cerulean, Daikanyama)
│   ├── streetlife.js       # Urban street furniture, phone booths, crossings
│   ├── pedestrians.js      # Animated walking promenade pedestrians
│   ├── map-model.js        # Geographic coordinate projection & clearance authority
│   ├── accessible-twin.js  # 2D semantic accessibility twin for screen readers
│   ├── hud.js              # Glassmorphic UI controllers and telemetry
│   └── data/               # Filtered GIS datasets (PLATEAU & OpenStreetMap)
├── scripts/
│   ├── qa.mjs              # Headless loading gauge clearance audit
│   ├── geometry-qa.mjs     # Byte-for-byte vertex buffer invariance audit
│   └── contribute-3d.mjs   # Contributor CLI recipe task router
├── .github/workflows/
│   └── ci.yml              # Automated GitHub Actions test pipeline
├── LICENSE                 # MIT License & third-party notices
└── package.json            # Engine metadata and test scripts
```

---

## Data Attribution & Licensing

- **3D Building Polygons**: Project PLATEAU Shibuya-ku 2025 (Ministry of Land, Infrastructure, Transport and Tourism of Japan / 国土交通省) under [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Building footprints and heights were extracted from CityGML LOD0/LOD1 and simplified for procedural WebGL rendering.
- **Road Network**: © OpenStreetMap contributors under [ODbL 1.0](https://www.openstreetmap.org/copyright).
- **Railway Geometry**: Procedural heritage railway alignment based on historical pre-2013 elevated track surveys.
- **Web Fonts**: M PLUS Rounded 1c & Plus Jakarta Sans under [SIL Open Font License 1.1](https://openfontlicense.org/).
- **Engine Code**: Licensed under the [MIT License](./LICENSE).

### Trademark Disclaimer
Company names, train series designations, and bus route numbers are used strictly for nominative, descriptive, and artistic representation of Tokyo's urban cityscape. This project is an independent open-source work and is not affiliated with, sponsored by, or endorsed by any railway operators, bus corporations, or municipal transportation agencies.
