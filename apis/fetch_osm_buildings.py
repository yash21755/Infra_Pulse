"""
fetch_osm_buildings.py - Fetches real building polygons from OpenStreetMap
for the IIITA campus and writes them to buildings.json
"""
import json
import urllib.request
import urllib.parse
import sys

BOUNDS = (25.426, 81.768, 25.434, 81.778)  # IIITA campus bbox

query = f"""[out:json][timeout:30];
(
  way["building"]({BOUNDS[0]},{BOUNDS[1]},{BOUNDS[2]},{BOUNDS[3]});
);
out body;
>;
out skel qt;"""

url = "https://overpass-api.de/api/interpreter"
data = urllib.parse.urlencode({"data": query}).encode()
req = urllib.request.Request(url, data=data, method="POST")
req.add_header("User-Agent", "InfraPulse/1.0")

print("Fetching from Overpass API...")
try:
    with urllib.request.urlopen(req, timeout=35) as resp:
        result = json.loads(resp.read())
except Exception as e:
    print(f"Error fetching: {e}")
    sys.exit(1)

# Build node lookup: id -> (lat, lon)
nodes = {}
for el in result.get("elements", []):
    if el["type"] == "node":
        nodes[el["id"]] = (el["lat"], el["lon"])

# Extract named building ways
buildings = []
seen_names = set()
for el in result.get("elements", []):
    if el["type"] != "way":
        continue
    tags = el.get("tags", {})
    if "building" not in tags:
        continue

    name = (
        tags.get("name")
        or tags.get("addr:housename")
        or tags.get("building:name")
        or ""
    ).strip()

    # Build polygon from node refs
    coords = []
    for nid in el.get("nodes", []):
        if nid in nodes:
            coords.append(list(nodes[nid]))  # [lat, lon]

    if len(coords) < 3:
        continue

    # Generate a stable ID
    building_id = (
        tags.get("ref")
        or tags.get("short_name")
        or f"OSM-{el['id']}"
    ).upper().replace(" ", "_")

    building_type = tags.get("building", "yes")
    if building_type == "yes":
        building_type = "building"

    entry = {
        "id": building_id,
        "name": name if name else f"Building {el['id']}",
        "type": building_type,
        "tags": [t for t in [tags.get("amenity"), tags.get("leisure")] if t],
        "osm_id": el["id"],
        "polygon": coords,
    }
    buildings.append(entry)

print(f"Found {len(buildings)} buildings with polygons")
for b in buildings:
    print(f"  [{b['id']}] {b['name']}  ({len(b['polygon'])} nodes)")

# Write to buildings.json
output = {
    "_comment": "Auto-generated from OpenStreetMap Overpass API — real IIITA campus building polygons",
    "_format": "Each polygon is a list of [latitude, longitude] coordinate pairs",
    "_source": f"Overpass API bbox {BOUNDS}",
    "buildings": buildings
}

with open("buildings.json", "w") as f:
    json.dump(output, f, indent=2)

print(f"\nWrote {len(buildings)} buildings to buildings.json")
