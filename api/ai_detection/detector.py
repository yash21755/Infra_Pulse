import io
import os
from typing import Union, Dict, Any

import torch
from PIL import Image
from transformers import CLIPModel, CLIPImageProcessor

from .config import CLIP_MODEL_NAME, EMBEDDING_DIM, WEIGHTS_PATH, AI_THRESHOLD
from .model import UnivFDHead


class AIImageDetector:
    def __init__(self, weights_path: str = WEIGHTS_PATH, threshold: float = AI_THRESHOLD, load_clip: bool = False):
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.threshold = threshold

        # Load UnivFD linear head
        self.head = UnivFDHead(input_dim=EMBEDDING_DIM).to(self.device)
        if os.path.exists(weights_path):
            self.head.load_state_dict(torch.load(weights_path, map_location=self.device))
        else:
            print(f"[WARNING] Weights not found at {weights_path}. Run train.py first; using untrained weights.")
        self.head.eval()

        # Lazy/optional CLIP loading (set load_clip=False if only passing precomputed vectors)
        self.processor = None
        self.clip_model = None
        if load_clip:
            self._init_clip()

    def _init_clip(self):
        if self.clip_model is None:
            self.processor = CLIPImageProcessor.from_pretrained(CLIP_MODEL_NAME)
            self.clip_model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(self.device)
            self.clip_model.eval()

    def _load_image(self, image_data: Union[str, bytes, Image.Image]) -> Image.Image:
        if isinstance(image_data, Image.Image):
            return image_data.convert("RGB")
        if isinstance(image_data, str):
            return Image.open(image_data).convert("RGB")
        if isinstance(image_data, (bytes, bytearray)):
            return Image.open(io.BytesIO(image_data)).convert("RGB")
        raise ValueError("Unsupported image format. Pass a file path, raw bytes, or PIL.Image.")

    @torch.no_grad()
    def check_embedding(self, embedding: Union[torch.Tensor, list]) -> Dict[str, Any]:
        """
        Fast path: Reuse the 512-D visual vector already extracted by your redundancy service.
        """
        if not isinstance(embedding, torch.Tensor):
            embedding = torch.tensor(embedding, dtype=torch.float32)

        if embedding.ndim == 1:
            embedding = embedding.unsqueeze(0)

        embedding = embedding.to(self.device)
        logit = self.head(embedding)
        ai_prob = torch.sigmoid(logit).item()

        is_ai = ai_prob >= self.threshold
        return {
            "is_ai_generated": is_ai,
            "ai_probability": round(ai_prob, 4),
            "status": "FLAGGED_AI" if is_ai else "AUTHENTIC",
            "threshold": self.threshold,
        }

    @torch.no_grad()
    def check_image(self, image_data: Union[str, bytes, Image.Image]) -> Dict[str, Any]:
        """
        Full path: Takes a new image (path, bytes, or PIL Image), extracts CLIP features, and reports AI status.
        """
        self._init_clip()
        image = self._load_image(image_data)
        inputs = self.processor(images=image, return_tensors="pt").to(self.device)
        features = self.clip_model.get_image_features(**inputs)
        return self.check_embedding(features)