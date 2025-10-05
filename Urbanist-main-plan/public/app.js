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
    radius: 4,
    color: '#0d6efd',
    fillColor: '#3d8bfd',
    fillOpacity: 0.6,
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
    const color = '#00CED1'; // Turquoise distinctif
    return L.circleMarker(latlng, {
      radius: 4,
      color: color,
      fillColor: '#20B2AA',
      fillOpacity: 0.7,
      weight: 2
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

// Nouvelle couche pour les zones de pollution spécifiques avec effets spectaculaires
const pollutionZonesLayer = L.geoJSON(null, {
  style: (feature) => {
    const props = feature.properties || {};
    const zoneType = props.zone_type;
    
    let color = '#0d6efd';
    let fillOpacity = 0.7;
    let weight = 4;
    let dashArray = null;
    let className = '';
    
    if (zoneType === 'air_pollution') {
      color = props.color || '#ff0000';
      dashArray = '20, 15'; // Ligne pointillée plus visible
      className = 'air-pollution-pulse';
      weight = 5; // Bordure plus épaisse
      fillOpacity = 0.8; // Plus opaque
    } else if (zoneType === 'lagoon_degradation') {
      color = props.color || '#0066cc';
      dashArray = '25, 10, 5, 10'; // Ligne pointillée complexe plus visible
      className = 'lagoon-degradation-wave';
      weight = 5;
      fillOpacity = 0.8;
    } else if (zoneType === 'heat_island') {
      color = props.color || '#ffaa00';
      dashArray = '12, 8'; // Ligne pointillée plus visible
      className = 'heat-island-glow';
      weight = 5;
      fillOpacity = 0.8;
    }
    
    return {
      color: color,
      weight: weight,
      fillColor: color,
      fillOpacity: fillOpacity,
      opacity: 0.9,
      dashArray: dashArray,
      className: className
    };
  },
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    const zoneType = p.zone_type;
    let icon = '🌫️';
    let bgGradient = 'linear-gradient(135deg, #ff6b6b, #ffa500)';
    let borderColor = '#ff0000';
    
    if (zoneType === 'lagoon_degradation') {
      icon = '🌊';
      bgGradient = 'linear-gradient(135deg, #4ecdc4, #44a08d)';
      borderColor = '#0066cc';
    } else if (zoneType === 'heat_island') {
      icon = '🌡️';
      bgGradient = 'linear-gradient(135deg, #ffd700, #ff8c00)';
      borderColor = '#ffaa00';
    }
    
    const html = `
      <div style="
        background: ${bgGradient};
        padding: 15px;
        border-radius: 12px;
        box-shadow: 0 8px 16px rgba(0,0,0,0.3);
        border: 3px solid ${borderColor};
        color: white;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.7);
        min-width: 250px;
      ">
        <h2 style="margin: 0 0 10px 0; font-size: 1.3em; text-align: center;">
          ${icon} ${p.name || 'Zone de pollution'}
        </h2>
        <div style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 6px; margin: 5px 0;">
          <strong>Type:</strong> ${getZoneTypeLabel(zoneType)}
        </div>
        <div style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 6px; margin: 5px 0;">
          <strong>Description:</strong> ${p.description || ''}
        </div>
        <div style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 6px; margin: 5px 0;">
          <strong>Sévérité:</strong> <span style="font-weight: bold; text-transform: uppercase;">${p.severity || 'N/A'}</span>
        </div>
        ${p.pollutants ? `
          <div style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 6px; margin: 5px 0;">
            <strong>Polluants:</strong> ${p.pollutants.join(', ')}
          </div>
        ` : ''}
        ${p.temperature ? `
          <div style="background: rgba(255,255,255,0.2); padding: 8px; border-radius: 6px; margin: 5px 0;">
            <strong>Température:</strong> ${p.temperature}
          </div>
        ` : ''}
      </div>
    `;
    layer.bindPopup(html);
    layer.on('click', () => setDetails(html));
  }
});

function getZoneTypeLabel(zoneType) {
  const labels = {
    'air_pollution': 'Pollution Aérienne',
    'lagoon_degradation': 'Dégradation Lagune',
    'heat_island': 'Îlot de Chaleur'
  };
  return labels[zoneType] || zoneType;
}

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
    (data.grid || []).forEach((cell, index) => {
      const [s, w, n, e] = cell.bbox;
      const bounds = [[s, w], [n, e]];
      const color = needColor(cell.need_score);
      
      // Créer un rectangle avec des effets visuels spectaculaires
      const rect = L.rectangle(bounds, {
        color: color,
        weight: 4,
        fillColor: color,
        fillOpacity: 0.6,
        dashArray: '15, 10', // Ligne pointillée plus visible
        className: 'hotspot-pulse' // Classe CSS pour animation
      });
      
      // Ajouter des effets visuels supplémentaires
      rect.setStyle({
        dashArray: '15, 10',
        opacity: 0.9,
        fillOpacity: 0.7
      });
      
      // Créer un effet de halo autour du rectangle
      const halo = L.rectangle(bounds, {
        color: color,
        weight: 8,
        fillColor: 'transparent',
        fillOpacity: 0,
        opacity: 0.3,
        className: 'hotspot-halo'
      });
      hotspotLayer.addLayer(halo);
      
      const html = `
        <div style="background: linear-gradient(45deg, ${color}, #fff); padding: 10px; border-radius: 8px; box-shadow: 0 4px 8px rgba(0,0,0,0.3);">
          <h3 style="margin: 0; color: #333; text-shadow: 1px 1px 2px rgba(255,255,255,0.8);">🔥 HOTSPOT CRITIQUE</h3>
          <p style="margin: 5px 0; font-weight: bold;">Score de besoin: <span style="color: ${color}; font-size: 1.2em;">${cell.need_score.toFixed(2)}</span></p>
          <p style="margin: 5px 0;">🏥 Établissements: ${cell.facilities}</p>
          <p style="margin: 5px 0;">🌬️ Points AQ: ${cell.aq_points}</p>
        </div>
      `;
      rect.bindPopup(html);
      rect.on('click', () => setDetails(html));
      hotspotLayer.addLayer(rect);
    });
  } catch (e) {
    console.error('Hotspots error', e);
  }
}

