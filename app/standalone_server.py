#!/usr/bin/env python3
import json
import os
import re
import sys
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

# Paths
ROOT_DIR = os.path.dirname(os.path.dirname(__file__))
PUBLIC_DIR = os.path.join(ROOT_DIR, 'public')

# City config (Cotonou, Littoral, Benin)
CITY = {
    'name': 'Cotonou, Littoral, Benin',
    'lat': 6.3703,
    'lon': 2.3912,
    # bbox [south, west, north, east]
    'bbox': [6.32, 2.33, 6.45, 2.52],
}


def fetch_json(url: str, method: str = 'GET', data: bytes | None = None, headers: dict | None = None, timeout: int = 30):
    req = Request(url, data=data, method=method)
    if headers:
        for k, v in headers.items():
            req.add_header(k, v)
    try:
        with urlopen(req, timeout=timeout) as resp:
            charset = resp.headers.get_content_charset() or 'utf-8'
            body = resp.read().decode(charset, errors='replace')
            return json.loads(body), resp.status
    except HTTPError as e:
        return None, e.code
    except URLError:
        return None, 0
    except Exception:
        return None, 0


def json_response(handler: BaseHTTPRequestHandler, obj: dict, status: int = 200):
    payload = json.dumps(obj).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Access-Control-Allow-Origin', '*')
    handler.send_header('Content-Length', str(len(payload)))
    handler.end_headers()
    handler.wfile.write(payload)


def serve_file(handler: BaseHTTPRequestHandler, rel_path: str):
    # Prevent path traversal
    safe_path = os.path.normpath(rel_path).lstrip(os.sep)
    target = os.path.join(PUBLIC_DIR, safe_path)
    if os.path.isdir(target):
        target = os.path.join(target, 'index.html')
    if not os.path.exists(target):
        handler.send_error(404)
        return
    # Basic content type
    if target.endswith('.html'):
        ctype = 'text/html; charset=utf-8'
    elif target.endswith('.css'):
        ctype = 'text/css; charset=utf-8'
    elif target.endswith('.js'):
        ctype = 'application/javascript; charset=utf-8'
    elif target.endswith('.png'):
        ctype = 'image/png'
    elif target.endswith('.jpg') or target.endswith('.jpeg'):
        ctype = 'image/jpeg'
    elif target.endswith('.svg'):
        ctype = 'image/svg+xml'
    else:
        ctype = 'application/octet-stream'
    with open(target, 'rb') as f:
        data = f.read()
    handler.send_response(200)
    handler.send_header('Content-Type', ctype)
    handler.send_header('Content-Length', str(len(data)))
    handler.end_headers()
    handler.wfile.write(data)


