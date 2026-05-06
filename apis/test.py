import os
import json
import random
import logging
import time
import asyncio
from PIL import Image

import numpy as np
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, 
    confusion_matrix, roc_auc_score
)

# Set working directory contexts appropriately
import sys
sys.path.append(os.path.dirname(__file__))

# Import from redundancy_api
import redundancy_api

# Setup logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | test | %(message)s")
logger = logging.getLogger("test")

COCO_MINI_DIR = "d:/Infra_Pulse/COCO_MINI"
IMAGES_DIR = os.path.join(COCO_MINI_DIR, "Images")
CAPTIONS_FILE = os.path.join(COCO_MINI_DIR, "captions.json")

def load_data(fraction=1.00):
    logger.info("Loading captions...")
    with open(CAPTIONS_FILE, "r") as f:
        captions_data = json.load(f)
    
    # Group by image_id
    image_to_caps = {}
    for item in captions_data:
        img_id = item["image_id"]
        if img_id not in image_to_caps:
            image_to_caps[img_id] = []
        image_to_caps[img_id].append(item["caption"])
        
    logger.info(f"Total unique images in captions: {len(image_to_caps)}")
    
    # Filter only those that exist in Images directory
    # Using os.listdir can be slow, but it's okay for 18k files
    existing_images = set(os.listdir(IMAGES_DIR))
    valid_image_ids = []
    
    for img_id in image_to_caps.keys():
        filename = f"COCO_train2014_{img_id:012d}.jpg"
        if filename in existing_images:
            valid_image_ids.append(img_id)
            
    logger.info(f"Images existing on disk: {len(valid_image_ids)}")
    
    # Sample fraction
    num_samples = int(len(valid_image_ids) * fraction)
    sampled_image_ids = random.sample(valid_image_ids, num_samples)
    logger.info(f"Sampled {num_samples} images for testing ({fraction*100}% of dataset)")
    
    return sampled_image_ids, image_to_caps

def generate_pairs(sampled_image_ids, image_to_caps):
    pairs = [] # List of tuples: ((img_path1, cap1), (img_path2, cap2), label)
    
    # Positive pairs
    for img_id in sampled_image_ids:
        caps = image_to_caps[img_id]
        if len(caps) >= 2:
            # Randomly pick 2 different captions for the same image
            c1, c2 = random.sample(caps, 2)
            img_path = os.path.join(IMAGES_DIR, f"COCO_train2014_{img_id:012d}.jpg")
            pairs.append(((img_path, c1), (img_path, c2), 1))
            
    # Negative pairs
    for img_id in sampled_image_ids:
        caps = image_to_caps[img_id]
        if not caps: continue
        c1 = caps[0]
        img_path1 = os.path.join(IMAGES_DIR, f"COCO_train2014_{img_id:012d}.jpg")
        
        # Pick random different image
        other_id = random.choice(sampled_image_ids)
        while other_id == img_id:
            other_id = random.choice(sampled_image_ids)
            
        other_caps = image_to_caps[other_id]
        c2 = other_caps[0] if other_caps else ""
        img_path2 = os.path.join(IMAGES_DIR, f"COCO_train2014_{other_id:012d}.jpg")
        
        pairs.append(((img_path1, c1), (img_path2, c2), 0))
        
    random.shuffle(pairs)
    return pairs

def main():
    logger.info("Initializing models...")
    
    # Monkey-patch VectorStore._save to avoid corrupting the real db with test data
    redundancy_api.VectorStore._save = lambda self: None
    
    # Initialize globals in redundancy_api
    asyncio.run(redundancy_api.startup())
    
    # Use a specific testing building ID to isolate matches
    TEST_BUILDING = "TEST_EVAL"
    
    sampled_ids, image_to_caps = load_data(fraction=1.00)
    pairs = generate_pairs(sampled_ids, image_to_caps)
    
    logger.info(f"Generated {len(pairs)} test pairs (50% positive, 50% negative)")
    
    y_true = []
    y_scores = []
    
    start_time = time.time()
    
    try:
        for i, ((p1_img, p1_cap), (p2_img, p2_cap), label) in enumerate(pairs):
            if i > 0 and i % 50 == 0:
                logger.info(f"Processed pair {i}/{len(pairs)}...")
                
            try:
                # First Issue (Register it)
                img1 = Image.open(p1_img).convert("RGB")
                fused1, vis1, txt1 = redundancy_api._compute_embeddings(p1_cap, img1)
                
                issue_id = f"test_issue_{i}"
                redundancy_api.vector_store.add(
                    issue_id=issue_id,
                    fused=fused1, vis=vis1, txt=txt1,
                    building_id=TEST_BUILDING, meta={}
                )
                
                # Second Issue (Query against the first one)
                img2 = Image.open(p2_img).convert("RGB")
                fused2, vis2, txt2 = redundancy_api._compute_embeddings(p2_cap, img2)
                
                matches = redundancy_api._find_matches(fused2, vis2, txt2, TEST_BUILDING, top_k=1)
                
                score = matches[0][1] if matches else 0.0
                
                y_true.append(label)
                y_scores.append(score)
                
            except Exception as e:
                logger.error(f"Error processing pair {i}: {e}")
            finally:
                # Ensure cleanup
                try:
                    redundancy_api.vector_store.remove(issue_id)
                except:
                    pass
    except KeyboardInterrupt:
        logger.warning(f"Testing interrupted by user! Calculating metrics for {len(y_true)} pairs processed so far...")

    total_time = time.time() - start_time
    logger.info(f"Testing completed in {total_time:.2f} seconds.")
    
    if len(y_true) == 0:
        logger.error("No pairs were successfully processed. Cannot compute metrics.")
        return

    print("\n" + "="*60)
    print("  REDUNDANCY MODEL VALIDATION RESULTS (100% COCO_MINI)  ")
    print("="*60)
    print(f"Total pairs tested : {len(y_true)}")
    print(f"Time taken         : {total_time:.2f} seconds")
    
    try:
        roc_auc = roc_auc_score(y_true, y_scores)
    except Exception:
        roc_auc = 0.0

    print(f"ROC AUC            : {roc_auc:.4f}")

    thresholds_to_test = [0.80, 0.85, 0.90]
    for threshold in thresholds_to_test:
        y_pred = [1 if s >= threshold else 0 for s in y_scores]
        
        accuracy = accuracy_score(y_true, y_pred)
        precision = precision_score(y_true, y_pred, zero_division=0)
        recall = recall_score(y_true, y_pred, zero_division=0)
        f1 = f1_score(y_true, y_pred, zero_division=0)
        cm = confusion_matrix(y_true, y_pred)
        
        print("\n" + "-"*60)
        print(f"Results for Threshold: {threshold:.2f}")
        print("-"*60)
        print(f"Accuracy           : {accuracy:.4f}")
        print(f"Precision          : {precision:.4f}")
        print(f"Recall             : {recall:.4f}")
        print(f"F1 Score           : {f1:.4f}")
        print("-"*60)
        print("Confusion Matrix:")
        if cm.size == 4:
            print(f"  True Negatives   : {cm[0][0]}")
            print(f"  False Positives  : {cm[0][1]}")
            print(f"  False Negatives  : {cm[1][0]}")
            print(f"  True Positives   : {cm[1][1]}")
        else:
            print(f"  Matrix: {cm}")
            
    print("\n" + "="*60)

if __name__ == "__main__":
    main()
