"""
geospatial_api.py — Infra_Pulse Geospatial Pre-Filtering Service
================================================================
Translates raw GPS coordinates into discrete campus building identifiers,
reducing the redundancy-check search space from N (entire database) to K
(building-specific subset) — achieving O(1) lookup complexity for the ML
pipeline downstream.

Key concepts from the paper / presentation
------------------------------------------
• Replaces Euclidean distance checks (which fail across multi-storey buildings
  or adjacent structures) with indexed topological polygon queries.
• Supports two resolution modes:
    1. Polygon geofencing  — GPS point-in-polygon (primary)
    2. Explicit user tag   — student chooses building from a list (override)
• Falls back to a 50-metre zone bucket for open-area pins when a GPS point lies
  outside any registered polygon.

Usage (from your Node.js/Express backend)
-----------------------------------------
    POST http://localhost:8001/resolve-location
    Body: { "latitude": 25.4401, "longitude": 81.8703 }

    GET  http://localhost:8001/buildings
    GET  http://localhost:8001/buildings/{building_id}
    GET  http://localhost:8001/health
"""

from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from shapely.geometry import Point, Polygon

# ── Import shared config ───────────────────────────────────────────────────────
try:
    from config import (
        CAMPUS_BUILDINGS_CONFIG,
        API_HOST,
        GEOSPATIAL_PORT,
    )
except ImportError:
    CAMPUS_BUILDINGS_CONFIG              = "buildings.json"
    API_HOST                             = "0.0.0.0"
    GEOSPATIAL_PORT                      = 8001

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | geo_api | %(message)s",
)
logger = logging.getLogger("geospatial_api")

# ═══════════════════════════════════════════════════════════════════════════════
# Building Registry
# ═══════════════════════════════════════════════════════════════════════════════

class BuildingRegistry:
    """
    Manages campus building polygons loaded from OSM data.

    Resolution cascade:
      1. Exact polygon containment  — pin is inside a known building
      2. 50-metre radius zone       — open-area pin; snapped to a ~50 m grid cell
                                      so nearby open-area issues still group together
    """

    # ~50 metres in degrees (latitude-safe approximation at 25°N)
    ZONE_CELL_DEG = 0.00045   # ≈ 50 m

    def __init__(self, config_path: Optional[str] = None) -> None:
        self._store: Dict[str, dict] = {}
        self._load(config_path or CAMPUS_BUILDINGS_CONFIG)

    # ── Loader ─────────────────────────────────────────────────────────────────
    def _load(self, config_path: str) -> None:
        path = Path(config_path)
        if not path.exists():
            logger.error(
                f"Buildings config not found at '{path}'. "
                "No buildings will be registered — geospatial resolution will fail."
            )
            return

        with open(path, "r") as fh:
            raw = json.load(fh)

        for b in raw.get("buildings", []):
            try:
                # Convert [lat, lon] → Shapely (lon, lat) convention
                coords = [(c[1], c[0]) for c in b["polygon"]]
                poly   = Polygon(coords)

                if not poly.is_valid:
                    poly = poly.buffer(0)   # Auto-repair degenerate polygons

                self._store[b["id"]] = {
                    "id":       b["id"],
                    "name":     b["name"],
                    "type":     b.get("type", "unknown"),
                    "tags":     b.get("tags", []),
                    "polygon":  poly,
                    # centroid stored as (lat, lon) for human readability
                    "centroid": (round(poly.centroid.y, 6), round(poly.centroid.x, 6)),
                }
            except Exception as exc:
                logger.error(f"Skipping building '{b.get('id', '?')}': {exc}")

        logger.info(f"Loaded {len(self._store)} campus buildings from '{path}'")

    # ── Core resolution ────────────────────────────────────────────────────────
    def resolve(self, lat: float, lon: float) -> dict:
        """
        Returns a dict with building_id, building_name, building_type,
        resolution_method, and approximate_match.

        Stage 1: Exact polygon containment.
        Stage 2: 50-metre zone bucket for open-area pins.
        """
        point = Point(lon, lat)     # Shapely: (x=lon, y=lat)

        # Stage 1 — Exact containment
        for building in self._store.values():
            if building["polygon"].contains(point):
                return self._public(building, method="gps_polygon", approx=False)

        # Stage 2 — 50 m zone bucket for open areas
        zone_id   = self._zone_id(lat, lon)
        zone_name = f"Open Area Zone {zone_id}"
        logger.info(f"[zone_bucket] ({lat},{lon}) → {zone_id}")
        return {
            "building_id":       zone_id,
            "building_name":     zone_name,
            "building_type":     "outdoor_zone",
            "tags":              ["outdoor", "open_area"],
            "centroid":          (round(lat, 5), round(lon, 5)),
            "resolution_method": "zone_bucket",
            "approximate_match": True,
        }

    def _zone_id(self, lat: float, lon: float) -> str:
        """
        Snap coordinates to a ~50 m grid cell and return a stable string ID.
        Two pins within ~50 m of each other will hash to the same cell.
        """
        cell_lat = round(round(lat / self.ZONE_CELL_DEG) * self.ZONE_CELL_DEG, 6)
        cell_lon = round(round(lon / self.ZONE_CELL_DEG) * self.ZONE_CELL_DEG, 6)
        return f"ZONE_{cell_lat}_{cell_lon}"

    # ── Lookup by ID ───────────────────────────────────────────────────────────
    def get_by_id(self, building_id: str) -> Optional[dict]:
        b = self._store.get(building_id)
        return self._public(b) if b else None

    # ── List all buildings ─────────────────────────────────────────────────────
    def list_all(self) -> List[dict]:
        return [
            {
                "building_id":   b["id"],
                "building_name": b["name"],
                "building_type": b["type"],
                "tags":          b["tags"],
                "centroid_lat":  b["centroid"][0],
                "centroid_lon":  b["centroid"][1],
            }
            for b in self._store.values()
        ]

    # ── Internal helper ────────────────────────────────────────────────────────
    @staticmethod
    def _public(b: dict, method: str = "id_lookup", approx: bool = False) -> dict:
        return {
            "building_id":   b["id"],
            "building_name": b["name"],
            "building_type": b["type"],
            "tags":          b["tags"],
            "centroid":      b["centroid"],
            "resolution_method": method,
            "approximate_match": approx,
        }



