import tempfile
import unittest
from pathlib import Path

from app.maps.map_loader import MapLoadError, MapLoader


class _FakeImage:
    def __init__(self, image_id: int, name: str):
        self.image_id = image_id
        self.name = name


class _FakeReconstruction:
    def __init__(
        self,
        images: dict[int, _FakeImage] | None = None,
        camera_count: int = 1,
        point3d_count: int = 10,
    ):
        self.images = images or {1: _FakeImage(1, "B2/frame_000001.jpg")}
        self._camera_count = camera_count
        self._point3d_count = point3d_count

    def num_cameras(self):
        return self._camera_count

    def num_reg_images(self):
        return len(self.images)

    def num_points3D(self):
        return self._point3d_count


class MapLoaderTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.model_path = Path(self.temporary_directory.name)
        for filename in ("cameras.bin", "images.bin", "points3D.bin"):
            (self.model_path / filename).touch()

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_loads_map_context_and_image_name_index(self):
        reconstruction = _FakeReconstruction()
        loader = MapLoader(lambda _path: reconstruction)

        context = loader.load("station-b2-v1", self.model_path)

        self.assertEqual(context.map_version, "station-b2-v1")
        self.assertEqual(context.camera_count, 1)
        self.assertEqual(context.registered_image_count, 1)
        self.assertEqual(context.point3d_count, 10)
        self.assertEqual(context.find_image_id("B2/frame_000001.jpg"), 1)
        self.assertIsNone(context.find_image_id("unknown.jpg"))

    def test_image_name_index_cannot_be_modified(self):
        context = MapLoader(lambda _path: _FakeReconstruction()).load(
            "station-b2-v1", self.model_path
        )

        with self.assertRaises(TypeError):
            context.image_name_to_id["new.jpg"] = 2

    def test_rejects_missing_sparse_model_file(self):
        (self.model_path / "points3D.bin").unlink()
        loader = MapLoader(lambda _path: _FakeReconstruction())

        with self.assertRaisesRegex(MapLoadError, "points3D.bin"):
            loader.load("station-b2-v1", self.model_path)

    def test_wraps_reconstruction_loading_failure(self):
        def fail(_path):
            raise ValueError("invalid binary")

        loader = MapLoader(fail)

        with self.assertRaisesRegex(MapLoadError, "로딩에 실패"):
            loader.load("station-b2-v1", self.model_path)

    def test_rejects_empty_reconstruction(self):
        reconstruction = _FakeReconstruction(camera_count=0)
        loader = MapLoader(lambda _path: reconstruction)

        with self.assertRaisesRegex(MapLoadError, "카메라가 없습니다"):
            loader.load("station-b2-v1", self.model_path)


if __name__ == "__main__":
    unittest.main()
