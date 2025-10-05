# Benin Littoral Public Health Dashboard

A Node.js + Leaflet dashboard for a public health officer in Benin's Littoral region (Cotonou). It maps health facilities (OSM/Overpass), nearby air quality measurements (OpenAQ), and a simple demo hotspot score (areas with higher AQ points and fewer facilities).

## Features
- Health facilities from OpenStreetMap via Overpass API
- Air quality measurements via OpenAQ API (pm25, pm10, no2, o3, so2, co)
- Simple grid-based hotspot score for quick prioritization
- Toggle layers and see details on click

## Stack
- Node.js (Express)
- Leaflet (OpenStreetMap tiles)
- Data sources: Overpass API, OpenAQ API

## Run locally
You can run either the original Node.js server or the new Python FastAPI server.

### Option A: Python (FastAPI)
1. Requirements: Python 3.10+
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Start the server:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 3000
   ```
4. Open the app at: http://localhost:3000

### Option B: Node.js (legacy)
1. Requirements: Node.js 18+
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open the app at: http://localhost:3000

## Notes
- The hotspot score is a simplified demo to illustrate a data pathway. For production use, refine with validated exposure models, NASA datasets (e.g., MAIAC AOD, ECOSTRESS LST), and local ground truth.
- APIs used are public. If rate-limited, try again or switch Overpass mirrors.

## Project structure
- `app/main.py` — FastAPI server and endpoints
- `server.js` — Node.js API proxy/server and hotspot computation (legacy)
- `public/` — front-end (Leaflet map)
- `public/index.html` — UI
- `public/app.js` — data fetching and layers
- `public/styles.css` — styles

## License
MIT
