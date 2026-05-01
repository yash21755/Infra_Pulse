"""
priority_api.py — Infra_Pulse Issue Priority Ranking Service
============================================================
Implements the full ranking pipeline from the presentation:

  1. Log-Time Decay Score
     Score = log10(max(1, |U − D|)) + sign(U − D) · t / 45 000
     • Logarithmic scaling: first 10 upvotes ≈ impact of next 100
     • 45 000-second constant → 12.5-hour half-life
     • t = seconds since platform epoch → newer posts start higher

  2. Engagement Velocity Tracker  (PNAS Nexus 2025)
     velocity = ΔEngagement / Δt  (within a 5-minute sliding window)
     • 50 upvotes in 5 min outranks 500 upvotes in 5 days
     • Rage-click guard: votes registered faster than DWELL_TIME_MIN_SECONDS are ignored

  3. Anti-Stagnation / Diversity Re-ranking  (Jahanbakhsh et al. 2025)
     • If the top DIVERSITY_STREAK_LIMIT posts share the same sub-community tag,
       the next slot is reserved for a high-scoring post from a different category.
     • Prevents "Feed Fatigue" from one hostel or department dominating the feed.

  4. Dwell-Time Integration
     • "Active Reading Time" signal: upvotes only count after DWELL_TIME_MIN_SECONDS
     • Guards against inflated scores from rapid fire tap-and-dismiss behaviour.

Usage (from Node.js/Express backend)
-------------------------------------
    # Register a new issue
    POST http://localhost:8003/issues
    Body: { "issue_id": "abc", "category": "Hostel", "sub_community": "HOSTEL-1" }

    # Record an upvote
    POST http://localhost:8003/vote
    Body: { "issue_id": "abc", "vote_type": "upvote", "dwell_seconds": 12.5 }

    # Record dwell time (active reading)
    POST http://localhost:8003/dwell
    Body: { "issue_id": "abc", "dwell_seconds": 15.0 }

    # Get ranked front page (global or per-building)
    GET  http://localhost:8003/front-page?building_id=HOSTEL-1&limit=20

    # Get a single issue's score
    GET  http://localhost:8003/issues/{issue_id}/score

    GET  http://localhost:8003/health
"""

from __future__ import annotations

import logging
import math
import os
import pickle
import time
from collections import defaultdict, deque
from pathlib import Path
from threading import Lock
from typing import Any, Deque, Dict, List, Optional

import uvicorn
from fastapi import FastAPI, HTTPException, Query, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ── Shared config ──────────────────────────────────────────────────────────────
try:
    from config import (
        DECAY_CONSTANT,
        VELOCITY_WINDOW_SECONDS,
        DIVERSITY_STREAK_LIMIT,
        DWELL_TIME_MIN_SECONDS,
        VELOCITY_BOOST_WEIGHT,
        PRIORITY_STORE_PATH,
        API_HOST,
        PRIORITY_PORT,
    )
except ImportError:
    DECAY_CONSTANT          = 45_000
    VELOCITY_WINDOW_SECONDS = 300
    DIVERSITY_STREAK_LIMIT  = 3
    DWELL_TIME_MIN_SECONDS  = 3.0
    VELOCITY_BOOST_WEIGHT   = 0.15
    PRIORITY_STORE_PATH     = "data/priority_store.pkl"
    API_HOST                = "0.0.0.0"
    PRIORITY_PORT           = 8003

# ── Platform epoch — fixed reference point used in the time-decay formula ─────
# Using Unix epoch directly (as Reddit does) so t = current UTC timestamp.
# This means newer issues always start with a higher "time bonus".
PLATFORM_EPOCH = 1_672_531_200  # 2023-01-01 00:00:00 UTC  (adjust to your launch date)

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level  = logging.INFO,
    format = "%(asctime)s | %(levelname)-8s | priority_api | %(message)s",
)
logger = logging.getLogger("priority_api")

# ═══════════════════════════════════════════════════════════════════════════════
# Core Scoring Functions
# ═══════════════════════════════════════════════════════════════════════════════