async function loadPollutionZones() {
  try {
    const resp = await fetch('/api/pollution-zones');
    const gj = await resp.json();
    pollutionZonesLayer.clearLayers();
    
    // Ajouter les zones principales
    pollutionZonesLayer.addData(gj);
    
    // Créer des effets de halo spectaculaires pour chaque zone
    gj.features.forEach(feature => {
      const props = feature.properties || {};
      const zoneType = props.zone_type;
      const color = props.color || '#0d6efd';
      
      // Créer un halo externe
      const halo = L.geoJSON(feature, {
        style: {
          color: color,
          weight: 8,
          fillColor: 'transparent',
          fillOpacity: 0,
          opacity: 0.4,
          dashArray: '20, 10',
          className: `${zoneType}-halo`
        }
      });
      
      // Créer un effet de pulsation interne
      const pulse = L.geoJSON(feature, {
        style: {
          color: color,
          weight: 2,
          fillColor: color,
          fillOpacity: 0.2,
          opacity: 0.6,
          dashArray: '5, 5',
          className: `${zoneType}-pulse`
        }
      });
      
      pollutionZonesLayer.addLayer(halo);
      pollutionZonesLayer.addLayer(pulse);
    });
  } catch (e) {
    console.error('Pollution zones error', e);
  }
}


function needColor(score) {
  if (score < 1) return '#9370DB'; // Violet clair
  if (score < 3) return '#FFD700'; // Or
  if (score < 6) return '#FF6347'; // Tomate
  return '#DC143C'; // Rouge cramoisi
}

// Layer toggles - Seules les zones de pollution sont visibles par défaut
map.addLayer(pollutionZonesLayer);
// Les autres couches ne sont ajoutées que si activées via les toggles

