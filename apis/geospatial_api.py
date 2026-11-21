"""
geospatial_api.py — Infra_Pulse Dynamic H3 Geospatial Pre-Filtering Service
===========================================================================
Replaces legacy polygon geofencing and 50m radius fallbacks with Uber's H3
hexagonal hierarchical spatial index.

Core Mechanics:
1. Immutable Level-12 Storage: Every (lat, lon) is hashed once at Res 12.
2. Dynamic Resolution Reconfiguration: Regions start at Res 10 and scale up
   to Res 11 (N >= 10) and Res 12 (N >= 100) based on open issue density.
3. Hysteresis Compaction: Downgrades only trigger at lower bounds (<= 60 for
   Res 12->11, <= 6 for Res 11->10) to prevent boundary thrashing.
4. O(1) K=1 Neighborhood Retrieval: Derives active parent cell via bit-shifting
   and returns the center + 6 immediate neighbors for ML pre-filtering.

Endpoints:
    POST http://localhost:8001/resolve-location
    POST http://localhost:8001/resolve-location/batch
    POST http://localhost:8001/issues/open
    POST http://localhost:8001/issues/resolve
    GET  http://localhost:8001/regions
    GET  http://localhost:8001/health
"""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

try:
    import h3
except ImportError as exc:
    raise ImportError("The 'h3' library is required. Install it via: pip install h3") from exc

# ── Config & Logging ───────────────────────────────────────────────────────────
try:
    from config import API_HOST, GEOSPATIAL_PORT
except ImportError:
    API_HOST = "0.0.0.0"
    GEOSPATIAL_PORT = 8001

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | geo_api | %(message)s",
)
logger = logging.getLogger("geospatial_api")

# ── H3 v3 / v4 Compatibility Layer ─────────────────────────────────────────────
def _latlng_to_cell(lat: float, lon: float, res: int) -> str:
    if hasattr(h3, "latlng_to_cell"):
        return h3.latlng_to_cell(lat, lon, res)
    return h3.geo_to_h3(lat, lon, res)


def _cell_to_parent(cell: str, res: int) -> str:
    if hasattr(h3, "cell_to_parent"):
        return h3.cell_to_parent(cell, res)
    return h3.h3_to_parent(cell, res)


def _grid_disk(cell: str, k: int = 1) -> List[str]:
    if hasattr(h3, "grid_disk"):
        return list(h3.grid_disk(cell, k))
    return list(h3.k_ring(cell, k))


# ═══════════════════════════════════════════════════════════════════════════════
# H3 Dynamic Spatial Manager
# ═══════════════════════════════════════════════════════════════════════════════

class H3SpatialManager:
    """
    Manages immutable Res-12 hashing, per-region (Res-10) open issue counts,
    and dynamic resolution reconfiguration with hysteresis.
    """

    RES_BASE = 10
    RES_STORAGE = 12

    # Upgrade thresholds (Subdivision / Zoom-In)
    UPGRADE_TO_11 = 10
    UPGRADE_TO_12 = 100

    # Downgrade thresholds (Hysteresis Compaction / Zoom-Out)
    DOWNGRADE_TO_11 = 60
    DOWNGRADE_TO_10 = 6

    def __init__(self, state_path: Optional[Path] = None) -> None:
        self._state_path = state_path or Path(__file__).with_name("h3_region_state.json")
        # Structure: { parent_10_id: {"open_count": int, "active_res": int} }
        self._regions: Dict[str, Dict[str, int]] = {}
        self._load_state()

    def _load_state(self) -> None:
        if not self._state_path.exists():
            return
        try:
            with open(self._state_path, "r", encoding="utf-8") as fh:
                self._regions = json.load(fh)
            logger.info(f"Loaded H3 state for {len(self._regions)} regions from '{self._state_path}'")
        except Exception as exc:
            logger.error(f"Failed to load H3 state: {exc}")
            self._regions = {}

    def _save_state(self) -> None:
        try:
            with open(self._state_path, "w", encoding="utf-8") as fh:
                json.dump(self._regions, fh, indent=2)
        except Exception as exc:
            logger.error(f"Failed to save H3 state: {exc}")

    def _get_region(self, parent_10: str) -> Dict[str, int]:
        if parent_10 not in self._regions:
            self._regions[parent_10] = {
                "open_count": 0,
                "active_res": self.RES_BASE,
            }
        return self._regions[parent_10]

    def _recalculate_resolution(self, region: Dict[str, int]) -> int:
        """Apply log-scale upgrade and hysteresis downgrade rules."""
        n = region["open_count"]
        curr = region["active_res"]

        # Subdivision (Zoom-In)
        if n >= self.UPGRADE_TO_12:
            curr = 12
        elif n >= self.UPGRADE_TO_11 and curr < 11:
            curr = 11

        # Compaction with Hysteresis (Zoom-Out)
        if curr == 12 and n <= self.DOWNGRADE_TO_11:
            curr = 11
        if curr == 11 and n <= self.DOWNGRADE_TO_10:
            curr = 10

        region["active_res"] = curr
        return curr

    def resolve(self, lat: float, lon: float) -> dict:
        """
        Hash (lat, lon) to immutable Res-12, determine the region's active
        resolution, and return the K=1 neighborhood for candidate filtering.
        """
        h3_res12 = _latlng_to_cell(lat, lon, self.RES_STORAGE)
        parent_10 = _cell_to_parent(h3_res12, self.RES_BASE)
        region = self._regions.get(parent_10, {"open_count": 0, "active_res": self.RES_BASE})

        active_res = region["active_res"]
        query_cell = _cell_to_parent(h3_res12, active_res)
        neighbor_cells = _grid_disk(query_cell, k=1)

        return {
            "h3_res12": h3_res12,
            "parent_10": parent_10,
            "active_res": active_res,
            "query_cell": query_cell,
            "neighbor_cells": neighbor_cells,
            "open_count": region["open_count"],
        }

    def update_open_count(
        self,
        delta: int,
        h3_res12: Optional[str] = None,
        lat: Optional[float] = None,
        lon: Optional[float] = None,
    ) -> dict:
        """Increment (+1) or decrement (-1) open count for a region and persist."""
        if not h3_res12:
            if lat is None or lon is None:
                raise ValueError("Provide either 'h3_res12' or both 'latitude' and 'longitude'.")
            h3_res12 = _latlng_to_cell(lat, lon, self.RES_STORAGE)

        parent_10 = _cell_to_parent(h3_res12, self.RES_BASE)
        region = self._get_region(parent_10)

        old_res = region["active_res"]
        region["open_count"] = max(0, region["open_count"] + delta)
        new_res = self._recalculate_resolution(region)

        # Clean up empty regions at base resolution to keep state lean
        if region["open_count"] == 0 and new_res == self.RES_BASE:
            self._regions.pop(parent_10, None)

        self._save_state()

        if new_res != old_res:
            logger.info(
                f"[reconfig] Region {parent_10}: Res {old_res} -> Res {new_res} "
                f"(open_count={region['open_count']})"
            )

        return {
            "h3_res12": h3_res12,
            "parent_10": parent_10,
            "open_count": region["open_count"],
            "previous_res": old_res,
            "active_res": new_res,
        }

    def list_regions(self) -> Dict[str, Dict[str, int]]:
        return dict(self._regions)


