import importlib.util
import unittest
from pathlib import Path

from app.maps.map_loader import MapLoader

AI_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = (
    AI_ROOT
    / "pipeline_output"
    / "colmap_aliked_lightglue_v4_2fps"
    / "sparse"
    / "0"
)


@unittest.skipUnless(
    importlib.util.find_spec("pycolmap") is not None and MODEL_PATH.is_dir(),
    "로컬 COLMAP 맵 또는 pycolmap이 없어 통합 테스트를 건너뜁니다.",
)
class MapLoaderIntegrationTest(unittest.TestCase):
    def test_loads_current_aliked_sparse_map(self):
        context = MapLoader().load("yeoksam-b2-aliked-v4", MODEL_PATH)

        self.assertEqual(context.camera_count, 1)
        self.assertEqual(context.registered_image_count, 766)
        self.assertEqual(context.point3d_count, 203_384)
        self.assertEqual(context.find_image_id("B2/frame_000001.jpg"), 4)


if __name__ == "__main__":
    unittest.main()
