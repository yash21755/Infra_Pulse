import torch
from torch.utils.data import DataLoader
from torchvision import datasets
from transformers import CLIPModel, CLIPImageProcessor
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, confusion_matrix

from config import CLIP_MODEL_NAME, EMBEDDING_DIM, WEIGHTS_PATH
from model import UnivFDHead


def collate_fn(batch):
    images, labels = zip(*batch)
    return list(images), torch.tensor(labels, dtype=torch.float32)


@torch.no_grad()
def evaluate(val_dir: str = "dataset/val", batch_size: int = 32):
    device = "cuda" if torch.cuda.is_available() else "cpu"
    print(f"Evaluating UnivFD on {device}...")

    # 1. Load frozen CLIP + trained UnivFD head
    processor = CLIPProcessor.from_pretrained(CLIP_MODEL_NAME)
    clip_model = CLIPModel.from_pretrained(CLIP_MODEL_NAME).to(device).eval()

    head = UnivFDHead(input_dim=EMBEDDING_DIM).to(device)
    head.load_state_dict(torch.load(WEIGHTS_PATH, map_location=device))
    head.eval()

    # 2. Load validation set (NO augmentations)
    dataset = datasets.ImageFolder(root=val_dir)
    fake_class_idx = dataset.class_to_idx.get("fake", 0)
    loader = DataLoader(dataset, batch_size=batch_size, shuffle=False, collate_fn=collate_fn)

    all_probs = []
    all_labels = []

    for images, raw_labels in loader:
        labels = (raw_labels == fake_class_idx).int().tolist()
        inputs = processor(images=images, return_tensors="pt").to(device)
        features = clip_model.get_image_features(**inputs)
        probs = torch.sigmoid(head(features)).squeeze(1).cpu().tolist()

        all_probs.extend(probs)
        all_labels.extend(labels)

    # 3. Print ROC AUC + Metrics across thresholds
    auc = roc_auc_score(all_labels, all_probs)
    print(f"\nTotal images tested: {len(all_labels)} | ROC AUC: {auc:.4f}\n")

    for thresh in [0.50, 0.65, 0.75, 0.85]:
        preds = [1 if p >= thresh else 0 for p in all_probs]
        tn, fp, fn, tp = confusion_matrix(all_labels, preds).ravel()

        print(f"=== Threshold: {thresh:.2f} ===")
        print(f"Accuracy : {accuracy_score(all_labels, preds):.4f}")
        print(f"Precision: {precision_score(all_labels, preds, zero_division=0):.4f}")
        print(f"Recall   : {recall_score(all_labels, preds, zero_division=0):.4f}")
        print(f"F1 Score : {f1_score(all_labels, preds, zero_division=0):.4f}")
        print(f"CM -> TN: {tn} | FP: {fp} | FN: {fn} | TP: {tp}\n")


if __name__ == "__main__":
    evaluate()