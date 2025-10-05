import os
from typing import List, Dict, Any

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import httpx

# App setup
app = FastAPI(title="Benin Littoral Public Health Dashboard (Python)")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static frontend from ../public
PUBLIC_DIR = os.path.join(os.path.dirname(__file__), "..", "public")
app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="static")

# City config (Cotonou, Littoral, Benin)
CITY = {
    "name": "Cotonou, Littoral, Benin",
    "lat": 6.3703,
    "lon": 2.3912,
    # bbox [south, west, north, east]
    "bbox": [6.32, 2.33, 6.45, 2.52],
}


@app.get("/api/health-facilities")
async def health_facilities() -> Dict[str, Any]:
    s, w, n, e = CITY["bbox"]
    amenities = [
        "hospital",
        "clinic",
        "doctors",
        "pharmacy",
        "dentist",
        "health_post",
    ]
    query = f"""
    [out:json][timeout:25];
    (
      node["amenity"~"{'|'.join(amenities)}"]({s},{w},{n},{e});
      way["amenity"~"{'|'.join(amenities)}"]({s},{w},{n},{e});
      relation["amenity"~"{'|'.join(amenities)}"]({s},{w},{n},{e});
    );
    out center tags;
    """
    url = "https://overpass-api.de/api/interpreter"
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, data={"data": query}, headers={"Content-Type": "application/x-www-form-urlencoded"})
            resp.raise_for_status()
            data = resp.json()
    except Exception:
        # Graceful empty
        return {"type": "FeatureCollection", "features": []}

    features: List[Dict[str, Any]] = []
    for el in data.get("elements", []):
        if el.get("type") == "node":
            coords = [el.get("lon"), el.get("lat")]
        else:
            center = el.get("center") or {}
            coords = [center.get("lon"), center.get("lat")] if center else None
        if not coords or coords[0] is None or coords[1] is None:
            continue
        tags = el.get("tags", {})
        name = tags.get("name") or tags.get("official_name") or "Unknown"
        amenity = tags.get("amenity", "unknown")
        phone = tags.get("phone") or tags.get("contact:phone")
        address_parts = [tags.get("addr:housenumber"), tags.get("addr:street"), tags.get("addr:city")]
        address = " ".join([p for p in address_parts if p])
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": coords},
            "properties": {
                "id": f"{el.get('type')}/{el.get('id')}",
                "name": name,
                "amenity": amenity,
                "phone": phone,
                "address": address,
            },
        })

    return {"type": "FeatureCollection", "features": features}


@app.get("/api/air-quality")
async def air_quality(request: Request, lat: float | None = None, lon: float | None = None, radius: int = 20000, limit: int = 100) -> Dict[str, Any]:
    # Defaults
    lat = lat or CITY["lat"]
    lon = lon or CITY["lon"]

    params = {
        "coordinates": f"{lat},{lon}",
        "radius": str(radius),
        "limit": str(limit),
        "sort": "desc",
        "order_by": "datetime",
        "parameter": ",".join(["pm25", "pm10", "no2", "o3", "so2", "co"]),
    }

    async with httpx.AsyncClient(timeout=30) as client:
        # Try measurements first
        url_measure = "https://api.openaq.org/v2/measurements"
        try:
            resp = await client.get(url_measure, params=params)
            if resp.status_code == 200:
                data = resp.json()
                features = []
                for m in data.get("results", []):
                    coords = m.get("coordinates")
                    if not coords:
                        continue
                    features.append({
                        "type": "Feature",
                        "geometry": {"type": "Point", "coordinates": [coords.get("longitude"), coords.get("latitude")]},
                        "properties": {
                            "parameter": m.get("parameter"),
                            "value": m.get("value"),
                            "unit": m.get("unit"),
                            "datetime": (m.get("date") or {}).get("utc") or (m.get("date") or {}).get("local"),
                            "location": m.get("location"),
                            "country": m.get("country"),
                            "city": m.get("city"),
                        },
                    })
                return {"type": "FeatureCollection", "features": features}
        except Exception:
            pass

        # Fallback: latest
        try:
            url_latest = "https://api.openaq.org/v2/latest"
            resp = await client.get(url_latest, params=params)
            if resp.status_code == 200:
                data = resp.json()
                features = []
                for loc in data.get("results", []):
                    coords = loc.get("coordinates")
                    if not coords:
                        continue
                    for m in loc.get("measurements", []):
                        features.append({
                            "type": "Feature",
                            "geometry": {"type": "Point", "coordinates": [coords.get("longitude"), coords.get("latitude")]},
                            "properties": {
                                "parameter": m.get("parameter"),
                                "value": m.get("value"),
                                "unit": m.get("unit"),
                                "datetime": m.get("lastUpdated") or (m.get("date") or {}).get("utc") or (m.get("date") or {}).get("local"),
                                "location": loc.get("location"),
                                "country": loc.get("country"),
                                "city": loc.get("city"),
                            },
                        })
                return {"type": "FeatureCollection", "features": features}
        except Exception:
            pass

    # Graceful empty on failure
    return {"type": "FeatureCollection", "features": []}


