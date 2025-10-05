# data/views.py
import requests
from typing import List, Dict, Any
from django.shortcuts import render
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import permissions
from rest_framework.permissions import AllowAny


# Configuration par défaut (tu peux étendre la liste côté frontend aussi)
CITY_PRESETS = {
    "Cotonou": {"lat": 6.3703, "lon": 2.3912, "bbox": [6.32, 2.33, 6.45, 2.52], "zoom": 12},
    "Dakar": {"lat": 14.6928, "lon": -17.4467, "bbox": [-17.5, 14.6, -17.2, 14.9], "zoom": 11},
    "Lomé": {"lat": 6.1725, "lon": 1.2314, "bbox": [6.09, 1.18, 6.23, 1.35], "zoom": 12},
    "Paris": {"lat": 48.8566, "lon": 2.3522, "bbox": [48.80, 2.25, 48.92, 2.45], "zoom": 12},
    "New York": {"lat": 40.7128, "lon": -74.0060, "bbox": [40.55, -74.25, 40.90, -73.70], "zoom": 11},
    "Mumbai": {"lat": 19.0760, "lon": 72.8777, "bbox": [18.90, 72.75, 19.20, 73.00], "zoom": 12},
    "Beijing": {"lat": 39.9042, "lon": 116.4074, "bbox": [39.80, 116.20, 40.00, 116.60], "zoom": 11},
    "Cairo": {"lat": 30.0444, "lon": 31.2357, "bbox": [29.90, 31.00, 30.20, 31.40], "zoom": 11},
    "London": {"lat": 51.5074, "lon": -0.1278, "bbox": [51.40, -0.20, 51.60, 0.10], "zoom": 11},
    "Tokyo": {"lat": 35.6895, "lon": 139.6917, "bbox": [35.50, 139.50, 35.80, 139.90], "zoom": 11},
    "São Paulo": {"lat": -23.5505, "lon": -46.6333, "bbox": [-23.70, -46.80, -23.40, -46.50], "zoom": 11},
    "Mexico City": {"lat": 19.4326, "lon": -99.1332, "bbox": [19.20, -99.30, 19.70, -98.90], "zoom": 11},
    "Istanbul": {"lat": 41.0082, "lon": 28.9784, "bbox": [40.90, 28.80, 41.10, 29.20], "zoom": 11},
    "Moscow": {"lat": 55.7558, "lon": 37.6173, "bbox": [55.60, 37.40, 55.90, 37.80], "zoom": 11},
    "Jakarta": {"lat": -6.2088, "lon": 106.8456, "bbox": [-6.40, 106.60, -6.00, 107.00], "zoom": 11},
}

OVERPASS_URL = "https://overpass-api.de/api/interpreter"
OPENAQ_MEASUREMENTS = "https://api.openaq.org/v2/measurements"
OPENAQ_LATEST = "https://api.openaq.org/v2/latest"

# -------------------------
# Helpers
# -------------------------
def query_overpass(bbox: List[float], amenities: List[str]) -> List[Dict[str, Any]]:
    s, w, n, e = bbox  # s,w,n,e
    q = f"""
    [out:json][timeout:25];
    (
      node["amenity"~"{'|'.join(amenities)}"]({s},{w},{n},{e});
      way["amenity"~"{'|'.join(amenities)}"]({s},{w},{n},{e});
      relation["amenity"~"{'|'.join(amenities)}"]({s},{w},{n},{e});
    );
    out center tags;
    """
    try:
        r = requests.post(OVERPASS_URL, data={"data": q}, headers={"Content-Type": "application/x-www-form-urlencoded"}, timeout=25)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return []

    features = []
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
            }
        })
    return features


def query_openaq(lat: float, lon: float, radius: int = 20000, limit: int = 200) -> List[Dict[str, Any]]:
    params = {
        "coordinates": f"{lat},{lon}",
        "radius": str(radius),
        "limit": str(limit),
        "sort": "desc",
        "order_by": "datetime",
        "parameter": ",".join(["pm25", "pm10", "no2", "o3", "so2", "co"])
    }

    try:
        r = requests.get(OPENAQ_MEASUREMENTS, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        features = []
        for m in data.get("results", []):
            coords = m.get("coordinates") or {}
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
                }
            })
        if features:
            return features
    except Exception:
        pass

    # fallback -> latest
    try:
        r = requests.get(OPENAQ_LATEST, params=params, timeout=15)
        r.raise_for_status()
        data = r.json()
        features = []
        for loc in data.get("results", []):
            coords = loc.get("coordinates") or {}
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
                    }
                })
        return features
    except Exception:
        return []


# -------------------------
# API endpoints
# -------------------------

def visualization_view(request):
    """
    Page interactive: /api/vis/
    """
    # pass initial city presets to template (JS will use)
    return render(request, "visualization.html", context={"cities": CITY_PRESETS})
