"""
geospatial_api.py — Infra_Pulse Dynamic H3 Hexagonal Pre-Filtering Service
=========================================================================
Implements Uber H3 hexagonal spatial indexing for O(1) geospatial candidate
filtering downstream before Tri-Modal redundancy detection.

Core Architecture:
1. Immutable Level-12 Storage:
   GPS coordinates are permanently converted to Resolution 12 cells (h3_res12).
   All coarser parent cells are derived on the fly via cell_to_parent.
2. Active Resolution & Hysteresis State:
   Maintains active query resolution per Resolution 10 parent cell:
   - Initial baseline: R_base = 10 (capped at R_max = 12).
   - Reconfiguration formula:
     R_target = min(12, 10 + floor(log10(max(1, N_open))))
     * N_open >= 10  -> upgrade to Res 11
     * N_open >= 100 -> upgrade to Res 12
   - Hysteresis damping to prevent boundary thrashing:
     * Downgrade Res 12 -> Res 11 only when N_open <= 60
     * Downgrade Res 11 -> Res 10 only when N_open <= 6
3. Candidate Retrieval (K=1 Neighborhood):
   Finds K=1 disk neighbors at active_res around the query cell to filter
   candidate open issues before multimodal similarity scoring.
"""

from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple, Any

import uvicorn
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Official H3 Spatial Library ───────────────────────────────────────────────
try:
    import h3
except ImportError:
    raise ImportError("The 'h3' library is required. Please install it via 'pip install h3'.")

# Compatibility layer for H3 v3 vs v4 function names
def latlng_to_cell(lat: float, lng: float, res: int) -> str:
    if hasattr(h3, "latlng_to_cell"):
        return h3.latlng_to_cell(lat, lng, res)
    return h3.geo_to_h3(lat, lng, res)

def cell_to_parent(cell: str, res: int) -> str:
    if hasattr(h3, "cell_to_parent"):
        return h3.cell_to_parent(cell, res)
    return h3.h3_to_parent(cell, res)

def grid_disk(cell: str, k: int = 1) -> Set[str]:
    if hasattr(h3, "grid_disk"):
        return set(h3.grid_disk(cell, k))
    return set(h3.k_ring(cell, k))

def is_valid_cell(cell: str) -> bool:
    if hasattr(h3, "is_valid_cell"):
        return h3.is_valid_cell(cell)
    return h3.h3_is_valid(cell)

# ── Shared Configuration ──────────────────────────────────────────────────────
try:
    from config import API_HOST, GEOSPATIAL_PORT, DATA_DIR
except ImportError:
    API_HOST = "0.0.0.0"
    GEOSPATIAL_PORT = 8001
    DATA_DIR = Path(__file__).parent / "data"

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | geo_api | %(message)s",
)
logger = logging.getLogger("geospatial_api")


# ═══════════════════════════════════════════════════════════════════════════════
# Dynamic H3 Spatial Pre-Filtering Index
# ═══════════════════════════════════════════════════════════════════════════════