@app.get("/api/hotspots")
async def hotspots(request: Request) -> Dict[str, Any]:
    # Build a simple grid and count facilities and AQ points
    s, w, n, e = CITY["bbox"]
    rows, cols = 6, 6
    cell_h = (n - s) / rows
    cell_w = (e - w) / cols

    async with httpx.AsyncClient(timeout=60) as client:
        base = str(request.base_url).rstrip("/")
        fac_url = f"{base}/api/health-facilities"
        aq_url = f"{base}/api/air-quality?limit=200"
        try:
            fac_resp, aq_resp = await client.get(fac_url), await client.get(aq_url)
            facilities = fac_resp.json() if fac_resp.status_code == 200 else {"features": []}
            air = aq_resp.json() if aq_resp.status_code == 200 else {"features": []}
        except Exception:
            facilities, air = {"features": []}, {"features": []}

    fac_features = facilities.get("features") or []
    air_features = air.get("features") or []

    grid = []
    for r in range(rows):
        for c in range(cols):
            grid.append({
                "id": f"{r}-{c}",
                "bbox": [s + r * cell_h, w + c * cell_w, s + (r + 1) * cell_h, w + (c + 1) * cell_w],
                "facilities": 0,
                "aq_points": 0,
            })

    def in_cell(lat: float, lon: float, cell: Dict[str, Any]) -> bool:
        cb = cell["bbox"]
        return (lat >= cb[0]) and (lat < cb[2]) and (lon >= cb[1]) and (lon < cb[3])

    for f in fac_features:
        coords = (f.get("geometry") or {}).get("coordinates") or []
        if len(coords) != 2:
            continue
        lon, lat = coords
        for cell in grid:
            if in_cell(lat, lon, cell):
                cell["facilities"] += 1

    for f in air_features:
        coords = (f.get("geometry") or {}).get("coordinates") or []
        if len(coords) != 2:
            continue
        lon, lat = coords
        for cell in grid:
            if in_cell(lat, lon, cell):
                cell["aq_points"] += 1

    scores = [
        {
            "id": cell["id"],
            "bbox": cell["bbox"],
            "facilities": cell["facilities"],
            "aq_points": cell["aq_points"],
            "need_score": (cell["aq_points"] or 0) - 0.5 * (cell["facilities"] or 0),
        }
        for cell in grid
    ]

    scores.sort(key=lambda x: x["need_score"], reverse=True)
    return {"grid": scores[:10]}