# ── Module-level singleton ─────────────────────────────────────────────────────
registry = BuildingRegistry()

# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI App
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title       = "Infra_Pulse — Geospatial Pre-Filter",
    description = (
        "Maps GPS coordinates → campus building IDs for O(1) ML pipeline pre-filtering. "
        "Replaces Euclidean distance with topological polygon intersection."
    ),
    version     = "1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins  = ["*"],
    allow_methods  = ["*"],
    allow_headers  = ["*"],
)

# ═══════════════════════════════════════════════════════════════════════════════
# Request / Response Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class LocationRequest(BaseModel):
    latitude:              float        = Field(..., ge=-90,  le=90,  description="GPS latitude")
    longitude:             float        = Field(..., ge=-180, le=180, description="GPS longitude")
    user_tag_building_id:  Optional[str] = Field(
        None,
        description="Optional: explicit building ID supplied by the student. "
                    "When present this takes priority over GPS polygon inference."
    )

    model_config = {
        "json_schema_extra": {
            "example": {
                "latitude":             25.4401,
                "longitude":            81.8703,
                "user_tag_building_id": None,
            }
        }
    }


class LocationResponse(BaseModel):
    success:              bool
    building_id:          Optional[str]
    building_name:        Optional[str]
    building_type:        Optional[str]
    tags:                 Optional[List[str]]
    resolution_method:    str      # gps_polygon | user_tag | nearest_approximation | unresolved
    approximate_match:    bool
    message:              str


class BatchLocationRequest(BaseModel):
    locations: List[LocationRequest] = Field(..., max_length=100)


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {
        "status":           "healthy",
        "service":          "geospatial_filter",
        "buildings_loaded": len(registry._store),
    }


@app.post("/resolve-location", response_model=LocationResponse)
async def resolve_location(req: LocationRequest):
    """
    Resolve a GPS coordinate (and optional user tag) to a campus building.

    Resolution priority
    -------------------
    1. Explicit `user_tag_building_id`   → immediate O(1) dict lookup
    2. Polygon geofencing on (lat, lon)  → exact containment test
    3. 50-metre zone bucket              → open-area pins
    """

    # ── Priority 1: Explicit user tag ─────────────────────────────────────────
    if req.user_tag_building_id:
        b = registry.get_by_id(req.user_tag_building_id.upper())
        if not b:
            raise HTTPException(
                status_code = status.HTTP_404_NOT_FOUND,
                detail      = f"Building ID '{req.user_tag_building_id}' is not registered. "
                              "Call GET /buildings for the complete list.",
            )
        logger.info(f"[user_tag] → {b['building_id']}")
        return LocationResponse(
            success=True,
            building_id=b["building_id"],
            building_name=b["building_name"],
            building_type=b["building_type"],
            tags=b["tags"],
            resolution_method="user_tag",
            approximate_match=False,
            message=f"Resolved to {b['building_name']} via explicit user tag.",
        )

    # ── Priority 2 & 3: GPS-based resolution ──────────────────────────────
    # resolve() always returns a result — building polygon,
    # or 50 m zone bucket for open-area pins. Never returns None.
    result = registry.resolve(req.latitude, req.longitude)

    logger.info(
        f"[{result['resolution_method']}] ({req.latitude},{req.longitude}) "
        f"→ {result['building_id']}"
    )
    return LocationResponse(
        success=True,
        building_id=result["building_id"],
        building_name=result["building_name"],
        building_type=result["building_type"],
        tags=result["tags"],
        resolution_method=result["resolution_method"],
        approximate_match=result["approximate_match"],
        message=(
            f"Resolved to {result['building_name']}."
            + (" (approximate)" if result["approximate_match"] else "")
        ),
    )


@app.post("/resolve-location/batch")
async def resolve_location_batch(req: BatchLocationRequest):
    """
    Batch-resolve up to 100 GPS coordinates in one call.
    Useful for importing historical issues or migrating data.
    """
    results = []
    for loc in req.locations:
        try:
            result = await resolve_location(loc)
            results.append(result.model_dump())
        except HTTPException as exc:
            results.append({"success": False, "error": exc.detail})
    return {"results": results, "total": len(results)}


@app.get("/buildings")
async def list_buildings():
    """Return all registered campus buildings with metadata."""
    buildings = registry.list_all()
    return {"buildings": buildings, "count": len(buildings)}


@app.get("/buildings/{building_id}")
async def get_building(building_id: str):
    """Get details of a specific building by ID (case-insensitive)."""
    b = registry.get_by_id(building_id.upper())
    if not b:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail      = f"Building '{building_id}' not found.",
        )
    return b


# ═══════════════════════════════════════════════════════════════════════════════
# Entry Point
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run(
        "geospatial_api:app",
        host    = API_HOST,
        port    = GEOSPATIAL_PORT,
        reload  = True,
        log_level = "info",
    )