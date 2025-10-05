/* global L */

const CITY = {
  name: 'Cotonou, Littoral, Benin',
  lat: 6.3703,
  lon: 2.3912,
  zoom: 12
};

const map = L.map('map').setView([CITY.lat, CITY.lon], CITY.zoom);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

const facilitiesLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => L.circleMarker(latlng, {
    radius: 6,
    color: '#0d6efd',
    fillColor: '#3d8bfd',
    fillOpacity: 0.9,
    weight: 1
  }),
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    const html = `
      <b>${p.name || 'Health facility'}</b><br/>
      Amenity: ${p.amenity || 'N/A'}<br/>
      Address: ${p.address || 'N/A'}
    `;
    layer.bindPopup(html);
    // Hover tooltip for quick info on blue points
    layer.bindTooltip(
      `<b>${p.name || 'Health facility'}</b><br/>${p.amenity || 'N/A'}`,
      { direction: 'top', sticky: true, opacity: 0.9 }
    );
    layer.on('click', () => setDetails(html));
  }
});

const aqLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const color = '#0d6efd';
    return L.circleMarker(latlng, {
      radius: 5,
      color: color,
      fillColor: '#3d8bfd',
      fillOpacity: 0.8,
      weight: 1
    });
  },
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    const html = `
      <b>Air Quality</b><br/>
      Parameter: ${p.parameter} | Value: ${p.value} ${p.unit || ''}<br/>
      Location: ${p.location || ''}<br/>
      Time: ${p.datetime || ''}
    `;
    layer.bindPopup(html);
    layer.on('click', () => setDetails(html));
  }
});

const hotspotLayer = L.layerGroup();

// NASA GIBS: Multiple layers via local proxy
let gibsLayer = null;
const gibsDateInput = document.getElementById('gibsDate');
const gibsToggle = document.getElementById('toggleGibs');
const gibsLayerSelect = document.getElementById('gibsLayer');
const gibsOpacityInput = document.getElementById('gibsOpacity');