@app.get("/api/pollution-zones")
async def pollution_zones() -> Dict[str, Any]:
    """
    Retourne les zones de pollution spécifiques à Cotonou basées sur les données réelles
    """
    # Zones de pollution aérienne (rouge) - basées sur les données du plan de projet
    air_pollution_zones = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [2.36, 6.36], [2.42, 6.36], [2.42, 6.42], [2.36, 6.42], [2.36, 6.36]
                ]]
            },
            "properties": {
                "zone_type": "air_pollution",
                "name": "Dantokpa Market Area",
                "description": "Zone critique de pollution NO₂ - Pic de 125 µmol/m² au carrefour Dantokpa",
                "severity": "high",
                "pollutants": ["NO₂", "PM2.5", "PM10"],
                "color": "#ff0000"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [2.38, 6.32], [2.45, 6.32], [2.45, 6.38], [2.38, 6.38], [2.38, 6.32]
                ]]
            },
            "properties": {
                "zone_type": "air_pollution",
                "name": "Gbegamey Industrial Corridor",
                "description": "Corridor industriel avec émissions élevées - Zone industrielle de Godomey",
                "severity": "medium",
                "pollutants": ["SO₂", "NO₂", "PM2.5"],
                "color": "#ff4444"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [2.30, 6.30], [2.36, 6.30], [2.36, 6.36], [2.30, 6.36], [2.30, 6.30]
                ]]
            },
            "properties": {
                "zone_type": "air_pollution",
                "name": "Akpakpa Traffic Zone",
                "description": "Zone de forte densité de trafic - Carrefours Akpakpa PK3 et Vêdoko Cica-Toyota",
                "severity": "medium",
                "pollutants": ["NO₂", "CO", "PM2.5"],
                "color": "#ff6666"
            }
        }
    ]
    
    # Zones de dégradation de la lagune (bleu)
    lagoon_degradation_zones = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [2.40, 6.28], [2.50, 6.28], [2.50, 6.35], [2.40, 6.35], [2.40, 6.28]
                ]]
            },
            "properties": {
                "zone_type": "lagoon_degradation",
                "name": "Cotonou Canal Mouth",
                "description": "Eutrophisation détectée - Concentration élevée de chlorophylle-a à l'embouchure du canal",
                "severity": "high",
                "pollutants": ["Chlorophylle-a", "Nutriments organiques"],
                "color": "#0066cc"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [2.33, 6.30], [2.40, 6.30], [2.40, 6.35], [2.33, 6.35], [2.33, 6.30]
                ]]
            },
            "properties": {
                "zone_type": "lagoon_degradation",
                "name": "Lagoon Central Area",
                "description": "Zone de dégradation de la lagune - Rejets organiques et activités portuaires",
                "severity": "medium",
                "pollutants": ["Matières organiques", "Bactéries", "Hydrocarbures"],
                "color": "#3399ff"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [2.25, 6.25], [2.33, 6.25], [2.33, 6.32], [2.25, 6.32], [2.25, 6.25]
                ]]
            },
            "properties": {
                "zone_type": "lagoon_degradation",
                "name": "Port de Cotonou Area",
                "description": "Zone portuaire avec émissions polluantes affectant la qualité de l'eau",
                "severity": "high",
                "pollutants": ["Hydrocarbures", "Métaux lourds", "Sédiments"],
                "color": "#004499"
            }
        }
    ]
    
    # Îlots de chaleur urbains (jaune)
    heat_island_zones = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [2.35, 6.38], [2.42, 6.38], [2.42, 6.45], [2.35, 6.45], [2.35, 6.38]
                ]]
            },
            "properties": {
                "zone_type": "heat_island",
                "name": "Gbegamey Heat Island",
                "description": "Îlot de chaleur critique - 38°C vs 29°C (9°C d'écart) - Quartier dense minéralisé",
                "severity": "high",
                "temperature": "38°C",
                "color": "#ffaa00"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [2.42, 6.35], [2.48, 6.35], [2.48, 6.42], [2.42, 6.42], [2.42, 6.35]
                ]]
            },
            "properties": {
                "zone_type": "heat_island",
                "name": "Saint-Jean Heat Island",
                "description": "Zone minéralisée avec îlot de chaleur - Quartiers Saint-Jean et Zongo",
                "severity": "medium",
                "temperature": "35°C",
                "color": "#ffcc44"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [2.30, 6.32], [2.38, 6.32], [2.38, 6.38], [2.30, 6.38], [2.30, 6.32]
                ]]
            },
            "properties": {
                "zone_type": "heat_island",
                "name": "Ladji-Vêdoko Heat Corridor",
                "description": "Corridor d'îlot de chaleur - Corrélation r=0.78 avec urbanisation dense",
                "severity": "high",
                "temperature": "36°C",
                "color": "#ff8800"
            }
        },
        {
            "type": "Feature",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [2.25, 6.28], [2.35, 6.28], [2.35, 6.35], [2.25, 6.35], [2.25, 6.28]
                ]]
            },
            "properties": {
                "zone_type": "heat_island",
                "name": "Centre-ville Heat Zone",
                "description": "Zone fortement urbanisée du centre-ville avec peu de végétation",
                "severity": "medium",
                "temperature": "34°C",
                "color": "#ffdd66"
            }
        }
    ]
    
    # Combiner toutes les zones
    all_zones = air_pollution_zones + lagoon_degradation_zones + heat_island_zones
    
    return {
        "type": "FeatureCollection",
        "features": all_zones,
        "metadata": {
            "total_zones": len(all_zones),
            "air_pollution": len(air_pollution_zones),
            "lagoon_degradation": len(lagoon_degradation_zones),
            "heat_islands": len(heat_island_zones)
        }
    }