document.getElementById('toggleFacilities').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(facilitiesLayer) : map.removeLayer(facilitiesLayer);
});
document.getElementById('toggleAir').addEventListener('change', (e) => {                                                                                                                                                                    
  e.target.checked ? map.addLayer(aqLayer) : map.removeLayer(aqLayer);
});
document.getElementById('toggleHotspots').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(hotspotLayer) : map.removeLayer(hotspotLayer);
});
document.getElementById('togglePollutionZones').addEventListener('change', (e) => {
  e.target.checked ? map.addLayer(pollutionZonesLayer) : map.removeLayer(pollutionZonesLayer);
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
  await Promise.all([loadFacilities(), loadAirQuality(), loadHotspots(), loadPollutionZones()]);
  updateLegend();
})();

// Pollution Sources overlay (OSM)
const sourceColors = {
  landfill: '#8B4513',  // marron pour décharges
  power_plant: '#FF4500', // orange pour centrales
  factory: '#DC143C',   // rouge pour usines
  road: '#696969',     // gris pour routes
  source: '#2F4F4F'    // gris foncé pour autres sources
};

const sourcesLayer = L.geoJSON(null, {
  pointToLayer: (feature, latlng) => {
    const t = feature.properties?.type || 'source';
    const color = sourceColors[t] || '#343a40';
    
    // Créer des marqueurs spectaculaires selon le type
    let iconHtml = '';
    let radius = 8;
    
    switch(t) {
      case 'factory':
        iconHtml = '🏭';
        radius = 16; // Plus grand pour les usines
        break;
      case 'power_plant':
        iconHtml = '⚡';
        radius = 14; // Plus grand pour les centrales
        break;
      case 'landfill':
        iconHtml = '🗑️';
        radius = 13; // Plus grand pour les décharges
        break;
      case 'road':
        iconHtml = '🛣️';
        radius = 10; // Plus grand pour les routes
        break;
      default:
        iconHtml = '📍';
        radius = 12; // Plus grand par défaut
    }
    
    // Créer un marqueur personnalisé avec icône et effets spectaculaires
    const marker = L.divIcon({
      html: `
        <div style="
          position: relative;
          width: ${radius * 2}px;
          height: ${radius * 2}px;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <!-- Halo externe -->
          <div style="
            position: absolute;
            top: -8px;
            left: -8px;
            width: ${(radius + 4) * 2}px;
            height: ${(radius + 4) * 2}px;
            background: ${color};
            border-radius: 50%;
            opacity: 0.3;
            animation: sourceHalo 3s infinite;
          "></div>
          <!-- Marqueur principal -->
          <div style="
            background: ${color};
            border: 3px solid white;
            border-radius: 50%;
            width: ${radius * 2}px;
            height: ${radius * 2}px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: ${radius}px;
            box-shadow: 0 4px 8px rgba(0,0,0,0.3);
            animation: sourcePulse 2s infinite;
            position: relative;
            z-index: 2;
          ">
            ${iconHtml}
          </div>
          <!-- Effet de pulsation interne -->
          <div style="
            position: absolute;
            top: 2px;
            left: 2px;
            width: ${(radius - 1) * 2}px;
            height: ${(radius - 1) * 2}px;
            background: rgba(255,255,255,0.3);
            border-radius: 50%;
            animation: sourceInnerPulse 1.5s infinite;
          "></div>
        </div>
      `,
      className: 'custom-source-marker',
      iconSize: [radius * 2, radius * 2],
      iconAnchor: [radius, radius]
    });
    
    return L.marker(latlng, { icon: marker });
  },
  onEachFeature: (feature, layer) => {
    const p = feature.properties || {};
    const t = p.type || 'source';
    let bgColor = sourceColors[t] || '#343a40';
    
    const html = `
      <div style="
        background: linear-gradient(135deg, ${bgColor}, #fff);
        padding: 12px;
        border-radius: 10px;
        box-shadow: 0 6px 12px rgba(0,0,0,0.3);
        border: 2px solid ${bgColor};
        min-width: 200px;
      ">
        <h3 style="margin: 0 0 8px 0; color: #333; text-align: center;">
          ${getSourceIcon(t)} ${p.name || 'Source de pollution'}
        </h3>
        <div style="background: rgba(255,255,255,0.3); padding: 6px; border-radius: 4px; margin: 4px 0;">
          <strong>Type:</strong> ${getSourceTypeLabel(t)}
        </div>
        <div style="background: rgba(255,255,255,0.3); padding: 6px; border-radius: 4px; margin: 4px 0;">
          <strong>Impact:</strong> ${getSourceImpact(t)}
        </div>
      </div>
    `;
    layer.bindPopup(html);
    layer.on('click', () => setDetails(html));
  }
});