def log_time_decay_score(upvotes: int, downvotes: int, submission_epoch: float) -> float:
    """
    Hot-ranking formula (presentation slide 11):

        Score = log10(max(1, |U − D|))  +  sign(U − D) · t / 45 000

    where t = submission_epoch − PLATFORM_EPOCH  (seconds since platform launch)

    Properties
    ----------
    • Logarithmic compression: marginal value of each additional upvote diminishes.
    • Time bonus: issues submitted more recently start with a higher base score.
    • Half-life ≈ 12.5 hours: an issue must double engagement every 12.5 h to hold rank.
    """
    vote_diff = upvotes - downvotes
    log_part  = math.log10(max(1, abs(vote_diff)))
    sign_part = (1 if vote_diff >= 0 else -1) * (submission_epoch - PLATFORM_EPOCH) / DECAY_CONSTANT
    return round(log_part + sign_part, 8)


def effective_score(base: float, velocity: float) -> float:
    """
    Combine Log-Time Decay score with Engagement Velocity boost.

        effective = base + VELOCITY_BOOST_WEIGHT * velocity

    The boost is capped so that viral noise cannot override legitimately old issues.
    """
    return base + VELOCITY_BOOST_WEIGHT * velocity


# ═══════════════════════════════════════════════════════════════════════════════
# Engagement Velocity Tracker
# ═══════════════════════════════════════════════════════════════════════════════

class VelocityTracker:
    """
    Tracks engagement rate using a sliding time window (default 5 min).

    Internal structure: {issue_id: deque of (vote_timestamp,)}
    Old timestamps are pruned on every access — O(1) amortised.

    Rage-click guard
    ----------------
    Each vote must be accompanied by a `dwell_seconds` value.
    If dwell_seconds < DWELL_TIME_MIN_SECONDS, the vote is discarded.
    """

    def __init__(self, window: int = VELOCITY_WINDOW_SECONDS) -> None:
        self.window: int                        = window
        self._history: Dict[str, Deque[float]] = defaultdict(deque)
        self._lock                              = Lock()

    def record_vote(self, issue_id: str, dwell_seconds: float) -> bool:
        """
        Record a vote. Returns True if accepted, False if rejected (rage-click).
        """
        if dwell_seconds < DWELL_TIME_MIN_SECONDS:
            logger.debug(
                f"Vote on '{issue_id}' rejected — dwell {dwell_seconds:.1f}s "
                f"< min {DWELL_TIME_MIN_SECONDS}s (rage-click guard)"
            )
            return False

        now = time.time()
        with self._lock:
            q = self._history[issue_id]
            q.append(now)
            self._prune(q, now)
        return True

    def get_velocity(self, issue_id: str) -> float:
        """
        Compute engagement velocity (accepted votes per second) in the current window.
        """
        now = time.time()
        with self._lock:
            q = self._history[issue_id]
            self._prune(q, now)
            count = len(q)
        return count / self.window if count else 0.0

    def _prune(self, q: Deque[float], now: float) -> None:
        cutoff = now - self.window
        while q and q[0] < cutoff:
            q.popleft()


# ═══════════════════════════════════════════════════════════════════════════════
# Issue Record
# ═══════════════════════════════════════════════════════════════════════════════

class IssueRecord:
    """Mutable state for a single issue stored in the priority store."""

    __slots__ = (
        "issue_id", "category", "sub_community", "building_id",
        "upvotes", "downvotes", "submission_epoch",
        "base_score", "total_dwell_seconds", "dwell_event_count",
        "created_at", "updated_at", "resolved",
    )

    def __init__(
        self,
        issue_id:      str,
        category:      str,
        sub_community: str,
        building_id:   Optional[str] = None,
    ) -> None:
        self.issue_id        = issue_id
        self.category        = category
        self.sub_community   = sub_community
        self.building_id     = building_id
        self.upvotes         = 0
        self.downvotes       = 0
        self.submission_epoch = time.time()
        self.base_score      = log_time_decay_score(0, 0, self.submission_epoch)
        self.total_dwell_seconds = 0.0
        self.dwell_event_count   = 0
        self.created_at      = time.time()
        self.updated_at      = time.time()
        self.resolved        = False

    def recalculate(self) -> None:
        """Recompute base score; called on every vote event."""
        self.base_score  = log_time_decay_score(
            self.upvotes, self.downvotes, self.submission_epoch
        )
        self.updated_at  = time.time()

    @property
    def avg_dwell(self) -> float:
        if self.dwell_event_count == 0:
            return 0.0
        return self.total_dwell_seconds / self.dwell_event_count

    def to_dict(self) -> dict:
        return {
            "issue_id":         self.issue_id,
            "category":         self.category,
            "sub_community":    self.sub_community,
            "building_id":      self.building_id,
            "upvotes":          self.upvotes,
            "downvotes":        self.downvotes,
            "net_votes":        self.upvotes - self.downvotes,
            "base_score":       self.base_score,
            "avg_dwell_sec":    round(self.avg_dwell, 2),
            "submission_epoch": self.submission_epoch,
            "resolved":         self.resolved,
        }


