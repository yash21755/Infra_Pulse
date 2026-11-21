import torch
import torch.nn as nn
import torch.nn.functional as F


class UnivFDHead(nn.Module):
    """
    Lightweight linear classifier trained on frozen CLIP image embeddings.
    """
    def __init__(self, input_dim: int = 512):
        super().__init__()
        self.fc = nn.Linear(input_dim, 1)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # Ensure L2 normalization matches standard CLIP feature space
        x = F.normalize(x, p=2, dim=-1)
        return self.fc(x)