# ── Module-level singleton ─────────────────────────────────────────────────────
spatial_manager = H3SpatialManager()

# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI App & Schemas
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Infra_Pulse — H3 Geospatial Pre-Filter",
    description=(
        "Dynamic H3 hexagonal spatial indexing with immutable Level-12 storage, "
        "log-scale resolution reconfiguration, hysteresis compaction, and K=1 neighborhood lookup."
    ),
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


class LocationRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="GPS latitude")
    longitude: float = Field(..., ge=-180, le=180, description="GPS longitude")


class LocationResponse(BaseModel):
    success: bool
    # Kept as building_id for backward compatibility with downstream Node.js/ML callers
    building_id: str
    h3_res12: str
    parent_10: str
    active_res: int
    query_cell: str
    neighbor_cells: List[str]
    open_count_in_region: int
    resolution_method: str
    message: str


class BatchLocationRequest(BaseModel):
    locations: List[LocationRequest] = Field(..., max_length=100)


class IssueLifecycleRequest(BaseModel):
    h3_res12: Optional[str] = Field(None, description="Stored Level-12 H3 index of the issue")
    latitude: Optional[float] = Field(None, ge=-90, le=90)
    longitude: Optional[float] = Field(None, ge=-180, le=180)


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "h3_geospatial_filter",
        "tracked_regions": len(spatial_manager.list_regions()),
        "base_resolution": spatial_manager.RES_BASE,
        "storage_resolution": spatial_manager.RES_STORAGE,
    }


@app.post("/resolve-location", response_model=LocationResponse)
async def resolve_location(req: LocationRequest):
    """
    Resolve a GPS coordinate to its immutable H3 Res-12 ID and active K=1
    neighborhood cells for downstream Tri-Modal redundancy filtering.
    """
    res = spatial_manager.resolve(req.latitude, req.longitude)

    logger.info(
        f"[h3_resolve] ({req.latitude:.5f}, {req.longitude:.5f}) -> "
        f"res12={res['h3_res12']} | active=Res{res['active_res']} | "
        f"query={res['query_cell']} | k1_cells={len(res['neighbor_cells'])}"
    )

    return LocationResponse(
        success=True,
        building_id=res["h3_res12"],
        h3_res12=res["h3_res12"],
        parent_10=res["parent_10"],
        active_res=res["active_res"],
        query_cell=res["query_cell"],
        neighbor_cells=res["neighbor_cells"],
        open_count_in_region=res["open_count"],
        resolution_method="h3_dynamic_kring",
        message=(
            f"Resolved to Res-{res['active_res']} cell {res['query_cell']} "
            f"({len(res['neighbor_cells'])} K=1 cells)."
        ),
    )


@app.post("/resolve-location/batch")
async def resolve_location_batch(req: BatchLocationRequest):
    """Batch-resolve up to 100 GPS coordinates in a single call."""
    results = []
    for loc in req.locations:
        result = await resolve_location(loc)
        results.append(result.model_dump())
    return {"results": results, "total": len(results)}


@app.post("/issues/open")
async def register_open_issue(req: IssueLifecycleRequest):
    """Call when a new issue is persisted as Open to update regional density."""
    try:
        updated = spatial_manager.update_open_count(
            delta=1, h3_res12=req.h3_res12, lat=req.latitude, lon=req.longitude
        )
        return {"success": True, **updated}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@app.post("/issues/resolve")
async def register_resolved_issue(req: IssueLifecycleRequest):
    """Call when an issue is closed/resolved to trigger hysteresis compaction."""
    try:
        updated = spatial_manager.update_open_count(
            delta=-1, h3_res12=req.h3_res12, lat=req.latitude, lon=req.longitude
        )
        return {"success": True, **updated}
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))


@app.get("/regions")
async def list_regions():
    """Inspect all active Res-10 regions, their open counts, and current resolutions."""
    regions = spatial_manager.list_regions()
    return {"regions": regions, "count": len(regions)}


# ═══════════════════════════════════════════════════════════════════════════════
# Entry Point
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run(
        "geospatial_api:app",
        host=API_HOST,
        port=GEOSPATIAL_PORT,
        reload=True,
        log_level="info",
    )