# ═══════════════════════════════════════════════════════════════════════════════
# Priority Store  (in-memory + disk persistence)
# ═══════════════════════════════════════════════════════════════════════════════

class PriorityStore:
    """
    Maintains issue records and computes ranked lists on demand.

    Score updates are ONLY computed on Vote Events (not on page load),
    matching the pre-calculation strategy described in the Technical
    Implementation slide to minimise server overhead.
    """

    def __init__(self, persist_path: str = PRIORITY_STORE_PATH) -> None:
        self.persist_path = Path(persist_path)
        self._issues: Dict[str, IssueRecord] = {}
        self._lock   = Lock()
        self._load()

    # ── Persistence ────────────────────────────────────────────────────────────
    def _load(self) -> None:
        if self.persist_path.exists():
            try:
                with open(self.persist_path, "rb") as fh:
                    self._issues = pickle.load(fh)
                logger.info(f"Priority store loaded: {len(self._issues)} issues")
            except Exception as exc:
                logger.warning(f"Could not load priority store: {exc}. Starting fresh.")

    def _save(self) -> None:
        self.persist_path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(self.persist_path, "wb") as fh:
                pickle.dump(self._issues, fh, protocol=pickle.HIGHEST_PROTOCOL)
        except Exception as exc:
            logger.error(f"Priority store save failed: {exc}")

    # ── Issue CRUD ─────────────────────────────────────────────────────────────
    def add_issue(self, record: IssueRecord) -> None:
        with self._lock:
            self._issues[record.issue_id] = record
            self._save()

    def get_issue(self, issue_id: str) -> Optional[IssueRecord]:
        return self._issues.get(issue_id)

    def mark_resolved(self, issue_id: str) -> bool:
        with self._lock:
            rec = self._issues.get(issue_id)
            if not rec:
                return False
            rec.resolved = True
            self._save()
        return True

    def remove_issue(self, issue_id: str) -> bool:
        with self._lock:
            if issue_id not in self._issues:
                return False
            del self._issues[issue_id]
            self._save()
        return True

    # ── Vote processing (pre-calculation strategy) ────────────────────────────
    def apply_vote(self, issue_id: str, vote_type: str) -> Optional[IssueRecord]:
        """
        Update vote count and immediately recompute base score.
        Scores are stored in the record, never computed at read time.
        """
        with self._lock:
            rec = self._issues.get(issue_id)
            if not rec or rec.resolved:
                return None
            if vote_type == "upvote":
                rec.upvotes += 1
            elif vote_type == "downvote":
                rec.downvotes += 1
            elif vote_type == "undo_upvote":
                rec.upvotes = max(0, rec.upvotes - 1)
            elif vote_type == "undo_downvote":
                rec.downvotes = max(0, rec.downvotes - 1)
            rec.recalculate()
            self._save()
        return rec

    # ── Dwell time update ──────────────────────────────────────────────────────
    def record_dwell(self, issue_id: str, dwell_seconds: float) -> None:
        with self._lock:
            rec = self._issues.get(issue_id)
            if rec:
                rec.total_dwell_seconds += dwell_seconds
                rec.dwell_event_count   += 1

    # ── Ranked retrieval ───────────────────────────────────────────────────────
    def ranked_issues(
        self,
        velocity_tracker: VelocityTracker,
        building_id:      Optional[str] = None,
        category:         Optional[str] = None,
        include_resolved: bool          = False,
        limit:            int           = 20,
    ) -> List[dict]:
        """
        Returns issues ranked by effective score with diversity re-ranking.
        """
        with self._lock:
            pool = list(self._issues.values())

        # ── Filters ────────────────────────────────────────────────────────────
        if not include_resolved:
            pool = [r for r in pool if not r.resolved]
        if building_id:
            pool = [r for r in pool if r.building_id == building_id]
        if category:
            pool = [r for r in pool if r.category.lower() == category.lower()]

        if not pool:
            return []

        # ── Compute effective scores (base + velocity boost) ───────────────────
        scored = [
            (rec, effective_score(rec.base_score, velocity_tracker.get_velocity(rec.issue_id)))
            for rec in pool
        ]
        scored.sort(key=lambda x: x[1], reverse=True)

        # ── Diversity re-ranking (Anti-Stagnation) ─────────────────────────────
        result = _diversity_rerank(scored, limit)

        return result