class H3SpatialIndex:
    """
    Manages active query resolutions, hysteresis transitions, and candidate
    retrieval across campus Res-10 regions.
    """

    BASE_RES: int = 10
    MAX_RES: int = 12
    STORAGE_RES: int = 12

    # Hysteresis thresholds
    UPGRADE_RES11_MIN_OPEN: int = 10
    UPGRADE_RES12_MIN_OPEN: int = 100
    DOWNGRADE_RES11_MAX_OPEN: int = 60   # Res 12 -> Res 11 when N_open <= 60
    DOWNGRADE_RES10_MAX_OPEN: int = 6    # Res 11 -> Res 10 when N_open <= 6

    def __init__(self, state_file: Optional[Path] = None) -> None:
        if state_file is None:
            DATA_DIR.mkdir(parents=True, exist_ok=True)
            self._state_file = DATA_DIR / "h3_state.json"
        else:
            self._state_file = state_file

        # region_state: parent_res10 -> { "n_open": int, "active_res": int }
        self._region_state: Dict[str, dict] = {}
        # issue_registry: issue_id -> { "h3_res12": str, "parent_10": str, "status": str }
        self._issue_registry: Dict[str, dict] = {}

        self._load_state()

    def _load_state(self) -> None:
        if not self._state_file.exists():
            return
        try:
            with open(self._state_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                self._region_state = data.get("regions", {})
                self._issue_registry = data.get("issues", {})
            logger.info(
                f"Loaded H3 state: {len(self._region_state)} Res-10 regions, "
                f"{len(self._issue_registry)} tracked issues."
            )
        except Exception as exc:
            logger.warning(f"Could not load H3 state from {self._state_file}: {exc}")

    def _save_state(self) -> None:
        try:
            self._state_file.parent.mkdir(parents=True, exist_ok=True)
            with open(self._state_file, "w", encoding="utf-8") as f:
                json.dump(
                    {
                        "regions": self._region_state,
                        "issues": self._issue_registry,
                    },
                    f,
                    indent=2,
                )
        except Exception as exc:
            logger.error(f"Failed to persist H3 state to {self._state_file}: {exc}")

    # ── Reconfiguration & Hysteresis Logic ────────────────────────────────────
    def compute_next_active_res(self, current_res: int, n_open: int) -> int:
        """
        Calculates the new active resolution applying subdivision formula
        and hysteresis damping.
        """
        n_open = max(0, n_open)
        if current_res == 10:
            if n_open >= self.UPGRADE_RES12_MIN_OPEN:
                return 12
            if n_open >= self.UPGRADE_RES11_MIN_OPEN:
                return 11
            return 10

        if current_res == 11:
            if n_open >= self.UPGRADE_RES12_MIN_OPEN:
                return 12
            if n_open <= self.DOWNGRADE_RES10_MAX_OPEN:
                return 10
            return 11

        if current_res == 12:
            if n_open <= self.DOWNGRADE_RES10_MAX_OPEN:
                return 10
            if n_open <= self.DOWNGRADE_RES11_MAX_OPEN:
                return 11
            return 12

        # Fallback clamped to [10, 12]
        return min(self.MAX_RES, max(self.BASE_RES, 10 + int(math.floor(math.log10(max(1, n_open))))))

    def get_region_info(self, parent_10: str) -> dict:
        """Returns or initializes the active resolution and N_open for a Res-10 region."""
        if parent_10 not in self._region_state:
            self._region_state[parent_10] = {
                "n_open": 0,
                "active_res": self.BASE_RES,
            }
        return self._region_state[parent_10]

    # ── Level-12 Coordinate Hashing ───────────────────────────────────────────
    def index_coordinates(self, lat: float, lng: float) -> str:
        """Computes permanent immutable Resolution 12 H3 index."""
        return latlng_to_cell(lat, lng, self.STORAGE_RES)

    # ── Lifecycle Tracking ────────────────────────────────────────────────────
    def register_issue(self, issue_id: str, h3_res12: str, is_open: bool = True) -> dict:
        """Registers a new issue and updates open counts and resolution."""
        parent_10 = cell_to_parent(h3_res12, self.BASE_RES)
        reg = self.get_region_info(parent_10)

        prev_issue = self._issue_registry.get(issue_id)
        if prev_issue and prev_issue.get("status") == "open" and not is_open:
            reg["n_open"] = max(0, reg["n_open"] - 1)
        elif (not prev_issue or prev_issue.get("status") != "open") and is_open:
            reg["n_open"] += 1

        reg["active_res"] = self.compute_next_active_res(reg["active_res"], reg["n_open"])
        self._issue_registry[issue_id] = {
            "h3_res12": h3_res12,
            "parent_10": parent_10,
            "status": "open" if is_open else "closed",
        }
        self._save_state()
        return reg

    def update_status(self, issue_id: str, is_open: bool, h3_res12: Optional[str] = None) -> Optional[dict]:
        """Updates issue open/closed status and applies hysteresis."""
        issue_data = self._issue_registry.get(issue_id)
        if not issue_data and h3_res12:
            return self.register_issue(issue_id, h3_res12, is_open=is_open)
        if not issue_data:
            return None

        cell_res12 = issue_data["h3_res12"]
        parent_10 = issue_data.get("parent_10") or cell_to_parent(cell_res12, self.BASE_RES)
        reg = self.get_region_info(parent_10)

        prev_status = issue_data.get("status", "open")
        new_status = "open" if is_open else "closed"

        if prev_status == "open" and new_status == "closed":
            reg["n_open"] = max(0, reg["n_open"] - 1)
        elif prev_status != "open" and new_status == "open":
            reg["n_open"] += 1

        reg["active_res"] = self.compute_next_active_res(reg["active_res"], reg["n_open"])
        issue_data["status"] = new_status
        self._save_state()
        return reg

    # ── Candidate Retrieval (K=1 Neighborhood Search) ─────────────────────────
    def get_query_neighborhood(self, h3_res12: str) -> Tuple[int, str, List[str]]:
        """
        Derives active resolution, query cell, and K=1 disk neighborhood.
        1. parent_10 = cell_to_parent(h3_res12, 10)
        2. active_res = region.active_res (default 10)
        3. query_cell = cell_to_parent(h3_res12, active_res)
        4. neighbor_cells = grid_disk(query_cell, 1)
        """
        parent_10 = cell_to_parent(h3_res12, self.BASE_RES)
        region = self.get_region_info(parent_10)
        active_res = region["active_res"]

        query_cell = cell_to_parent(h3_res12, active_res)
        neighbor_cells = grid_disk(query_cell, 1)

        return active_res, query_cell, sorted(neighbor_cells)

    def filter_candidate_issues(
        self,
        h3_res12: str,
        open_issues: Optional[List[dict]] = None,
    ) -> List[dict]:
        """
        Filters existing Open issues whose cell_to_parent(issue.h3_res12, active_res)
        is in neighbor_cells.
        """
        active_res, query_cell, neighbor_set = self.get_query_neighborhood(h3_res12)
        neighbor_set_lookup = set(neighbor_set)

        # If external list provided, filter that list
        if open_issues is not None:
            candidates = []
            for issue in open_issues:
                cell = issue.get("h3_res12") or issue.get("buildingId")
                if not cell or not is_valid_cell(str(cell)):
                    continue
                issue_parent = cell_to_parent(str(cell), active_res)
                if issue_parent in neighbor_set_lookup:
                    candidates.append(issue)
            return candidates

        # Otherwise filter from internal registry
        candidates = []
        for iid, data in self._issue_registry.items():
            if data.get("status") != "open":
                continue
            issue_parent = cell_to_parent(data["h3_res12"], active_res)
            if issue_parent in neighbor_set_lookup:
                candidates.append({"issue_id": iid, **data})
        return candidates


# Module-level singleton
spatial_index = H3SpatialIndex()

# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI App
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title="Infra_Pulse — H3 Geospatial Pre-Filter",
    description="Dynamic H3 hexagonal spatial indexing for redundancy detection pre-filtering.",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ═══════════════════════════════════════════════════════════════════════════════
# Schemas
# ═══════════════════════════════════════════════════════════════════════════════

class LocationRequest(BaseModel):
    latitude: float = Field(..., ge=-90, le=90, description="GPS latitude")
    longitude: float = Field(..., ge=-180, le=180, description="GPS longitude")
    user_tag_building_id: Optional[str] = Field(
        None,
        description="Optional: explicit user tag override",
    )


class LocationResponse(BaseModel):
    success: bool
    building_id: Optional[str]
    building_name: Optional[str]
    building_type: Optional[str]
    tags: Optional[List[str]]
    resolution_method: str
    approximate_match: bool
    message: str
    # H3 specific metadata
    h3_res12: Optional[str] = None
    parent_res10: Optional[str] = None
    active_res: Optional[int] = None
    query_cell: Optional[str] = None
    neighbor_cells: Optional[List[str]] = None


class BatchLocationRequest(BaseModel):
    locations: List[LocationRequest] = Field(..., max_length=100)


class StatusUpdateRequest(BaseModel):
    issue_id: str
    status: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    h3_res12: Optional[str] = None


class CandidateQueryRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    h3_res12: Optional[str] = None
    open_issues: Optional[List[dict]] = None


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {
        "status": "healthy",
        "service": "geospatial_h3_prefilter",
        "indexed_regions": len(spatial_index._region_state),
        "tracked_issues": len(spatial_index._issue_registry),
    }


@app.post("/resolve-location", response_model=LocationResponse)
async def resolve_location(req: LocationRequest):
    """
    Resolve GPS coordinates into an immutable H3 Resolution 12 index
    and derive its dynamic active resolution neighborhood.
    """
    # 1. Compute permanent immutable Level-12 index
    h3_res12 = spatial_index.index_coordinates(req.latitude, req.longitude)
    parent_10 = cell_to_parent(h3_res12, 10)

    # 2. Derive active query neighborhood
    active_res, query_cell, neighbors = spatial_index.get_query_neighborhood(h3_res12)

    # Respect explicit user tag if provided, otherwise use h3_res12
    resolved_id = req.user_tag_building_id.upper() if req.user_tag_building_id else h3_res12
    method = "user_tag" if req.user_tag_building_id else "h3_dynamic_res"

    logger.info(
        f"[h3_resolve] ({req.latitude:.5f}, {req.longitude:.5f}) -> "
        f"res12: {h3_res12} | parent10: {parent_10} | active_res: {active_res}"
    )

    return LocationResponse(
        success=True,
        building_id=resolved_id,
        building_name=f"H3 Index: {h3_res12}",
        building_type="h3_hexagonal_cell",
        tags=["h3", f"res_{active_res}", f"parent10_{parent_10}"],
        resolution_method=method,
        approximate_match=False,
        message=f"Resolved to H3 Resolution 12 cell {h3_res12} (active resolution {active_res}).",
        h3_res12=h3_res12,
        parent_res10=parent_10,
        active_res=active_res,
        query_cell=query_cell,
        neighbor_cells=neighbors,
    )


@app.post("/resolve-location/batch")
async def resolve_location_batch(req: BatchLocationRequest):
    """Batch-resolve up to 100 coordinates into H3 indices."""
    results = []
    for loc in req.locations:
        try:
            res = await resolve_location(loc)
            results.append(res.model_dump())
        except Exception as exc:
            results.append({"success": False, "error": str(exc)})
    return {"results": results, "total": len(results)}


@app.post("/candidates")
async def retrieve_candidates(req: CandidateQueryRequest):
    """
    Candidate Retrieval (K=1 Neighborhood Search):
    Returns filtered candidate issues whose cell at active_res falls
    within the K=1 neighborhood disk.
    """
    if req.h3_res12:
        cell = req.h3_res12
    elif req.latitude is not None and req.longitude is not None:
        cell = spatial_index.index_coordinates(req.latitude, req.longitude)
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either h3_res12 or (latitude, longitude) must be provided.",
        )

    active_res, query_cell, neighbors = spatial_index.get_query_neighborhood(cell)
    candidates = spatial_index.filter_candidate_issues(cell, req.open_issues)

    return {
        "query_h3_res12": cell,
        "active_resolution": active_res,
        "query_cell": query_cell,
        "neighbor_cells": neighbors,
        "candidate_count": len(candidates),
        "candidates": candidates,
    }