function formatDateYYYYMMDD(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function initGibsDateDefault() {
  if (!gibsDateInput) return;
  const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
  gibsDateInput.value = formatDateYYYYMMDD(yesterday);
}

function buildGibsLayer(dateStr, layerKey, opacity) {
  // Use local proxy to NASA GIBS to avoid CORS/rate surprises
  const template = `/api/gibs/${layerKey}/${dateStr}/{z}/{y}/{x}.jpg`;
  // Matrix zoom limits differ per layer; clamp at 9 as safe default
  const maxZ = 9;
  return L.tileLayer(template, {
    tileSize: 256,
    maxZoom: maxZ,
    opacity: opacity,
    attribution: `NASA GIBS ${layerKey}`
  });
}

function refreshGibsLayer() {
  if (!gibsToggle) return;
  const dateStr = gibsDateInput && gibsDateInput.value ? gibsDateInput.value : null;
  const layerKey = gibsLayerSelect ? gibsLayerSelect.value : 'S5P_NO2';
  const opacity = gibsOpacityInput ? Number(gibsOpacityInput.value) : 0.7;
  if (gibsLayer) {
    map.removeLayer(gibsLayer);
    gibsLayer = null;
  }
  if (gibsToggle.checked && dateStr) {
    gibsLayer = buildGibsLayer(dateStr, layerKey, opacity);
    gibsLayer.addTo(map);
  }
}

function getAQColor(v) {
  if (v == null) return '#888';
  // Simple scale: blue (low) -> red (high)
  if (v < 10) return '#1f77b4';
  if (v < 25) return '#2ca02c';
  if (v < 50) return '#ff7f0e';
  return '#d62728';
}

function setDetails(html) {
  document.getElementById('details').innerHTML = html;
}

async function loadFacilities() {
  try {
    const resp = await fetch('/api/health-facilities');
    const gj = await resp.json();
    facilitiesLayer.clearLayers();
    facilitiesLayer.addData(gj);
  } catch (e) {
    console.error('Facilities error', e);
  }
}

async function loadAirQuality() {
  try {
    const resp = await fetch('/api/air-quality');
    const gj = await resp.json();
    aqLayer.clearLayers();
    aqLayer.addData(gj);
  } catch (e) {
    console.error('Air quality error', e);
  }
}

async function loadHotspots() {
  try {
    hotspotLayer.clearLayers();
    const resp = await fetch('/api/hotspots');
    const data = await resp.json();
    (data.grid || []).forEach((cell) => {
      const [s, w, n, e] = cell.bbox;
      const bounds = [[s, w], [n, e]];
      const color = needColor(cell.need_score);
      const rect = L.rectangle(bounds, {
        color,
        weight: 1,
        fillOpacity: 0.2
      });
      const html = `
        <b>Hotspot cell</b><br/>
        Need score: ${cell.need_score.toFixed(2)}<br/>
        Facilities: ${cell.facilities} | AQ points: ${cell.aq_points}
      `;
      rect.bindPopup(html);
      rect.on('click', () => setDetails(html));
      hotspotLayer.addLayer(rect);
    });
  } catch (e) {
    console.error('Hotspots error', e);
  }
}


function needColor(score) {
  if (score < 1) return '#cccccc';
  if (score < 3) return '#ffcc00';
  if (score < 6) return '#ff9900';
  return '#ff3300';
}

// Layer toggles
map.addLayer(facilitiesLayer);
map.addLayer(aqLayer);
map.addLayer(hotspotLayer);

document.getElementById('toggleFacilities').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(facilitiesLayer) : map.removeLayer(facilitiesLayer);
});
document.getElementById('toggleAir').addEventListener('change', (e) => {                                                                                                                                                                    
  e.target.checked ? map.addLayer(aqLayer) : map.removeLayer(aqLayer);
});
document.getElementById('toggleHotspots').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(hotspotLayer) : map.removeLayer(hotspotLayer);
});
if (gibsToggle) {
  gibsToggle.addEventListener('change', () => refreshGibsLayer());
}
if (gibsDateInput) {
  gibsDateInput.addEventListener('change', () => refreshGibsLayer());
}
if (gibsLayerSelect) {
  gibsLayerSelect.addEventListener('change', () => refreshGibsLayer());
}
if (gibsOpacityInput) {
  gibsOpacityInput.addEventListener('input', () => {
    if (gibsLayer) gibsLayer.setOpacity(Number(gibsOpacityInput.value));
  });
}

// Initial load
(async function init() {
  initGibsDateDefault();
  refreshGibsLayer();
  await Promise.all([loadFacilities(), loadAirQuality(), loadHotspots()]);
  updateLegend();
})();

// Pollution Sources overlay (OSM)
const sourceColors = {
  landfill: '#0d6efd',
  power_plant: '#0d6efd',
  factory: '#0d6efd',
  road: '#0d6efd',
  source: '#0d6efd'
};

const sourcesLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const t = feature.properties?.type || 'source';
    const color = sourceColors[t] || '#343a40';
    return L.circleMarker(latlng, {
      radius: t === 'road' ? 4 : 6,
      color,
      fillColor: color,
      fillOpacity: 0.8,
      weight: 1
    });
  },
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    const html = `
      <b>${p.name || 'Source'}</b><br/>
      Type: ${p.type || 'source'}
    `;
    layer.bindPopup(html);
    layer.on('click', () => setDetails(html));
  }
});

async function loadSources() {
  try {
    const resp = await fetch('/api/sources');
    const gj = await resp.json();
    sourcesLayer.clearLayers();
    sourcesLayer.addData(gj);
  } catch (e) {
    console.error('Sources error', e);
  }
}

const toggleSources = document.getElementById('toggleSources');
if (toggleSources) {
  toggleSources.addEventListener('change', async (e) => {
    if (e.target.checked) {
      await loadSources();
      map.addLayer(sourcesLayer);
    } else {
      map.removeLayer(sourcesLayer);
    }
    updateLegend();
  });
}

// ---------------- Affected Areas (grid overlay, red scale) ----------------
const areasLayer = L.layerGroup();
const toggleAreas = document.getElementById('toggleAreas');
const areasMetricSelect = document.getElementById('areasMetric');