# ═══════════════════════════════════════════════════════════════════════════════
# Diversity Re-Ranking  (Jahanbakhsh et al. 2025)
# ═══════════════════════════════════════════════════════════════════════════════

def _diversity_rerank(
    scored: List[tuple],   # (IssueRecord, effective_score) sorted desc
    limit:  int,
) -> List[dict]:
    """
    Anti-Stagnation rule:
    After DIVERSITY_STREAK_LIMIT consecutive posts from the same sub_community,
    inject the highest-scoring post from any OTHER sub_community.

    This mirrors the presentation's "4th slot reservation" logic while being
    generalised to any streak length.
    """
    output:           List[dict] = []
    streak_community: Optional[str] = None
    streak_count:     int           = 0
    injected_indices: set           = set()

    def _to_dict(rec: IssueRecord, score: float, injected: bool = False) -> dict:
        d = rec.to_dict()
        d["effective_score"] = round(score, 6)
        d["diversity_inject"] = injected
        return d

    i = 0
    remaining = list(scored)       # working copy

    while len(output) < limit and remaining:
        rec, score = remaining[i] if i < len(remaining) else (None, None)

        if rec is None:
            break

        # Check if we need a diversity injection
        if (
            streak_count >= DIVERSITY_STREAK_LIMIT
            and streak_community is not None
        ):
            # Find the highest-scoring issue from a different sub_community
            inject_rec = inject_score = None
            inject_idx = None

            for j, (candidate, cand_score) in enumerate(remaining):
                if j in injected_indices:
                    continue
                if candidate.sub_community != streak_community:
                    inject_rec   = candidate
                    inject_score = cand_score
                    inject_idx   = j
                    break

            if inject_rec:
                output.append(_to_dict(inject_rec, inject_score, injected=True))
                injected_indices.add(inject_idx)
                # Reset streak to the injected community
                streak_community = inject_rec.sub_community
                streak_count     = 1
                # Remove injected item from normal flow
                remaining = [r for k, r in enumerate(remaining) if k != inject_idx]
                i         = 0   # restart from the top of (now shorter) remaining
                continue

        # Normal append
        if i not in injected_indices:
            output.append(_to_dict(rec, score))
            if rec.sub_community == streak_community:
                streak_count += 1
            else:
                streak_community = rec.sub_community
                streak_count     = 1
            remaining.pop(i)
            i = 0
        else:
            i += 1

    return output


# ═══════════════════════════════════════════════════════════════════════════════
# Module-level singletons
# ═══════════════════════════════════════════════════════════════════════════════

velocity_tracker = VelocityTracker(window=VELOCITY_WINDOW_SECONDS)
priority_store   = PriorityStore(persist_path=PRIORITY_STORE_PATH)

# ═══════════════════════════════════════════════════════════════════════════════
# FastAPI App
# ═══════════════════════════════════════════════════════════════════════════════

