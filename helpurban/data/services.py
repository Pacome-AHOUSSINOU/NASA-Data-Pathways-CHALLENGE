import requests
from io import BytesIO

WMS_URL = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"

def fetch_wms_map(layers, bbox, width=1024, height=512, time=None):
    if isinstance(layers, list):
        layers = ",".join(layers)

    params = {
        "SERVICE": "WMS",
        "REQUEST": "GetMap",
        "VERSION": "1.3.0",
        "LAYERS": layers,
        "STYLES": "",
        "FORMAT": "image/png",
        "CRS": "EPSG:4326",
        "BBOX": ",".join(map(str, bbox)),
        "WIDTH": width,
        "HEIGHT": height,
        "TRANSPARENT": "TRUE"
    }
    if time:
        params["TIME"] = time

    r = requests.get(WMS_URL, params=params)
    if r.status_code != 200:
        raise Exception(f"WMS error: {r.text[:200]}")
    return BytesIO(r.content)