function redRamp(val) {
  // val in [0,1]
  const ramps = ['#ffb3b3','#ffb3b3','#ff8080','#ff4d4d','#ff1a1a'];
  const idx = Math.max(0, Math.min(ramps.length - 1, Math.floor(val * ramps.length)));
  return ramps[idx];
}

function getPointsFromLayer(layer, typeFilter) {
  const pts = [];
  layer.eachLayer((l) => {
    // circleMarker or marker
    if (l.getLatLng) {
      const latlng = l.getLatLng();
      const p = l.feature?.properties || {};
      if (!typeFilter || typeFilter(p)) pts.push({ lat: latlng.lat, lng: latlng.lng, props: p });
    }
  });
  return pts;
}

function computeAreasGrid(metric) {
  const bounds = map.getBounds();
  const rows = 18, cols = 18; // coarse grid for performance
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const latStep = (ne.lat - sw.lat) / rows;
  const lngStep = (ne.lng - sw.lng) / cols;
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ v: 0 })));

  // Gather points per metric
  const srcPoints = getPointsFromLayer(sourcesLayer);
  const aqPoints = getPointsFromLayer(aqLayer);

  function addPoint(lat, lng, weight) {
    const r = Math.floor((lat - sw.lat) / latStep);
    const c = Math.floor((lng - sw.lng) / lngStep);
    if (r < 0 || c < 0 || r >= rows || c >= cols) return;
    grid[r][c].v += weight;
  }

  if (metric === 'traffic_density') {
    srcPoints.forEach(p => { if (p.props.type === 'road') addPoint(p.lat, p.lng, 1); });
  } else if (metric === 'factory_density') {
    srcPoints.forEach(p => { if (p.props.type === 'factory') addPoint(p.lat, p.lng, 1); });
  } else if (metric === 'landfill_density') {
    srcPoints.forEach(p => { if (p.props.type === 'landfill') addPoint(p.lat, p.lng, 1); });
  } else if (metric === 'power_density') {
    srcPoints.forEach(p => { if (p.props.type === 'power_plant') addPoint(p.lat, p.lng, 1); });
  } else if (metric === 'aq_points') {
    aqPoints.forEach(p => addPoint(p.lat, p.lng, 1));
  } else {
    // combined_risk: sources (all but roads weight 2, roads weight 1) + AQ points (weight 2)
    srcPoints.forEach(p => {
      const w = p.props.type === 'road' ? 1 : 2;
      addPoint(p.lat, p.lng, w);
    });
    aqPoints.forEach(p => addPoint(p.lat, p.lng, 2));
  }

  // Find max for normalization
  let vmax = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) vmax = Math.max(vmax, grid[r][c].v);
  }
  return { grid, rows, cols, sw, latStep, lngStep, vmax: Math.max(1, vmax) };
}

function refreshAreas() {
  areasLayer.clearLayers();
  const metric = areasMetricSelect ? areasMetricSelect.value : 'combined_risk';
  const data = computeAreasGrid(metric);
  const { grid, rows, cols, sw, latStep, lngStep, vmax } = data;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r][c].v;
      if (v <= 0) continue;
      const val = v / vmax; // 0..1
      const color = redRamp(val);
      const cell = L.rectangle([
        [sw.lat + r * latStep, sw.lng + c * lngStep],
        [sw.lat + (r + 1) * latStep, sw.lng + (c + 1) * lngStep]
      ], {
        color,
        weight: 0,
        fillColor: color,
        fillOpacity: 0.35
      });
      areasLayer.addLayer(cell);
    }
  }
}

if (toggleAreas) {
  toggleAreas.addEventListener('change', (e) => {
    if (e.target.checked) {
      refreshAreas();
      areasLayer.addTo(map);
    } else {
      map.removeLayer(areasLayer);
    }
    updateLegend();
  });
}
if (areasMetricSelect) {
  areasMetricSelect.addEventListener('change', () => {
    if (toggleAreas?.checked) refreshAreas();
    updateLegend();
  });
}
map.on('moveend', () => { if (toggleAreas?.checked) refreshAreas(); });