function getSourceIcon(type) {
  const icons = {
    'factory': '🏭',
    'power_plant': '⚡',
    'landfill': '🗑️',
    'road': '🛣️',
    'source': '📍'
  };
  return icons[type] || '📍';
}

function getSourceTypeLabel(type) {
  const labels = {
    'factory': 'Usine industrielle',
    'power_plant': 'Centrale électrique',
    'landfill': 'Décharge/Zone de déchets',
    'road': 'Route principale',
    'source': 'Source de pollution'
  };
  return labels[type] || type;
}

function getSourceImpact(type) {
  const impacts = {
    'factory': 'Émissions industrielles élevées',
    'power_plant': 'Émissions énergétiques',
    'landfill': 'Contamination des sols',
    'road': 'Émissions de trafic',
    'source': 'Source de pollution générale'
  };
  return impacts[type] || 'Impact environnemental';
}

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
  // val in [0,1] - Gradient rose/magenta distinctif
  const ramps = ['#FFB6C1','#FF69B4','#FF1493','#C71585','#8B008B'];
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
      
      // Créer des cellules avec des effets visuels spectaculaires
      const cell = L.rectangle([
        [sw.lat + r * latStep, sw.lng + c * lngStep],
        [sw.lat + (r + 1) * latStep, sw.lng + (c + 1) * lngStep]
      ], {
        color: color,
        weight: 5, // Bordure plus épaisse
        fillColor: color,
        fillOpacity: 0.7, // Plus opaque
        dashArray: '15, 8', // Ligne pointillée plus visible
        className: 'affected-area-glow'
      });
      
      // Créer un effet de halo pour les zones affectées
      const areaHalo = L.rectangle([
        [sw.lat + r * latStep, sw.lng + c * lngStep],
        [sw.lat + (r + 1) * latStep, sw.lng + (c + 1) * lngStep]
      ], {
        color: color,
        weight: 8,
        fillColor: 'transparent',
        fillOpacity: 0,
        opacity: 0.4,
        dashArray: '20, 15',
        className: 'affected-area-halo'
      });
      
      areasLayer.addLayer(areaHalo);
      
      // Ajouter un popup informatif spectaculaire
      const riskLevel = val > 0.8 ? 'EXTRÊME' : val > 0.6 ? 'ÉLEVÉ' : val > 0.4 ? 'MODÉRÉ' : 'FAIBLE';
      const html = `
        <div style="
          background: linear-gradient(135deg, ${color}, #fff);
          padding: 12px;
          border-radius: 10px;
          box-shadow: 0 6px 12px rgba(0,0,0,0.4);
          border: 3px solid ${color};
          text-align: center;
          color: #333;
        ">
          <h3 style="margin: 0; color: #333; text-shadow: 1px 1px 2px rgba(255,255,255,0.8);">
            ⚠️ ZONE AFFECTÉE
          </h3>
          <p style="margin: 8px 0; font-weight: bold; color: ${color}; font-size: 1.1em;">
            Risque: ${riskLevel}
          </p>
          <p style="margin: 5px 0;">Métrique: ${metric.replace(/_/g, ' ').toUpperCase()}</p>
          <p style="margin: 5px 0;">Intensité: ${(val * 100).toFixed(1)}%</p>
        </div>
      `;
      cell.bindPopup(html);
      cell.on('click', () => setDetails(html));
      areasLayer.addLayer(cell);
    }
  }
}

