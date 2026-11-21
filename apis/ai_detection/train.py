import io
import os
import random

import torch
import torch.nn as nn
from PIL import Image, ImageFilter
from torch.utils.data import DataLoader
from torchvision import datasets
from transformers import CLIPModel, CLIPProcessor

from config import CLIP_MODEL_NAME, EMBEDDING_DIM, WEIGHTS_DIR, WEIGHTS_PATH
from model import UnivFDHead


class SmartphoneUploadAugment:
    """
    Simulates real-world mobile uploads (compression, motion/focus blur, and resizing)
    so the UnivFD linear head doesn't overfit to clean dataset artifacts.
    """
    def __init__(
        self,
        blur_prob: float = 0.5,
        blur_radius_range: tuple = (0.5, 2.0),
        jpeg_prob: float = 0.5,
        jpeg_quality_range: tuple = (40, 90),
        resize_prob: float = 0.3,
        scale_range: tuple = (0.5, 0.85),
    ):
        self.blur_prob = blur_prob
        self.blur_radius_range = blur_radius_range
        self.jpeg_prob = jpeg_prob
        self.jpeg_quality_range = jpeg_quality_range
        self.resize_prob = resize_prob
        self.scale_range = scale_range

    def __call__(self, img: Image.Image) -> Image.Image:
        img = img.convert("RGB")

        # 1. Random downscaling (simulates mobile browser/app resizing)
        if random.random() < self.resize_prob:
            w, h = img.size
            scale = random.uniform(*self.scale_range)
            new_w, new_h = max(32, int(w * scale)), max(32, int(h * scale))
            img = img.resize((new_w, new_h), Image.BILINEAR)

        # 2. Random Gaussian blur (simulates hurried camera shake or low-light focus miss)
        if random.random() < self.blur_prob:
            radius = random.uniform(*self.blur_radius_range)
            img = img.filter(ImageFilter.GaussianBlur(radius=radius))

        # 3. Random JPEG compression (simulates web/WhatsApp/upload compression)
        if random.random() < self.jpeg_prob:
            quality = random.randint(*self.jpeg_quality_range)
            buffer = io.BytesIO()
            img.save(buffer, format="JPEG", quality=quality)
            buffer.seek(0)
            img = Image.open(buffer).convert("RGB")

        return img


def collate_fn(batch):
    images, labels = zip(*batch)
    return list(images), torch.tensor(labels, dtype=torch.float32)


def train(
    data_dir: str = "dataset/train",
    epochs: int = 10,
    batch_size: int = 32,
    lr: float = 1e-3,
    num_workers: int = 2,
):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Training UnivFD head on {device}...")

    # 1. Load frozen CLIP Vision Encoder
    processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
    clip_model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(device)
    clip_model.eval()
    for param in clip_model.parameters():
        param.requires_grad = False

    # 2. Load dataset with smartphone-upload augmentations
    # Expects subfolders: real/ and fake/
    augment = SmartphoneUploadAugment()
    dataset = datasets.ImageFolder(root=data_dir, transform=augment)
    fake_class_idx = dataset.class_to_idx.get("fake", 0)
    print(f"Class mapping: {dataset.class_to_idx} (Target: fake=1.0, real=0.0)")

    loader = DataLoader(
        dataset,
        batch_size=batch_size,
        shuffle=True,
        collate_fn=collate_fn,
        num_workers=num_workers,
    )

    # 3. Initialize UnivFD linear head
    head = UnivFDHead(input_dim=EMBEDDING_DIM).to(device)
    criterion = nn.BCEWithLogitsLoss()
    optimizer = torch.optim.AdamW(head.parameters(), lr=lr, weight_decay=1e-4)

    # 4. Training loop
    for epoch in range(epochs):
        head.train()
        total_loss = 0.0

        for images, raw_labels in loader:
            labels = (raw_labels == fake_class_idx).float().unsqueeze(1).to(device)

            inputs = processor(images=images, return_tensors="pt").to(device)
            with torch.no_grad():
                features = clip_model.get_image_features(**inputs)

            logits = head(features)
            loss = criterion(logits, labels)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            total_loss += loss.item()

        avg_loss = total_loss / len(loader)
        print(f"Epoch [{epoch + 1}/{epochs}] - Loss: {avg_loss:.4f}")

    # 5. Save trained weights
    os.makedirs(WEIGHTS_DIR, exist_ok=True)
    torch.save(head.state_dict(), WEIGHTS_PATH)
    print(f"Saved UnivFD weights to {WEIGHTS_PATH}")


if __name__ == "__main__":
    train()