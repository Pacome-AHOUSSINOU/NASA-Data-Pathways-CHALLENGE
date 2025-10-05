import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import pino from 'pino';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const logger = pino({ level: process.env.LOG_LEVEL || 'info' });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Cotonou (Littoral, Benin) approximate center and bounds
const CITY = {
  name: 'Cotonou, Littoral, Benin',
  lat: 6.3703,
  lon: 2.3912,
  // Bounding box [south, west, north, east]
  bbox: [6.32, 2.33, 6.45, 2.52]
};

// Health facilities via Overpass API (OSM)
app.get('/api/health-facilities', async (req, res) => {
  try {
    const [s, w, n, e] = CITY.bbox;
    const amenities = [
      'hospital',
      'clinic',
      'doctors',
      'pharmacy',
      'dentist',
      'health_post'
    ];
    const query = `
      [out:json][timeout:25];
      (
        node["amenity"~"${amenities.join('|')}"](${s},${w},${n},${e});
        way["amenity"~"${amenities.join('|')}"](${s},${w},${n},${e});
        relation["amenity"~"${amenities.join('|')}"](${s},${w},${n},${e});
      );
      out center tags;
    `;

    const url = 'https://overpass-api.de/api/interpreter';
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ data: query })
    });
    if (!resp.ok) throw new Error(`Overpass error: ${resp.status}`);
    const data = await resp.json();

    // Normalize to GeoJSON Points (use center for ways/relations)
    const features = (data.elements || []).map((el) => {
      const coords = el.type === 'node'
        ? [el.lon, el.lat]
        : el.center
        ? [el.center.lon, el.center.lat]
        : null;
      if (!coords) return null;
      return {
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coords },
        properties: {
          id: `${el.type}/${el.id}`,
          name: el.tags?.name || el.tags?.official_name || 'Unknown',
          amenity: el.tags?.amenity || 'unknown',
          phone: (el.tags?.phone) || (el.tags?.['contact:phone']) || null,
          address: [el.tags?.['addr:housenumber'], el.tags?.['addr:street'], el.tags?.['addr:city']]
            .filter(Boolean)
            .join(' ')
        }
      };
    }).filter(Boolean);

    res.json({ type: 'FeatureCollection', features });
  } catch (err) {
    logger.error(err, 'health-facilities error');
    res.status(500).json({ error: 'Failed to fetch health facilities' });
  }
});

// Air quality via OpenAQ around Cotonou
app.get('/api/air-quality', async (req, res) => {
  try {
    const { lat = CITY.lat, lon = CITY.lon, radius = 20000, limit = 100 } = req.query;
    const params = new URLSearchParams({
      coordinates: `${lat},${lon}`,
      radius: String(radius),
      limit: String(limit),
      sort: 'desc',
      order_by: 'datetime',
      // prioritize common health-relevant pollutants
      parameter: ['pm25', 'pm10', 'no2', 'o3', 'so2', 'co'].join(',')
    });
    // Try measurements endpoint first
    const urlMeasurements = `https://api.openaq.org/v2/measurements?${params.toString()}`;
    let resp = await fetch(urlMeasurements);
    let features = [];

    if (resp.ok) {
      const data = await resp.json();
      features = (data.results || []).map((m) => {
        const coords = m.coordinates ? [m.coordinates.longitude, m.coordinates.latitude] : null;
        if (!coords) return null;
        return {
          type: 'Feature',
          geometry: { type: 'Point', coordinates: coords },
          properties: {
            parameter: m.parameter,
            value: m.value,
            unit: m.unit,
            datetime: m.date?.utc || m.date?.local,
            location: m.location,
            country: m.country,
            city: m.city
          }
        };
      }).filter(Boolean);
    } else {
      // Fallback: OpenAQ latest endpoint (different schema)
      const urlLatest = `https://api.openaq.org/v2/latest?${params.toString()}`;
      const respLatest = await fetch(urlLatest);
      if (respLatest.ok) {
        const data = await respLatest.json();
        // Map results[].measurements[] to point features at location coordinates
        features = (data.results || []).flatMap((loc) => {
          const coords = loc.coordinates ? [loc.coordinates.longitude, loc.coordinates.latitude] : null;
          if (!coords) return [];
          return (loc.measurements || []).map((m) => ({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: coords },
            properties: {
              parameter: m.parameter,
              value: m.value,
              unit: m.unit,
              datetime: m.lastUpdated || m.date?.utc || m.date?.local,
              location: loc.location,
              country: loc.country,
              city: loc.city
            }
          }));
        });
      } else {
        // Graceful empty result to avoid breaking the UI
        return res.json({ type: 'FeatureCollection', features: [] });
      }
    }

    res.json({ type: 'FeatureCollection', features });
  } catch (err) {
    logger.error(err, 'air-quality error');
    // Return empty feature collection to keep the app responsive
    res.json({ type: 'FeatureCollection', features: [] });
  }
});

// Health hotspots (simple composite demo): counts of facilities vs recent AQ points per neighborhood grid
app.get('/api/hotspots', async (req, res) => {
  try {
    // Simple grid-based summary over bbox
    const [s, w, n, e] = CITY.bbox;
    const rows = 6, cols = 6;
    const cellH = (n - s) / rows;
    const cellW = (e - w) / cols;

    const [facResp, aqResp] = await Promise.all([
      fetch(`${req.protocol}://${req.get('host')}/api/health-facilities`),
      fetch(`${req.protocol}://${req.get('host')}/api/air-quality?limit=200`)
    ]);
    const facilities = await facResp.json().catch(() => ({ type: 'FeatureCollection', features: [] }));
    const air = await aqResp.json().catch(() => ({ type: 'FeatureCollection', features: [] }));

    const facFeatures = Array.isArray(facilities?.features) ? facilities.features : [];
    const airFeatures = Array.isArray(air?.features) ? air.features : [];

    const grid = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = {
          id: `${r}-${c}`,
          bbox: [s + r * cellH, w + c * cellW, s + (r + 1) * cellH, w + (c + 1) * cellW],
          facilities: 0,
          aq_points: 0
        };
        grid.push(cell);
      }
    }

    const inCell = (lat, lon, cell) => lat >= cell.bbox[0] && lat < cell.bbox[2] && lon >= cell.bbox[1] && lon < cell.bbox[3];

    facFeatures.forEach((f) => {
      const [lon, lat] = f.geometry.coordinates;
      grid.forEach((cell) => { if (inCell(lat, lon, cell)) cell.facilities++; });
    });
    airFeatures.forEach((f) => {
      const [lon, lat] = f.geometry.coordinates;
      grid.forEach((cell) => { if (inCell(lat, lon, cell)) cell.aq_points++; });
    });

    // Simple "need" score: high AQ points, low facilities
    const scores = grid.map((cell) => ({
      id: cell.id,
      bbox: cell.bbox,
      facilities: cell.facilities,
      aq_points: cell.aq_points,
      need_score: (cell.aq_points || 0) - 0.5 * (cell.facilities || 0)
    }));

    res.json({ grid: scores.sort((a, b) => b.need_score - a.need_score).slice(0, 10) });
  } catch (err) {
    logger.error(err, 'hotspots error');
    res.status(500).json({ error: 'Failed to compute hotspots' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  logger.info({ port }, `Server running for ${CITY.name}`);
});