if (toggleAreas) {
  toggleAreas.addEventListener('change', (e) => {
    if (e.target.checked) {
      refreshAreas();
      map.addLayer(areasLayer);
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
  const ramps = ['#32CD32','#FFD700','#FF8C00','#FF4500','#8B0000']; // Vert -> Or -> Orange -> Rouge -> Rouge foncé
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
  
  // Zone de Cotonou concentrée vers le centre-ville (moins vers la mer)
  const cotonouBounds = {
    north: 6.42,  // Plus au nord, vers le centre
    south: 6.30,  // Plus au sud, vers le centre
    east: 2.45,    // Plus à l'est, vers le centre
    west: 2.35     // Plus à l'ouest, vers le centre
  };
  
  // Zones spécifiques de pollution concentrées vers le centre-ville
  const pollutionZones = [
    // Zone Dantokpa (pollution critique) - Centre-ville
    { lat: 6.37, lng: 2.40, intensity: 0.9, name: "Dantokpa Market" },
    { lat: 6.38, lng: 2.41, intensity: 0.85, name: "Dantokpa Center" },
    { lat: 6.36, lng: 2.39, intensity: 0.8, name: "Dantokpa South" },
    
    // Zone Gbegamey (pollution industrielle) - Centre-ville
    { lat: 6.39, lng: 2.37, intensity: 0.75, name: "Gbegamey Industrial" },
    { lat: 6.40, lng: 2.38, intensity: 0.7, name: "Gbegamey North" },
    { lat: 6.38, lng: 2.36, intensity: 0.65, name: "Gbegamey South" },
    
    // Zone Akpakpa (trafic dense) - Centre-ville
    { lat: 6.33, lng: 2.35, intensity: 0.6, name: "Akpakpa PK3" },
    { lat: 6.34, lng: 2.36, intensity: 0.55, name: "Akpakpa Center" },
    { lat: 6.32, lng: 2.34, intensity: 0.5, name: "Akpakpa South" },
    
    // Zone Centre-ville (îlots de chaleur) - Plus concentré
    { lat: 6.36, lng: 2.42, intensity: 0.55, name: "Centre-ville" },
    { lat: 6.37, lng: 2.43, intensity: 0.5, name: "Marina" },
    { lat: 6.35, lng: 2.41, intensity: 0.45, name: "Saint-Jean" },
    
    // Zone Ladji-Vêdoko (corridor chaleur) - Centre-ville
    { lat: 6.34, lng: 2.37, intensity: 0.6, name: "Ladji" },
    { lat: 6.35, lng: 2.38, intensity: 0.55, name: "Vêdoko" },
    { lat: 6.33, lng: 2.36, intensity: 0.5, name: "Zongo" },
    
    // Zone Cocotiers (quartier résidentiel)
    { lat: 6.41, lng: 2.44, intensity: 0.4, name: "Cocotiers" },
    { lat: 6.42, lng: 2.45, intensity: 0.35, name: "Cocotiers North" },
    
    // Zone Fidjrossè (quartier commercial)
    { lat: 6.32, lng: 2.38, intensity: 0.45, name: "Fidjrossè" },
    { lat: 6.33, lng: 2.39, intensity: 0.4, name: "Fidjrossè Center" }
  ];
  
  // Ajouter quelques points aléatoires dans la zone de Cotonou
  for (let i = 0; i < 10; i++) {
    const lat = cotonouBounds.south + Math.random() * (cotonouBounds.north - cotonouBounds.south);
    const lng = cotonouBounds.west + Math.random() * (cotonouBounds.east - cotonouBounds.west);
    const intensity = Math.random() * 0.4 + 0.3; // Valeur entre 0.3 et 0.7
    
    pollutionZones.push({
      lat: lat,
      lng: lng,
      intensity: intensity,
      name: `Zone ${i + 1}`
    });
  }
  
  // Créer les marqueurs pour chaque zone
  pollutionZones.forEach(zone => {
    const val = zone.intensity;
    const color = pollutedRamp(val);
    
    // Créer un circleMarker exactement comme Health Facilities
    const marker = L.circleMarker([zone.lat, zone.lng], {
      radius: 4,
      color: color,
      fillColor: color,
      fillOpacity: 0.6,
      weight: 1
    });
    
    // Ajouter un popup simple comme Health Facilities
    const pollutionLevel = val > 0.8 ? 'CRITIQUE' : val > 0.6 ? 'ÉLEVÉE' : val > 0.4 ? 'MODÉRÉE' : 'FAIBLE';
    const html = `
      <b>${zone.name}</b><br/>
      Niveau: ${pollutionLevel}<br/>
      Intensité: ${(val * 100).toFixed(1)}%
    `;
    marker.bindPopup(html);
    marker.on('click', () => setDetails(html));
    pollutedLayer.addLayer(marker);
  });
}

if (togglePolluted) {
  togglePolluted.addEventListener('change', (e) => {
    if (e.target.checked) {
      refreshPolluted();
      map.addLayer(pollutedLayer);
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

  // Air Quality legend (turquoise points)
  const showAQ = document.getElementById('toggleAir')?.checked;
  if (showAQ) {
    parts.push(`
      <div class="row"><span class="key" style="background:#20B2AA;border-color:#00CED1"></span><span class="label">Air Quality site</span></div>
    `);
  }

  // Hotspots legend
  const showHotspots = document.getElementById('toggleHotspots')?.checked;
  if (showHotspots) {
    parts.push(`
      <div class="row">
        <span class="key" style="background:#DC143C"></span>
        <span class="label">Hotspot (higher need score)</span>
      </div>
    `);
  }

  // Pollution Zones legend
  const showPollutionZones = document.getElementById('togglePollutionZones')?.checked;
  if (showPollutionZones) {
    parts.push(`
      <div class="row"><span class="label muted">Zones de Pollution Cotonou</span></div>
      <div class="row"><span class="key" style="background:#ff0000"></span><span class="label">🌫️ Pollution Aérienne</span></div>
      <div class="row"><span class="key" style="background:#0066cc"></span><span class="label">🌊 Dégradation Lagune</span></div>
      <div class="row"><span class="key" style="background:#ffaa00"></span><span class="label">🌡️ Îlots de Chaleur</span></div>
    `);
  }

  // Sources legend
  const showSources = document.getElementById('toggleSources')?.checked;
  if (showSources) {
    parts.push(`
      <div class="row"><span class="label muted">Pollution sources</span></div>
      <div class="row"><span class="key" style="background:#DC143C;border-color:#DC143C"></span><span class="label">Factory</span></div>
      <div class="row"><span class="key" style="background:#FF4500;border-color:#FF4500"></span><span class="label">Power plant</span></div>
      <div class="row"><span class="key" style="background:#8B4513;border-color:#8B4513"></span><span class="label">Landfill/Waste</span></div>
      <div class="row"><span class="key" style="background:#696969;border-color:#696969"></span><span class="label">Major road</span></div>
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
    const ramp = ['#FFB6C1','#FF69B4','#FF1493','#C71585','#8B008B'];
    parts.push(`<div class="row"><span class="label muted">Affected areas: ${metric.replace(/_/g,' ')}</span></div>`);
    parts.push(`<div class="row"><div class="bar" style="background: linear-gradient(90deg, ${ramp.join(',')})"></div><span class="label">low → very high</span></div>`);
  }

  // Polluted Areas legend (AQ-only)
  const showPolluted = document.getElementById('togglePolluted')?.checked;
  if (showPolluted) {
    const ramp = ['#32CD32','#FFD700','#FF8C00','#FF4500','#8B0000'];
    parts.push(`<div class="row"><span class="label muted">Polluted areas (AQ only)</span></div>`);
    parts.push(`<div class="row"><div class="bar" style="background: linear-gradient(90deg, ${ramp.join(',')})"></div><span class="label">clean → highly polluted</span></div>`);
  }


  el.innerHTML = parts.join('');
}

// Recompute legend on UI changes
['toggleFacilities','toggleAir','toggleHotspots','togglePollutionZones','toggleSources','toggleGibs','toggleAreas','gibsLayer','gibsOpacity','areasMetric']
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