// ---------------- Polluted Areas (AQ-only grid overlay, blue scale) ----------------
const pollutedLayer = L.layerGroup();
const togglePolluted = document.getElementById('togglePolluted');

function pollutedRamp(val) {
  // val in [0,1] - multi-color gradient for polluted areas
  const ramps = ['#00ff00','#ffff00','#ffa500','#ff6600','#ff0000'];
  const idx = Math.max(0, Math.min(ramps.length - 1, Math.floor(val * ramps.length)));
  return ramps[idx];
}

function computePollutedGrid() {
  const bounds = map.getBounds();
  const rows = 18, cols = 18;
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const latStep = (ne.lat - sw.lat) / rows;
  const lngStep = (ne.lng - sw.lng) / cols;
  const grid = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ({ v: 0 })));

  const aqPoints = [];
  aqLayer.eachLayer((l) => {
    if (!l.getLatLng) return;
    const ll = l.getLatLng();
    const v = l.feature?.properties?.value;
    if (ll && typeof v === 'number') aqPoints.push({ lat: ll.lat, lng: ll.lng, value: v });
  });

  // Normalize by max value; if values missing, count points instead
  const vmaxVal = aqPoints.reduce((m, p) => Math.max(m, p.value || 0), 0) || 1;
  aqPoints.forEach(p => {
    const r = Math.floor((p.lat - sw.lat) / latStep);
    const c = Math.floor((p.lng - sw.lng) / lngStep);
    if (r < 0 || c < 0 || r >= rows || c >= cols) return;
    const w = (p.value ? (p.value / vmaxVal) : 1);
    grid[r][c].v += w;
  });

  let vmax = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) vmax = Math.max(vmax, grid[r][c].v);
  }
  return { grid, rows, cols, sw, latStep, lngStep, vmax: Math.max(1, vmax) };
}

function refreshPolluted() {
  pollutedLayer.clearLayers();
  const data = computePollutedGrid();
  const { grid, rows, cols, sw, latStep, lngStep, vmax } = data;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const v = grid[r][c].v;
      if (v <= 0) continue;
      const val = v / vmax; // 0..1
      const color = pollutedRamp(val);
      const cell = L.rectangle([
        [sw.lat + r * latStep, sw.lng + c * lngStep],
        [sw.lat + (r + 1) * latStep, sw.lng + (c + 1) * lngStep]
      ], {
        color,
        weight: 0,
        fillColor: color,
        fillOpacity: 0.35
      });
      pollutedLayer.addLayer(cell);
    }
  }
}

if (togglePolluted) {
  togglePolluted.addEventListener('change', () => {
    if (togglePolluted.checked) {
      refreshPolluted();
      pollutedLayer.addTo(map);
    } else {
      map.removeLayer(pollutedLayer);
    }
    updateLegend();
  });
}
map.on('moveend', () => { if (togglePolluted?.checked) refreshPolluted(); });

