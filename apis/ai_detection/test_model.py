import sys
import torch
try:
    from apis.ai_detection import AIImageDetector
except ImportError:
    try:
        from api.ai_detection import AIImageDetector
    except ImportError:
        from detector import AIImageDetector


def main():
    detector = AIImageDetector()

    # 1. Test with a dummy 512-D embedding (simulating reuse from Stage 2)
    dummy_vec = torch.randn(512)
    vec_result = detector.check_embedding(dummy_vec)
    print("\n--- Embedding Reuse Test (512-D) ---")
    print(vec_result)

    # 2. Test with an actual image if passed via CLI: python -m api.ai_detection.test_model path/to/img.jpg
    if len(sys.argv) > 1:
        image_path = sys.argv[1]
        print(f"\n--- Image Detection Test: {image_path} ---")
        img_result = detector.check_image(image_path)
        print(img_result)
    else:
        print("\nTip: Pass an image path to test full image inference:")
        print("python -m api.ai_detection.test_model sample_damage.jpg")


if __name__ == "__main__":
    main()