@app.post("/issues/status")
async def update_issue_status(req: StatusUpdateRequest):
    """
    Updates an issue's status (open/resolved/closed) and recalculates
    active resolution with hysteresis damping.
    """
    is_open = req.status.lower() in ("open", "in_progress")
    cell = req.h3_res12
    if not cell and req.latitude is not None and req.longitude is not None:
        cell = spatial_index.index_coordinates(req.latitude, req.longitude)

    updated_reg = spatial_index.update_status(req.issue_id, is_open=is_open, h3_res12=cell)
    if not updated_reg:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Issue '{req.issue_id}' not found and no coordinates provided.",
        )

    return {
        "success": True,
        "issue_id": req.issue_id,
        "status": req.status,
        "region_state": updated_reg,
    }


@app.delete("/issues/{issue_id}")
async def remove_issue(issue_id: str):
    """Marks an issue closed when removed from feed."""
    updated = spatial_index.update_status(issue_id, is_open=False)
    return {"success": True, "issue_id": issue_id, "updated": updated is not None}


@app.get("/region-state")
async def get_all_regions():
    """Returns active resolutions and open issue counts for all tracked Res-10 regions."""
    return {
        "total_regions": len(spatial_index._region_state),
        "regions": spatial_index._region_state,
    }


@app.get("/region-state/{parent_10}")
async def get_region(parent_10: str):
    """Returns state for a specific Res-10 parent cell."""
    return spatial_index.get_region_info(parent_10)


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
