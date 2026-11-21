"""
train.py — UnivFD Linear Head Training Script
=============================================
Trains the 512 -> 1 linear classifier on binary labels:
0 = Real / Authentic Camera Image
1 = Synthetic / AI-Generated Image

Supports:
- Image folders (--real_dir and --fake_dir)
- Pre-extracted feature tensors/arrays (--features_file and --labels_file)
- Synthetic verification mode (--synthetic) for pipeline testing
"""

from __future__ import annotations

import argparse
import logging
import random
from pathlib import Path
from typing import List, Tuple

import numpy as np
import torch
import torch.nn as nn
from PIL import Image
from sklearn.metrics import accuracy_score, f1_score, precision_score, recall_score, roc_auc_score
from torch.utils.data import DataLoader, Dataset
from transformers import CLIPModel, CLIPProcessor

from .config import (
    CLIP_MODEL_NAME,
    DEFAULT_BATCH_SIZE,
    DEFAULT_EPOCHS,
    DEFAULT_LEARNING_RATE,
    DEFAULT_VAL_SPLIT,
    DEFAULT_WEIGHT_DECAY,
    DEVICE,
    EMBEDDING_DIM,
    MODEL_WEIGHTS_PATH,
)
from .model import UnivFDLinearClassifier

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | univfd_train | %(message)s",
)
logger = logging.getLogger("univfd_train")


# ═══════════════════════════════════════════════════════════════════════════════
# Datasets
# ═══════════════════════════════════════════════════════════════════════════════

class FeatureDataset(Dataset):
    """Dataset serving pre-extracted 512-D L2-normalized feature embeddings."""

    def __init__(self, features: torch.Tensor, labels: torch.Tensor) -> None:
        self.features = features
        self.labels = labels

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, idx: int) -> Tuple[torch.Tensor, torch.Tensor]:
        return self.features[idx], self.labels[idx]


def extract_features_from_images(
    image_paths: List[Path],
    batch_size: int = 32,
    device: str = DEVICE,
) -> torch.Tensor:
    """Extracts 512-D normalized CLIP vision embeddings in mini-batches."""
    logger.info(f"Loading CLIP model '{CLIP_MODEL_NAME}' for batch feature extraction...")
    processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
    model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(device)
    model.eval()

    all_embeddings: List[torch.Tensor] = []

    for i in range(0, len(image_paths), batch_size):
        batch_paths = image_paths[i : i + batch_size]
        pil_images = []
        for p in batch_paths:
            try:
                pil_images.append(Image.open(p).convert("RGB"))
            except Exception as e:
                logger.warning(f"Skipping corrupted image {p}: {e}")

        if not pil_images:
            continue

        with torch.no_grad():
            inputs = processor(images=pil_images, return_tensors="pt").to(device)
            feats = model.get_image_features(**inputs)
            if not isinstance(feats, torch.Tensor):
                feats = getattr(feats, "image_embeds", getattr(feats, "pooler_output", feats[0]))
            # L2 normalise
            feats = feats / feats.norm(dim=-1, keepdim=True)
            all_embeddings.append(feats.cpu())

    return torch.cat(all_embeddings, dim=0)


def generate_synthetic_features(n_samples: int = 500) -> Tuple[torch.Tensor, torch.Tensor]:
    """Generates synthetic 512-D vectors for pipeline validation and testing."""
    logger.info(f"Generating {n_samples} synthetic 512-D features (50% Real, 50% AI)...")
    torch.manual_seed(42)
    np.random.seed(42)

    half = n_samples // 2
    # Simulated Real: centroid 1 with random perturbation
    c_real = torch.randn(1, EMBEDDING_DIM)
    c_real = c_real / c_real.norm(dim=-1, keepdim=True)
    real_feats = c_real + 0.35 * torch.randn(half, EMBEDDING_DIM)
    real_feats = real_feats / real_feats.norm(dim=-1, keepdim=True)
    real_labels = torch.zeros(half, 1)

    # Simulated AI: centroid 2 with generative perturbation
    c_ai = torch.randn(1, EMBEDDING_DIM)
    c_ai = c_ai / c_ai.norm(dim=-1, keepdim=True)
    ai_feats = c_ai + 0.35 * torch.randn(n_samples - half, EMBEDDING_DIM)
    ai_feats = ai_feats / ai_feats.norm(dim=-1, keepdim=True)
    ai_labels = torch.ones(n_samples - half, 1)

    feats = torch.cat([real_feats, ai_feats], dim=0)
    labels = torch.cat([real_labels, ai_labels], dim=0)

    # Shuffle
    perm = torch.randperm(feats.size(0))
    return feats[perm], labels[perm]


# ═══════════════════════════════════════════════════════════════════════════════
# Trainer
# ═══════════════════════════════════════════════════════════════════════════════

