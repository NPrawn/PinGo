import hashlib
import json
import sqlite3
import tempfile
import unittest
from pathlib import Path

import h5py
import numpy as np

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

    def test_loads_and_verifies_serving_map_bundle(self):
        artifact_path = self._create_serving_map_bundle()
        loader = MapLoader(lambda _path: _FakeReconstruction())

        context = loader.load("station-b2-v1", artifact_path)

        self.assertEqual(context.artifact_path, artifact_path)
        self.assertEqual(
            context.reference_features_path,
            artifact_path / "reference_features.db",
        )
        self.assertEqual(
            context.global_descriptor_index.names,
            ("B2/frame_000001.jpg",),
        )
        self.assertEqual(context.manifest["schemaVersion"], 1)

    def test_rejects_serving_map_checksum_mismatch(self):
        artifact_path = self._create_serving_map_bundle()
        (artifact_path / "reference_sfm" / "points3D.bin").write_bytes(b"tampered")
        loader = MapLoader(lambda _path: _FakeReconstruction())

        with self.assertRaisesRegex(MapLoadError, "checksum|크기"):
            loader.load("station-b2-v1", artifact_path)

    def test_rejects_manifest_retrieval_contract_mismatch(self):
        artifact_path = self._create_serving_map_bundle()
        manifest_path = artifact_path / "manifest.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        manifest["retrieval"]["descriptorDimension"] = 1024
        manifest_path.write_text(json.dumps(manifest), encoding="utf-8")
        loader = MapLoader(lambda _path: _FakeReconstruction())

        with self.assertRaisesRegex(MapLoadError, "검색 설정"):
            loader.load("station-b2-v1", artifact_path)

    def _create_serving_map_bundle(self) -> Path:
        artifact_path = self.model_path / "serving-map"
        model_path = artifact_path / "reference_sfm"
        model_path.mkdir(parents=True)
        for filename in ("cameras.bin", "images.bin", "points3D.bin"):
            (model_path / filename).write_bytes(filename.encode())

        feature_path = artifact_path / "reference_features.db"
        connection = sqlite3.connect(feature_path)
        try:
            connection.executescript(
                """
                CREATE TABLE images (
                    image_id INTEGER PRIMARY KEY,
                    name TEXT NOT NULL
                );
                CREATE TABLE keypoints (image_id INTEGER PRIMARY KEY);
                CREATE TABLE descriptors (image_id INTEGER PRIMARY KEY);
                INSERT INTO images VALUES (1, 'B2/frame_000001.jpg');
                INSERT INTO keypoints VALUES (1);
                INSERT INTO descriptors VALUES (1);
                """
            )
            connection.commit()
        finally:
            connection.close()

        descriptor_path = artifact_path / "global_descriptors.h5"
        with h5py.File(descriptor_path, "w") as file:
            file.attrs["model_name"] = "VGG16-NetVLAD-Pitts30K"
            file.attrs["resize_max"] = 1024
            group = file.create_group("B2/frame_000001.jpg")
            descriptor = np.zeros(4096, dtype=np.float32)
            descriptor[0] = 1.0
            group.create_dataset("global_descriptor", data=descriptor)

        checksum_path = artifact_path / "checksums.sha256"
        checksum_path.write_text("fixture\n", encoding="utf-8")
        files = []
        for path in sorted(item for item in artifact_path.rglob("*") if item.is_file()):
            files.append(
                {
                    "path": path.relative_to(artifact_path).as_posix(),
                    "bytes": path.stat().st_size,
                    "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
                }
            )
        manifest = {
            "schemaVersion": 1,
            "mapVersion": "station-b2-v1",
            "versions": {
                "hlocCommit": "fixture",
                "pycolmap": "3.13.0",
            },
            "features": {
                "extractor": "ALIKED_N16ROT",
                "matcher": "ALIKED_LIGHTGLUE",
                "descriptorDimension": 128,
            },
            "retrieval": {
                "name": "netvlad",
                "modelName": "VGG16-NetVLAD-Pitts30K",
                "descriptorDimension": 4096,
                "resizeMax": 1024,
                "imageCount": 1,
            },
            "files": files,
        }
        (artifact_path / "manifest.json").write_text(
            json.dumps(manifest),
            encoding="utf-8",
        )
        return artifact_path


if __name__ == "__main__":
    unittest.main()
