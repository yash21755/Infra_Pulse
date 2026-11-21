"""
ai_detection package — Universal Fake Detection (UnivFD) for Infra_Pulse
========================================================================
A lightweight AI-generated image detection module based on UnivFD (Ojha et al., CVPR 2023).
Uses frozen pre-trained CLIP features coupled with a trained linear probe.
"""

from .config import (
    AI_DETECTION_THRESHOLD,
    CLIP_MODEL_NAME,
    DEVICE,
    EMBEDDING_DIM,
    MODEL_WEIGHTS_PATH,
)
from .detector import AIDetector, DetectionResult, get_detector
from .model import UnivFDLinearClassifier

__all__ = [
    "UnivFDLinearClassifier",
    "AIDetector",
    "DetectionResult",
    "get_detector",
    "MODEL_WEIGHTS_PATH",
    "CLIP_MODEL_NAME",
    "EMBEDDING_DIM",
    "AI_DETECTION_THRESHOLD",
    "DEVICE",
]
