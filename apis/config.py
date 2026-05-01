"""
config.py — Infra_Pulse Shared Configuration
Centralises all tuneable parameters; override any value via environment variables.
"""

import os
from pathlib import Path

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE_DIR    = Path(__file__).parent
DATA_DIR    = BASE_DIR / "data"
MODELS_DIR  = BASE_DIR / "models"

DATA_DIR.mkdir(exist_ok=True)
MODELS_DIR.mkdir(exist_ok=True)

# ── Service Ports ──────────────────────────────────────────────────────────────
GEOSPATIAL_PORT  = int(os.getenv("GEOSPATIAL_PORT",  "8001"))
REDUNDANCY_PORT  = int(os.getenv("REDUNDANCY_PORT",  "8002"))
PRIORITY_PORT    = int(os.getenv("PRIORITY_PORT",    "8003"))
API_HOST         = os.getenv("API_HOST", "0.0.0.0")

# ── Geospatial ─────────────────────────────────────────────────────────────────
# Path to campus building polygons JSON (see buildings.json)
CAMPUS_BUILDINGS_CONFIG  = os.getenv(
    "CAMPUS_BUILDINGS_CONFIG", str(BASE_DIR / "buildings.json")
)
# Max metres from a polygon boundary to still count as "approximate match"
NEAREST_BUILDING_THRESHOLD_DEGREES = float(
    os.getenv("NEAREST_BUILDING_THRESHOLD_DEGREES", "0.0009")  # ≈ 100m
)

# ── Redundancy / Embedding ─────────────────────────────────────────────────────
# HuggingFace CLIP model — handles both vision and text in one unified space
CLIP_MODEL_NAME   = os.getenv("CLIP_MODEL_NAME", "openai/clip-vit-base-patch32")
EMBEDDING_DIM     = 512          # CLIP output dim per modality
FUSED_DIM         = EMBEDDING_DIM * 2  # After concat: 1024

# Similarity threshold above which an issue is flagged as REDUNDANT
# 0.85 as specified in the presentation
REDUNDANCY_THRESHOLD = float(os.getenv("REDUNDANCY_THRESHOLD", "0.85"))

# Weights for the weighted cosine fallback (when MLP weights are absent)
# Image tends to be noisier; text captures intent more reliably
VISUAL_WEIGHT = float(os.getenv("VISUAL_WEIGHT", "0.40"))
TEXT_WEIGHT   = float(os.getenv("TEXT_WEIGHT",   "0.60"))

# Path to optional pre-trained coupling-network weights (PyTorch .pt file)
# Leave blank to use weighted-cosine fallback (works out of the box)
COUPLING_NETWORK_WEIGHTS = os.getenv(
    "COUPLING_NETWORK_WEIGHTS", str(MODELS_DIR / "coupling_network.pt")
)

# File where issue embeddings are persisted between restarts
VECTOR_STORE_PATH = os.getenv(
    "VECTOR_STORE_PATH", str(DATA_DIR / "vector_store.pkl")
)

# ── Priority Ranking ───────────────────────────────────────────────────────────
# Log-Time Decay constant (seconds).  45 000 s ≈ 12.5-hour half-life (from paper)
DECAY_CONSTANT = int(os.getenv("DECAY_CONSTANT", "45000"))

# Engagement Velocity — sliding-window duration in seconds
VELOCITY_WINDOW_SECONDS = int(os.getenv("VELOCITY_WINDOW_SECONDS", "300"))  # 5 min

# Anti-Stagnation: after this many consecutive posts from the same sub-community,
# inject a post from a different category
DIVERSITY_STREAK_LIMIT = int(os.getenv("DIVERSITY_STREAK_LIMIT", "3"))

# Dwell-time gate (seconds).  Votes registered faster than this are ignored
# as "rage-clicks" and excluded from velocity calculation.
DWELL_TIME_MIN_SECONDS = float(os.getenv("DWELL_TIME_MIN_SECONDS", "3.0"))

# Velocity boost multiplier added to the final score
VELOCITY_BOOST_WEIGHT = float(os.getenv("VELOCITY_BOOST_WEIGHT", "0.15"))

# File where priority store is persisted between restarts
PRIORITY_STORE_PATH = os.getenv(
    "PRIORITY_STORE_PATH", str(DATA_DIR / "priority_store.pkl")
)