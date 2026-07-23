import unittest

import numpy as np
import torch

from app.engine.feature_extractor import AlikedFeatureExtractor


class _FakeModel:
    def eval(self):
        return self

    def to(self, _device):
        return self

    def extract(self, image, resize):
        assert image.shape == (3, 8, 12)
        assert resize is None
        return {
            "keypoints": torch.tensor([[[1.0, 2.0], [3.0, 4.0]]]),
            "descriptors": torch.ones((1, 2, 128)),
            "keypoint_scores": torch.tensor([[0.9, 0.8]]),
        }


class AlikedFeatureExtractorTest(unittest.TestCase):
    def test_extracts_n16rot_compatible_shape(self):
        extractor = AlikedFeatureExtractor(
            device="cpu", model_factory=lambda _config: _FakeModel()
        )

        features = extractor.extract(np.zeros((8, 12, 3), dtype=np.uint8))

        self.assertEqual(features.image_size, (12, 8))
        self.assertEqual(features.keypoints.shape, (2, 2))
        self.assertEqual(features.descriptors.shape, (2, 128))
        self.assertEqual(features.scores.shape, (2,))

    def test_rejects_invalid_numpy_shape(self):
        extractor = AlikedFeatureExtractor(
            device="cpu", model_factory=lambda _config: _FakeModel()
        )

        with self.assertRaises(ValueError):
            extractor.extract(np.zeros((8, 12), dtype=np.uint8))


if __name__ == "__main__":
    unittest.main()