def train_univfd_head(
    features: torch.Tensor,
    labels: torch.Tensor,
    epochs: int = DEFAULT_EPOCHS,
    batch_size: int = DEFAULT_BATCH_SIZE,
    learning_rate: float = DEFAULT_LEARNING_RATE,
    weight_decay: float = DEFAULT_WEIGHT_DECAY,
    val_split: float = DEFAULT_VAL_SPLIT,
    output_path: Path = MODEL_WEIGHTS_PATH,
    device: str = DEVICE,
) -> UnivFDLinearClassifier:
    """Trains the UnivFD linear head with early stopping and metrics logging."""
    total_samples = len(labels)
    val_size = int(total_samples * val_split)
    train_size = total_samples - val_size

    train_feats, val_feats = features[:train_size], features[train_size:]
    train_labels, val_labels = labels[:train_size], labels[train_size:]

    train_loader = DataLoader(
        FeatureDataset(train_feats, train_labels),
        batch_size=batch_size,
        shuffle=True,
    )

    model = UnivFDLinearClassifier(input_dim=EMBEDDING_DIM).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(model.parameters(), lr=learning_rate, weight_decay=weight_decay)

    logger.info(
        f"Starting UnivFD training on {device} | Train size: {train_size} | "
        f"Val size: {val_size} | Epochs: {epochs} | Batch size: {batch_size}"
    )

    best_val_auc = -1.0
    best_weights = None

    for epoch in range(1, epochs + 1):
        model.train()
        epoch_loss = 0.0

        for x_b, y_b in train_loader:
            x_b, y_b = x_b.to(device), y_b.to(device)
            optimizer.zero_grad()
            logits = model(x_b)
            loss = criterion(logits, y_b)
            loss.backward()
            optimizer.step()
            epoch_loss += loss.item() * len(y_b)

        epoch_loss /= train_size

        # Evaluation on validation set
        model.eval()
        with torch.no_grad():
            val_logits = model(val_feats.to(device))
            val_loss = criterion(val_logits, val_labels.to(device)).item()
            val_probs = torch.sigmoid(val_logits).cpu().numpy().flatten()
            y_true = val_labels.cpu().numpy().flatten()
            y_pred = (val_probs >= 0.5).astype(int)

            acc = accuracy_score(y_true, y_pred)
            f1 = f1_score(y_true, y_pred, zero_division=0)
            try:
                auc = roc_auc_score(y_true, val_probs)
            except ValueError:
                auc = 0.5

        logger.info(
            f"Epoch {epoch:02d}/{epochs:02d} | Train Loss: {epoch_loss:.4f} | "
            f"Val Loss: {val_loss:.4f} | Val Acc: {acc:.4f} | F1: {f1:.4f} | AUC: {auc:.4f}"
        )

        if auc > best_val_auc:
            best_val_auc = auc
            best_weights = model.state_dict().copy()

    # Load best checkpoint
    if best_weights is not None:
        model.load_state_dict(best_weights)

    # Persist trained model
    output_path.parent.mkdir(parents=True, exist_ok=True)
    model.save(output_path)
    logger.info(f"Model saved successfully to '{output_path}' (Best Val AUC: {best_val_auc:.4f})")

    return model


def main():
    parser = argparse.ArgumentParser(description="Train UnivFD Linear Classifier for AI Image Detection")
    parser.add_argument("--real_dir", type=str, default=None, help="Directory containing authentic real images")
    parser.add_argument("--fake_dir", type=str, default=None, help="Directory containing synthetic AI images")
    parser.add_argument("--features_file", type=str, default=None, help="Path to precomputed features .npy or .pt")
    parser.add_argument("--labels_file", type=str, default=None, help="Path to precomputed labels .npy or .pt")
    parser.add_argument("--synthetic", action="store_true", help="Train on synthetic benchmark data (for testing)")
    parser.add_argument("--epochs", type=int, default=DEFAULT_EPOCHS)
    parser.add_argument("--batch_size", type=int, default=DEFAULT_BATCH_SIZE)
    parser.add_argument("--lr", type=float, default=DEFAULT_LEARNING_RATE)
    parser.add_argument("--output", type=str, default=str(MODEL_WEIGHTS_PATH))

    args = parser.parse_args()

    if args.synthetic or (not args.real_dir and not args.features_file):
        logger.info("No external dataset provided. Running in synthetic benchmark mode.")
        feats, labels = generate_synthetic_features(n_samples=600)
    elif args.features_file and args.labels_file:
        logger.info(f"Loading precomputed features from {args.features_file}...")
        feats = torch.load(args.features_file) if args.features_file.endswith(".pt") else torch.from_numpy(np.load(args.features_file)).float()
        labels = torch.load(args.labels_file) if args.labels_file.endswith(".pt") else torch.from_numpy(np.load(args.labels_file)).float()
    elif args.real_dir and args.fake_dir:
        real_p = list(Path(args.real_dir).glob("*.[jJ][pP][gG]")) + list(Path(args.real_dir).glob("*.[pP][nN][gG]"))
        fake_p = list(Path(args.fake_dir).glob("*.[jJ][pP][gG]")) + list(Path(args.fake_dir).glob("*.[pP][nN][gG]"))
        logger.info(f"Found {len(real_p)} real images and {len(fake_p)} AI images.")

        real_feats = extract_features_from_images(real_p)
        fake_feats = extract_features_from_images(fake_p)

        feats = torch.cat([real_feats, fake_feats], dim=0)
        labels = torch.cat([torch.zeros(len(real_p), 1), torch.ones(len(fake_p), 1)], dim=0)
    else:
        logger.error("Invalid arguments. Provide --real_dir and --fake_dir, or use --synthetic.")
        return

    train_univfd_head(
        features=feats,
        labels=labels,
        epochs=args.epochs,
        batch_size=args.batch_size,
        learning_rate=args.lr,
        output_path=Path(args.output),
    )


if __name__ == "__main__":
    main()
