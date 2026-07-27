import importlib.util
import unittest
from pathlib import Path

from app.maps.map_loader import MapLoader

AI_ROOT = Path(__file__).resolve().parents[1]
MAP_VERSION = "YS-2026-07-23.1"
ARTIFACT_PATH = AI_ROOT / "runtime_maps" / MAP_VERSION


@unittest.skipUnless(
    importlib.util.find_spec("pycolmap") is not None
    and (ARTIFACT_PATH / "manifest.json").is_file(),
    "로컬 serving map 또는 pycolmap이 없어 통합 테스트를 건너뜁니다.",
)
class ServingMapIntegrationTest(unittest.TestCase):
    def test_verifies_and_loads_current_serving_map(self):
        context = MapLoader().load(MAP_VERSION, ARTIFACT_PATH)

        self.assertEqual(context.camera_count, 1)
        self.assertEqual(context.registered_image_count, 766)
        self.assertEqual(context.point3d_count, 203_384)
        self.assertEqual(len(context.global_descriptor_index.names), 766)
        self.assertEqual(
            context.global_descriptor_index.descriptors.shape,
            (766, 4096),
        )
        self.assertEqual(
            context.find_image_id("B2/frame_000001.jpg"),
            4,
        )


if __name__ == "__main__":
    unittest.main()
