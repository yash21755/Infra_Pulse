import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Matches your existing Stage 2 Vision Encoder
CLIP_MODEL_NAME = "openai/clip-vit-base-patch32"
EMBEDDING_DIM = 512

# Where the trained UnivFD linear head will be saved/loaded
WEIGHTS_DIR = os.path.join(BASE_DIR, "weights")
WEIGHTS_PATH = os.path.join(WEIGHTS_DIR, "univfd_head.pt")

# Classification threshold (tune based on your validation ROC curve)
AI_THRESHOLD = 0.65