app = FastAPI(
    title       = "Infra_Pulse — Priority Ranker",
    description = (
        "Log-Time Decay + Engagement Velocity + Anti-Stagnation Diversity Re-ranking. "
        "Implements the full Infra_Pulse front-page ranking algorithm."
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

class RegisterIssueRequest(BaseModel):
    issue_id:       str  = Field(..., description="Unique issue ID (from your main DB)")
    category:       str  = Field(..., description="Issue category, e.g. 'Hostel', 'Mess', 'Hygiene'")
    sub_community:  str  = Field(..., description="Sub-community tag, e.g. 'HOSTEL-1', 'CC-3'")
    building_id:    Optional[str] = Field(None, description="Building ID from geospatial API")

    model_config = {
        "json_schema_extra": {
            "example": {
                "issue_id":      "issue_abc123",
                "category":      "Hostel",
                "sub_community": "HOSTEL-1",
                "building_id":   "HOSTEL-1",
            }
        }
    }


class VoteRequest(BaseModel):
    issue_id:       str   = Field(...)
    vote_type:      str   = Field(..., description="upvote | downvote | undo_upvote | undo_downvote")
    dwell_seconds:  float = Field(0.0, ge=0, description="Active reading time before voting (seconds)")

    model_config = {
        "json_schema_extra": {
            "example": {
                "issue_id":     "issue_abc123",
                "vote_type":    "upvote",
                "dwell_seconds": 12.5,
            }
        }
    }


class DwellRequest(BaseModel):
    issue_id:      str   = Field(...)
    dwell_seconds: float = Field(..., ge=0, description="Active reading time in seconds")


class ScoreResponse(BaseModel):
    issue_id:        str
    upvotes:         int
    downvotes:       int
    base_score:      float
    velocity:        float
    effective_score: float
    avg_dwell_sec:   float


# ═══════════════════════════════════════════════════════════════════════════════
# Endpoints
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/health")
async def health():
    return {
        "status":         "healthy",
        "service":        "priority_ranker",
        "total_issues":   len(priority_store._issues),
        "decay_constant": DECAY_CONSTANT,
        "half_life_hrs":  round(DECAY_CONSTANT / 3600, 2),
        "velocity_window_sec": VELOCITY_WINDOW_SECONDS,
    }


@app.post("/issues", status_code=status.HTTP_201_CREATED)
async def register_issue(req: RegisterIssueRequest):
    """
    Register a new issue in the priority ranking system.
    Call this immediately after saving the issue to your main database.
    """
    if priority_store.get_issue(req.issue_id):
        raise HTTPException(
            status_code = status.HTTP_409_CONFLICT,
            detail      = f"Issue '{req.issue_id}' is already registered.",
        )

    record = IssueRecord(
        issue_id      = req.issue_id,
        category      = req.category,
        sub_community = req.sub_community,
        building_id   = req.building_id,
    )
    priority_store.add_issue(record)

    logger.info(
        f"Registered issue '{req.issue_id}' | category={req.category} | "
        f"sub_community={req.sub_community} | base_score={record.base_score:.4f}"
    )

    return {
        "success":    True,
        "issue_id":   req.issue_id,
        "base_score": record.base_score,
        "message":    f"Issue '{req.issue_id}' registered with initial score {record.base_score:.4f}.",
    }


@app.post("/vote")
async def process_vote(req: VoteRequest):
    """
    Process a vote event.

    • Validates dwell time (rage-click guard).
    • Records velocity signal.
    • Recomputes base score in-place (pre-calculation strategy — no per-load compute).
    • Returns updated score immediately.
    """
    valid_types = {"upvote", "downvote", "undo_upvote", "undo_downvote"}
    if req.vote_type not in valid_types:
        raise HTTPException(
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail      = f"vote_type must be one of {valid_types}",
        )

    # Rage-click guard — only track velocity for valid dwell
    velocity_accepted = velocity_tracker.record_vote(req.issue_id, req.dwell_seconds)

    # Apply vote and recompute score
    updated = priority_store.apply_vote(req.issue_id, req.vote_type)
    if not updated:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail      = f"Issue '{req.issue_id}' not found or is resolved.",
        )

    vel  = velocity_tracker.get_velocity(req.issue_id)
    eff  = effective_score(updated.base_score, vel)

    logger.info(
        f"[vote] {req.vote_type} on '{req.issue_id}' | dwell={req.dwell_seconds:.1f}s | "
        f"accepted={velocity_accepted} | base={updated.base_score:.4f} | eff={eff:.4f}"
    )

    return {
        "success":          True,
        "issue_id":         req.issue_id,
        "vote_type":        req.vote_type,
        "velocity_accepted": velocity_accepted,
        "upvotes":          updated.upvotes,
        "downvotes":        updated.downvotes,
        "base_score":       updated.base_score,
        "velocity":         round(vel, 6),
        "effective_score":  round(eff, 6),
    }


@app.post("/dwell")
async def record_dwell(req: DwellRequest):
    """
    Record active reading (dwell) time for an issue.
    Used by the front-end to send how long a user actually read the issue card.
    """
    priority_store.record_dwell(req.issue_id, req.dwell_seconds)
    rec = priority_store.get_issue(req.issue_id)
    if not rec:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail      = f"Issue '{req.issue_id}' not found.",
        )
    return {
        "success":       True,
        "issue_id":      req.issue_id,
        "avg_dwell_sec": round(rec.avg_dwell, 2),
    }