class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        # CORS preflight
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        path = parsed.path
        qs = parse_qs(parsed.query)

        if path == '/':
            return serve_file(self, 'index.html')
        if path.startswith('/public/'):
            rel = path[len('/public/'):]
            return serve_file(self, rel)
        if path in ('/styles.css', '/app.js', '/index.html'):
            # support direct root paths for our static
            rel = path.lstrip('/')
            return serve_file(self, rel)
        if path == '/__mtime':
            return self.handle_public_mtime()

        if path == '/api/health-facilities':
            return self.handle_health_facilities()
        if path == '/api/air-quality':
            return self.handle_air_quality(qs)
        if path == '/api/hotspots':
            return self.handle_hotspots()
        if path == '/api/sources':
            return self.handle_sources(qs)
        # NASA GIBS proxy: /api/gibs/<layer>/<time>/<z>/<y>/<x>.jpg
        m = re.match(r"^/api/gibs/([A-Za-z0-9_\-]+)/([0-9]{4}-[0-9]{2}-[0-9]{2})/(\d+)/(\d+)/(\d+)\.jpg$", path)
        if m:
            layer_key, time_str, z, y, x = m.groups()
            return self.handle_gibs_tile(layer_key, time_str, z, y, x)

        # Not found
        self.send_error(404)

    def handle_health_facilities(self):
        s, w, n, e = CITY['bbox']
        amenities = ['hospital', 'clinic', 'doctors', 'pharmacy', 'dentist', 'health_post']
        regex = '|'.join(amenities)
        query = f'''
[out:json][timeout:25];
(
  node["amenity"~"{regex}"]({s},{w},{n},{e});
  way["amenity"~"{regex}"]({s},{w},{n},{e});
  relation["amenity"~"{regex}"]({s},{w},{n},{e});
);
out center tags;
'''
        data, status = fetch_json(
            'https://overpass-api.de/api/interpreter',
            method='POST',
            data=('data=' + re.sub(r'\s+', ' ', query).strip()).encode('utf-8'),
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        if not data or status != 200:
            return json_response(self, {"type": "FeatureCollection", "features": []})

        features = []
        for el in data.get('elements', []):
            if el.get('type') == 'node':
                coords = [el.get('lon'), el.get('lat')]
            else:
                center = el.get('center') or {}
                coords = [center.get('lon'), center.get('lat')] if center else None
            if not coords or coords[0] is None or coords[1] is None:
                continue
            tags = el.get('tags', {})
            name = tags.get('name') or tags.get('official_name') or 'Unknown'
            amenity = tags.get('amenity', 'unknown')
            phone = tags.get('phone') or tags.get('contact:phone')
            address_parts = [tags.get('addr:housenumber'), tags.get('addr:street'), tags.get('addr:city')]
            address = ' '.join([p for p in address_parts if p])
            features.append({
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': coords},
                'properties': {
                    'id': f"{el.get('type')}/{el.get('id')}",
                    'name': name,
                    'amenity': amenity,
                    'phone': phone,
                    'address': address,
                }
            })
        return json_response(self, {"type": "FeatureCollection", "features": features})

    def handle_air_quality(self, qs):
        lat = float(qs.get('lat', [CITY['lat']])[0])
        lon = float(qs.get('lon', [CITY['lon']])[0])
        radius = int(qs.get('radius', [20000])[0])
        limit = int(qs.get('limit', [100])[0])
        params = (
            f"coordinates={lat},{lon}&radius={radius}&limit={limit}&sort=desc&order_by=datetime&"
            f"parameter={'pm25,pm10,no2,o3,so2,co'}"
        )
        # Try measurements
        url_measure = f"https://api.openaq.org/v2/measurements?{params}"
        data, status = fetch_json(url_measure)
        features = []
        if data and status == 200:
            for m in data.get('results', []):
                coords = m.get('coordinates')
                if not coords:
                    continue
                features.append({
                    'type': 'Feature',
                    'geometry': {'type': 'Point', 'coordinates': [coords.get('longitude'), coords.get('latitude')]},
                    'properties': {
                        'parameter': m.get('parameter'),
                        'value': m.get('value'),
                        'unit': m.get('unit'),
                        'datetime': (m.get('date') or {}).get('utc') or (m.get('date') or {}).get('local'),
                        'location': m.get('location'),
                        'country': m.get('country'),
                        'city': m.get('city'),
                    }
                })
        else:
            # Fallback latest
            url_latest = f"https://api.openaq.org/v2/latest?{params}"
            data2, status2 = fetch_json(url_latest)
            if data2 and status2 == 200:
                for loc in data2.get('results', []):
                    coords = loc.get('coordinates')
                    if not coords:
                        continue
                    for m in loc.get('measurements', []):
                        features.append({
                            'type': 'Feature',
                            'geometry': {'type': 'Point', 'coordinates': [coords.get('longitude'), coords.get('latitude')]},
                            'properties': {
                                'parameter': m.get('parameter'),
                                'value': m.get('value'),
                                'unit': m.get('unit'),
                                'datetime': m.get('lastUpdated') or (m.get('date') or {}).get('utc') or (m.get('date') or {}).get('local'),
                                'location': loc.get('location'),
                                'country': loc.get('country'),
                                'city': loc.get('city'),
                            }
                        })
        return json_response(self, {"type": "FeatureCollection", "features": features})

    def handle_hotspots(self):
        s, w, n, e = CITY['bbox']
        rows, cols = 6, 6
        cell_h = (n - s) / rows
        cell_w = (e - w) / cols

        # Fetch facilities and air in-process
        fac_data, _ = fetch_json('http://localhost:3000/api/health-facilities')
        aq_data, _ = fetch_json('http://localhost:3000/api/air-quality?limit=200')
        fac_features = (fac_data or {}).get('features') or []
        air_features = (aq_data or {}).get('features') or []

        grid = []
        for r in range(rows):
            for c in range(cols):
                grid.append({
                    'id': f'{r}-{c}',
                    'bbox': [s + r * cell_h, w + c * cell_w, s + (r + 1) * cell_h, w + (c + 1) * cell_w],
                    'facilities': 0,
                    'aq_points': 0,
                })

        def in_cell(lat: float, lon: float, cell: dict) -> bool:
            cb = cell['bbox']
            return (lat >= cb[0]) and (lat < cb[2]) and (lon >= cb[1]) and (lon < cb[3])

        for f in fac_features:
            coords = (f.get('geometry') or {}).get('coordinates') or []
            if len(coords) != 2:
                continue
            lon, lat = coords
            for cell in grid:
                if in_cell(lat, lon, cell):
                    cell['facilities'] += 1

        for f in air_features:
            coords = (f.get('geometry') or {}).get('coordinates') or []
            if len(coords) != 2:
                continue
            lon, lat = coords
            for cell in grid:
                if in_cell(lat, lon, cell):
                    cell['aq_points'] += 1

        scores = [
            {
                'id': cell['id'],
                'bbox': cell['bbox'],
                'facilities': cell['facilities'],
                'aq_points': cell['aq_points'],
                'need_score': (cell['aq_points'] or 0) - 0.5 * (cell['facilities'] or 0),
            }
            for cell in grid
        ]
        scores.sort(key=lambda x: x['need_score'], reverse=True)
        return json_response(self, {'grid': scores[:10]})

    def handle_public_mtime(self):
        latest = 0.0
        for root, _, files in os.walk(PUBLIC_DIR):
            for f in files:
                try:
                    p = os.path.join(root, f)
                    m = os.path.getmtime(p)
                    if m > latest:
                        latest = m
                except Exception:
                    pass
        return json_response(self, {"t": latest})

    # Silence default logging
    def log_message(self, format, *args):
        sys.stdout.write("%s - - [%s] " % (self.client_address[0], self.log_date_time_string()))
        sys.stdout.write((format % args) + "\n")

    def handle_gibs_tile(self, layer_key: str, time_str: str, z: str, y: str, x: str):
        # Allowed layers map to GIBS layer IDs and tile matrix set
        layers = {
            # Night lights
            'VIIRS_DNB': ('VIIRS_SNPP_DayNightBand_At_Sensor_Radiance', 'GoogleMapsCompatible_Level9'),
            # Sentinel-5P TROPOMI NO2 daily
            'S5P_NO2': ('S5P_NO2_TROPOMI', 'GoogleMapsCompatible_Level3'),
            # MAIAC AOD (MODIS Terra+Aqua)
            'MAIAC_AOD': ('MODIS_Terra_Aqua_Aerosol', 'GoogleMapsCompatible_Level9'),
            # MODIS True Color (for context)
            'MODIS_TrueColor': ('MODIS_Terra_CorrectedReflectance_TrueColor', 'GoogleMapsCompatible_Level9'),
        }
        if layer_key not in layers:
            self.send_error(400, 'Unsupported layer')
            return
        layer_id, matrix = layers[layer_key]
        gibs_url = (
            "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/"
            f"{layer_id}/default/{time_str}/{matrix}/{z}/{y}/{x}.jpg"
        )
        try:
            req = Request(gibs_url, method='GET')
            with urlopen(req, timeout=30) as resp:
                data = resp.read()
                self.send_response(200)
                self.send_header('Content-Type', 'image/jpeg')
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Cache-Control', 'public, max-age=86400')
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
        except Exception:
            self.send_error(502, 'Bad Gateway: failed to fetch GIBS tile')

    def handle_sources(self, qs):
        # Optional bbox param: s,w,n,e
        bbox_param = qs.get('bbox', [None])[0]
        if bbox_param:
            try:
                s, w, n, e = [float(x) for x in bbox_param.split(',')]
                bbox = (s, w, n, e)
            except Exception:
                bbox = tuple(CITY['bbox'])
        else:
            bbox = tuple(CITY['bbox'])

        s, w, n, e = bbox
        # Factories/industry, landfills, power plants, major roads
        query = f'''
[out:json][timeout:25];
(
  node["landuse"="industrial"]({s},{w},{n},{e});
  way["landuse"="industrial"]({s},{w},{n},{e});
  node["industrial"]({s},{w},{n},{e});
  node["man_made"="works"]({s},{w},{n},{e});
  way["man_made"="works"]({s},{w},{n},{e});
  node["landuse"="landfill"]({s},{w},{n},{e});
  way["landuse"="landfill"]({s},{w},{n},{e});
  node["amenity"="waste_disposal"]({s},{w},{n},{e});
  node["power"="plant"]({s},{w},{n},{e});
  way["power"="plant"]({s},{w},{n},{e});
  // Major roads
  way["highway"~"^(motorway|trunk|primary)$"]({s},{w},{n},{e});
);
out center tags;
'''
        data, status = fetch_json(
            'https://overpass-api.de/api/interpreter',
            method='POST',
            data=('data=' + re.sub(r'\s+', ' ', query).strip()).encode('utf-8'),
            headers={'Content-Type': 'application/x-www-form-urlencoded'}
        )
        if not data or status != 200:
            return json_response(self, {"type": "FeatureCollection", "features": []})

        features = []
        for el in data.get('elements', []):
            tags = el.get('tags', {})
            if el.get('type') == 'way' and 'highway' in tags:
                # line geometry not returned; we use center as point for now
                center = el.get('center') or {}
                coords = [center.get('lon'), center.get('lat')] if center else None
                gtype = 'road'
            else:
                if el.get('type') == 'node':
                    coords = [el.get('lon'), el.get('lat')]
                else:
                    center = el.get('center') or {}
                    coords = [center.get('lon'), center.get('lat')] if center else None
                # classify
                if tags.get('landuse') == 'landfill' or tags.get('amenity') == 'waste_disposal':
                    gtype = 'landfill'
                elif tags.get('power') == 'plant':
                    gtype = 'power_plant'
                elif tags.get('landuse') == 'industrial' or 'industrial' in tags or tags.get('man_made') == 'works':
                    gtype = 'factory'
                else:
                    gtype = 'source'
            if not coords or coords[0] is None or coords[1] is None:
                continue
            features.append({
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': coords},
                'properties': {
                    'id': f"{el.get('type')}/{el.get('id')}",
                    'name': tags.get('name') or 'Unknown',
                    'type': gtype,
                    'tags': tags,
                }
            })
        return json_response(self, {"type": "FeatureCollection", "features": features})


def run(host='0.0.0.0', port=3000):
    os.chdir(ROOT_DIR)
    httpd = ThreadingHTTPServer((host, port), Handler)
    print(f"Stdlib server running on http://{host}:{port}")
    print(f"Serving static from: {PUBLIC_DIR}")
    httpd.serve_forever()


if __name__ == '__main__':
    run()