// ---------------- Legend ----------------
function updateLegend() {
  const el = document.getElementById('legend');
  if (!el) return;
  const parts = [];

  // Facilities legend
  const showFacilities = document.getElementById('toggleFacilities')?.checked;
  if (showFacilities) {
    parts.push(`
      <div class="row">
        <span class="key" style="background:#3d8bfd;border-color:#0d6efd"></span>
        <span class="label">Health facility</span>
      </div>
    `);
  }

  // Air Quality legend (blue points)
  const showAQ = document.getElementById('toggleAir')?.checked;
  if (showAQ) {
    parts.push(`
      <div class="row"><span class="key" style="background:#3d8bfd;border-color:#0d6efd"></span><span class="label">Air Quality site</span></div>
    `);
  }

  // Hotspots legend
  const showHotspots = document.getElementById('toggleHotspots')?.checked;
  if (showHotspots) {
    parts.push(`
      <div class="row">
        <span class="key" style="background:#ff3300"></span>
        <span class="label">Hotspot (higher need score)</span>
      </div>
    `);
  }

  // Sources legend
  const showSources = document.getElementById('toggleSources')?.checked;
  if (showSources) {
    parts.push(`
      <div class="row"><span class="label muted">Pollution sources</span></div>
      <div class="row"><span class="key" style="background:#3d8bfd;border-color:#0d6efd"></span><span class="label">Factory</span></div>
      <div class="row"><span class="key" style="background:#3d8bfd;border-color:#0d6efd"></span><span class="label">Power plant</span></div>
      <div class="row"><span class="key" style="background:#3d8bfd;border-color:#0d6efd"></span><span class="label">Landfill/Waste</span></div>
      <div class="row"><span class="key" style="background:#3d8bfd;border-color:#0d6efd"></span><span class="label">Major road</span></div>
    `);
  }

  // GIBS legend per selected layer
  const showGibs = document.getElementById('toggleGibs')?.checked;
  if (showGibs) {
    const layerKey = gibsLayerSelect ? gibsLayerSelect.value : 'S5P_NO2';
    let title = 'NASA GIBS';
    let gradient = null;
    if (layerKey === 'S5P_NO2') {
      title = 'S5P NO2 (TROPOMI)';
      gradient = 'linear-gradient(90deg,#2c7bb6,#abd9e9,#ffffbf,#fdae61,#d7191c)';
    } else if (layerKey === 'MAIAC_AOD') {
      title = 'MAIAC AOD';
      gradient = 'linear-gradient(90deg,#ffffcc,#a1dab4,#41b6c4,#2c7fb8,#253494)';
    } else if (layerKey === 'MODIS_TrueColor') {
      title = 'MODIS True Color (context)';
      gradient = null;
    } else if (layerKey === 'VIIRS_DNB') {
      title = 'VIIRS Night Lights';
      gradient = 'linear-gradient(90deg,#000,#444,#888,#bbb,#fff)';
    }
    parts.push(`<div class="row"><span class="label muted">${title}</span></div>`);
    if (gradient) {
      parts.push(`<div class="row"><div class="bar" style="background:${gradient}"></div><span class="label">low → high</span></div>`);
    }
  }

  // Affected Areas metric legend
  const showAreas = document.getElementById('toggleAreas')?.checked;
  if (showAreas) {
    const metric = document.getElementById('areasMetric')?.value || 'combined_risk';
    const ramp = ['#ffe5e5','#ffb3b3','#ff8080','#ff4d4d','#ff1a1a'];
    parts.push(`<div class="row"><span class="label muted">Affected areas: ${metric.replace(/_/g,' ')}</span></div>`);
    parts.push(`<div class="row"><div class="bar" style="background: linear-gradient(90deg, ${ramp.join(',')})"></div><span class="label">low → very high</span></div>`);
  }

  // Polluted Areas legend (AQ-only)
  const showPolluted = document.getElementById('togglePolluted')?.checked;
  if (showPolluted) {
    const ramp = ['#00ff00','#ffff00','#ffa500','#ff6600','#ff0000'];
    parts.push(`<div class="row"><span class="label muted">Polluted areas (AQ only)</span></div>`);
    parts.push(`<div class="row"><div class="bar" style="background: linear-gradient(90deg, ${ramp.join(',')})"></div><span class="label">clean → highly polluted</span></div>`);
  }


  el.innerHTML = parts.join('');
}

// Recompute legend on UI changes
['toggleFacilities','toggleAir','toggleHotspots','toggleSources','toggleGibs','toggleAreas','gibsLayer','gibsOpacity','areasMetric']
  .forEach(id => {
    const c = document.getElementById(id);
    if (!c) return;
    const ev = (id === 'gibsOpacity') ? 'input' : 'change';
    c.addEventListener(ev, updateLegend);
  });

// ---------------- Auto-reload (dev convenience) ----------------
(function setupAutoReload(){
  let last = 0;
  async function tick(){
    try{
      const r = await fetch('/__mtime');
      const j = await r.json();
      const t = j.t || 0;
      if (!last) { last = t; }
      else if (t > last) { window.location.reload(); }
    }catch(e){ /* ignore */ }
    setTimeout(tick, 2000);
  }
  tick();
})();

// Include new polluted toggle in legend updates
const pollutedCtl = document.getElementById('togglePolluted');
if (pollutedCtl) pollutedCtl.addEventListener('change', updateLegend);