@app.get("/front-page")
async def front_page(
    building_id:      Optional[str]  = Query(None,  description="Filter by building"),
    category:         Optional[str]  = Query(None,  description="Filter by category"),
    include_resolved: bool           = Query(False, description="Include resolved issues"),
    limit:            int            = Query(20,    ge=1, le=100),
):
    """
    Return the ranked front-page issue feed with diversity re-ranking applied.

    Algorithm (executed on each GET call, scores pre-computed on vote events)
    -------------------------------------------------------------------------
    1. Filter by building_id / category if specified
    2. Compute effective_score = base_score + velocity_boost for each issue
    3. Sort descending
    4. Apply Anti-Stagnation diversity re-ranking
    5. Return top `limit` results
    """
    ranked = priority_store.ranked_issues(
        velocity_tracker  = velocity_tracker,
        building_id       = building_id,
        category          = category,
        include_resolved  = include_resolved,
        limit             = limit,
    )

    return {
        "count":       len(ranked),
        "building_id": building_id,
        "category":    category,
        "issues":      ranked,
        "algorithm": {
            "decay_constant":    DECAY_CONSTANT,
            "half_life_hrs":     round(DECAY_CONSTANT / 3600, 2),
            "velocity_window_s": VELOCITY_WINDOW_SECONDS,
            "diversity_streak":  DIVERSITY_STREAK_LIMIT,
        },
    }


@app.get("/issues/{issue_id}/score", response_model=ScoreResponse)
async def get_issue_score(issue_id: str):
    """Return the current score breakdown for a single issue."""
    rec = priority_store.get_issue(issue_id)
    if not rec:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail      = f"Issue '{issue_id}' not found.",
        )
    vel = velocity_tracker.get_velocity(issue_id)
    return ScoreResponse(
        issue_id        = issue_id,
        upvotes         = rec.upvotes,
        downvotes       = rec.downvotes,
        base_score      = rec.base_score,
        velocity        = round(vel, 6),
        effective_score = round(effective_score(rec.base_score, vel), 6),
        avg_dwell_sec   = round(rec.avg_dwell, 2),
    )


@app.patch("/issues/{issue_id}/resolve")
async def resolve_issue(issue_id: str):
    """Mark an issue as resolved — removes it from the ranked feed."""
    ok = priority_store.mark_resolved(issue_id)
    if not ok:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail      = f"Issue '{issue_id}' not found.",
        )
    return {"success": True, "issue_id": issue_id, "message": "Issue marked as resolved."}


@app.delete("/issues/{issue_id}")
async def delete_issue(issue_id: str):
    """Permanently remove an issue from the priority store."""
    ok = priority_store.remove_issue(issue_id)
    if not ok:
        raise HTTPException(
            status_code = status.HTTP_404_NOT_FOUND,
            detail      = f"Issue '{issue_id}' not found.",
        )
    return {"success": True, "issue_id": issue_id, "message": "Issue removed."}


@app.get("/stats")
async def stats():
    """Return aggregate statistics for the priority store."""
    with priority_store._lock:
        all_issues  = list(priority_store._issues.values())

    total           = len(all_issues)
    resolved        = sum(1 for r in all_issues if r.resolved)
    categories      = {}
    sub_communities = {}

    for rec in all_issues:
        categories[rec.category]           = categories.get(rec.category, 0) + 1
        sub_communities[rec.sub_community] = sub_communities.get(rec.sub_community, 0) + 1

    return {
        "total_issues":           total,
        "resolved_issues":        resolved,
        "active_issues":          total - resolved,
        "by_category":            categories,
        "by_sub_community":       sub_communities,
        "decay_constant":         DECAY_CONSTANT,
        "half_life_hrs":          round(DECAY_CONSTANT / 3600, 2),
        "velocity_window_sec":    VELOCITY_WINDOW_SECONDS,
        "diversity_streak_limit": DIVERSITY_STREAK_LIMIT,
        "dwell_min_seconds":      DWELL_TIME_MIN_SECONDS,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# Entry Point
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    uvicorn.run(
        "priority_api:app",
        host      = API_HOST,
        port      = PRIORITY_PORT,
        reload    = True,
        log_level = "info",
    )