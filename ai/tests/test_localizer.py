import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import numpy as np

from app.engine.feature_extractor import LocalFeatures
from app.engine.localizer import (
    ImageLocalizer,
    LocalizationResult,
    MultiMapLocalizer,
    _Correspondence,
)


class _FakeExtractor:
    def __init__(self, value):
        self.value = value
        self.extract_calls = 0
        self.load_calls = 0

    def load(self):
        self.load_calls += 1

    def extract(self, _image):
        self.extract_calls += 1
        return self.value


def _result(num_inliers):
    return LocalizationResult(
        status="LOCALIZED",
        candidates=(),
        total_matches=num_inliers,
        correspondence_count=num_inliers,
        supporting_reference_images=1,
        num_inliers=num_inliers,
        inlier_ratio=0.5,
        median_reprojection_error=2.0,
        camera_center=(1.0, 2.0, 3.0),
        cam_from_world={
            "rotation_xyzw": [0.0, 0.0, 0.0, 1.0],
            "translation": [0.0, 0.0, 0.0],
        },
    )


class CorrespondenceSelectionTest(unittest.TestCase):
    def test_keeps_highest_score_without_query_or_point3d_duplicates(self):
        selected = ImageLocalizer._select_correspondences(
            [
                _Correspondence(1, 10, 0.7, "a.jpg"),
                _Correspondence(1, 11, 0.9, "b.jpg"),
                _Correspondence(2, 11, 0.8, "c.jpg"),
                _Correspondence(3, 12, 0.6, "a.jpg"),
            ]
        )

        self.assertEqual(
            [(item.query_index, item.point3d_id) for item in selected],
            [(1, 11), (3, 12)],
        )

    def test_multi_map_extracts_query_features_once(self):
        descriptor_index = SimpleNamespace(
            resize_max=1024,
            model_name="VGG16-NetVLAD-Pitts30K",
        )
        contexts = {
            "b2-v1": SimpleNamespace(
                reference_features_path=Path("b2.db"),
                global_descriptor_index=descriptor_index,
                manifest={"floor": "B2"},
            ),
            "b3-v1": SimpleNamespace(
                reference_features_path=Path("b3.db"),
                global_descriptor_index=descriptor_index,
                manifest={"floor": "B3"},
            ),
        }
        global_extractor = _FakeExtractor(np.zeros(4096, dtype=np.float32))
        local_extractor = _FakeExtractor(
            LocalFeatures(
                keypoints=np.empty((0, 2), dtype=np.float32),
                descriptors=np.empty((0, 128), dtype=np.float32),
                scores=np.empty(0, dtype=np.float32),
                image_size=(16, 12),
            )
        )
        engine = MultiMapLocalizer(
            contexts,
            device="cpu",
            global_extractor=global_extractor,
            local_extractor=local_extractor,
            matcher=object(),
        )

        def fake_localize(localizer, _prepared, focal_length_px, top_k):
            self.assertEqual(focal_length_px, 100.0)
            self.assertEqual(top_k, 5)
            return _result(
                20 if localizer.context.manifest["floor"] == "B3" else 10
            )

        with patch.object(ImageLocalizer, "localize_prepared", new=fake_localize):
            result = engine.localize(b"image", focal_length_px=100.0, top_k=5)

        self.assertEqual(global_extractor.extract_calls, 1)
        self.assertEqual(local_extractor.extract_calls, 1)
        self.assertEqual(result.selected_map_version, "b3-v1")
        self.assertEqual(result.floor, "B3")
        self.assertEqual(len(result.map_results), 2)


if __name__ == "__main__":
    unittest.main()
