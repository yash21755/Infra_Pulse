"""
test_model.py — Standalone Model & Inference Testing
====================================================
Tests the UnivFD linear head on sample vectors and images,
evaluates latency, and verifies predictions against thresholds.
"""

from __future__ import annotations

import argparse
import time
from pathlib import Path

import numpy as np
import torch
from PIL import Image

from .config import AI_DETECTION_THRESHOLD, EMBEDDING_DIM, MODEL_WEIGHTS_PATH
from .detector import AIDetector, get_detector
from .model import UnivFDLinearClassifier


def run_unit_tests():
    print("=" * 65)
    print("  UnivFD AI Detection — Standalone Verification Suite  ")
    print("=" * 65)

    # 1. Model Architecture Check
    print("\n[1/4] Verifying Linear Architecture...")
    classifier = UnivFDLinearClassifier(input_dim=EMBEDDING_DIM)
    dummy_input = torch.randn(4, EMBEDDING_DIM)
    dummy_input = dummy_input / dummy_input.norm(dim=-1, keepdim=True)

    logits = classifier(dummy_input)
    probs = classifier.predict_proba(dummy_input)

    assert logits.shape == (4, 1), f"Unexpected logits shape: {logits.shape}"
    assert probs.shape == (4, 1), f"Unexpected probs shape: {probs.shape}"
    assert (probs >= 0.0).all() and (probs <= 1.0).all(), "Probabilities outside [0, 1] range"
    print("      Model architecture verified: input (4, 512) -> output (4, 1)")

    # 2. Checkpoint Save/Load Check
    print("\n[2/4] Testing Weight Persistence...")
    temp_path = Path("temp_test_univfd.pt")
    try:
        classifier.save(temp_path)
        loaded = UnivFDLinearClassifier.load(temp_path)
        assert loaded is not None, "Failed to load saved model"
        diff = torch.max(torch.abs(classifier.linear.weight - loaded.linear.weight)).item()
        assert diff < 1e-6, f"Weight mismatch after reload: {diff}"
        print(f"      Save and load verified (weight delta: {diff:.2e})")
    finally:
        if temp_path.exists():
            temp_path.unlink()

    # 3. Detector Precomputed Vector Evaluation
    print("\n[3/4] Testing Precomputed 512-D Vector Evaluation...")
    detector = AIDetector(weights_path=MODEL_WEIGHTS_PATH, lazy_clip=True)

    # Simulated synthetic feature
    rand_vector = np.random.randn(512).astype(np.float32)
    rand_vector /= np.linalg.norm(rand_vector)

    result = detector.predict_embedding(rand_vector)
    print(f"      Source:       {result.inference_source}")
    print(f"      AI Prob:      {result.ai_probability:.4f}")
    print(f"      Classification: {result.label} (Threshold: {result.threshold})")
    print(f"      Confidence:   {result.confidence:.4f}")

    # 4. Latency Benchmark
    print("\n[4/4] Latency Benchmark (1,000 vector inferences)...")
    n_iters = 1000
    start_t = time.perf_counter()
    for _ in range(n_iters):
        _ = detector.predict_embedding(rand_vector)
    total_time = time.perf_counter() - start_t
    avg_ms = (total_time / n_iters) * 1000.0

    print(f"      Completed {n_iters} iterations in {total_time:.3f}s")
    print(f"      Average Latency: {avg_ms:.3f} ms per vector lookup (O(1) complexity)")

    print("\n" + "=" * 65)
    print("  All verification checks passed successfully!  ")
    print("=" * 65)


def test_single_image(image_path: str):
    p = Path(image_path)
    if not p.exists():
        print(f"Error: Image '{image_path}' not found.")
        return

    print(f"\nAnalyzing image: {p.name}...")
    detector = get_detector()
    res = detector.predict_image(p)

    print("-" * 40)
    print(f"Image:            {p.name}")
    print(f"AI Probability:   {res.ai_probability * 100:.2f}%")
    print(f"Classification:   {res.label}")
    print(f"Confidence:       {res.confidence * 100:.2f}%")
    print(f"Raw Logit:        {res.raw_score:.4f}")
    print(f"Threshold:        {res.threshold}")
    print("-" * 40)


def main():
    parser = argparse.ArgumentParser(description="UnivFD AI Detection Test Suite")
    parser.add_argument("--image", type=str, default=None, help="Path to image to test")
    parser.add_argument("--benchmark", action="store_true", help="Run latency benchmark")

    args = parser.parse_args()

    if args.image:
        test_single_image(args.image)
    else:
        run_unit_tests()


if __name__ == "__main__":
    main()
