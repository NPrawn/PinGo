import json
import sqlite3
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import h5py
import numpy as np
import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from build_serving_map import build, export_reference_features


class ExportReferenceFeaturesTest(unittest.TestCase):
    def test_exports_only_runtime_tables(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "source.db"
            destination = root / "reference_features.db"
            connection = sqlite3.connect(source)
            connection.executescript(
                """
                CREATE TABLE images (
                    image_id INTEGER PRIMARY KEY,
                    name TEXT,
                    camera_id INTEGER
                );
                CREATE TABLE keypoints (
                    image_id INTEGER PRIMARY KEY,
                    rows INTEGER,
                    cols INTEGER,
                    data BLOB
                );
                CREATE TABLE descriptors (
                    image_id INTEGER PRIMARY KEY,
                    type INTEGER,
                    rows INTEGER,
                    cols INTEGER,
                    data BLOB
                );
                CREATE TABLE matches (pair_id INTEGER PRIMARY KEY, data BLOB);
                INSERT INTO images VALUES (1, 'B2/frame.jpg', 1);
                INSERT INTO keypoints VALUES (1, 1, 6, X'0000');
                INSERT INTO descriptors VALUES (1, 1, 1, 512, X'0000');
                INSERT INTO matches VALUES (3, X'0000');
                """
            )
            connection.commit()
            connection.close()

            export_reference_features(source, destination)

            exported = sqlite3.connect(destination)
            tables = {
                row[0]
                for row in exported.execute("SELECT name FROM sqlite_master WHERE type='table'")
            }
            image = exported.execute("SELECT image_id, name, camera_id FROM images").fetchone()
            exported.close()

            self.assertEqual(tables, {"images", "keypoints", "descriptors"})
            self.assertEqual(image, (1, "B2/frame.jpg", 1))

    @patch("build_serving_map.inspect")
    def test_builds_versioned_serving_map_with_manifest_and_checksums(
        self,
        inspect_mock,
    ):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pipeline_output = root / "pipeline"
            source_map = pipeline_output / "source-map"
            sparse_model = source_map / "sparse" / "0"
            sparse_model.mkdir(parents=True)
            for filename in ("cameras.bin", "images.bin", "points3D.bin"):
                (sparse_model / filename).write_bytes(filename.encode())
            self._create_source_database(source_map / "database.db")

            global_descriptors = root / "global_descriptors.h5"
            with h5py.File(global_descriptors, "w") as file:
                file.attrs["model_name"] = "VGG16-NetVLAD-Pitts30K"
                file.attrs["resize_max"] = 1024
                group = file.create_group("B2/frame.jpg")
                descriptor = np.zeros(4096, dtype=np.float32)
                descriptor[0] = 1.0
                group.create_dataset("global_descriptor", data=descriptor)

            inspect_mock.return_value = {
                "compatible": True,
                "source": {"mapDirectory": "source-map"},
                "counts": {"registeredImages": 1},
            }
            output_root = root / "runtime_maps"

            destination = build(
                pipeline_output,
                output_root,
                "station-b2-v1",
                "B2",
                global_descriptors,
            )

            manifest = json.loads((destination / "manifest.json").read_text(encoding="utf-8"))
            self.assertEqual(manifest["schemaVersion"], 1)
            self.assertEqual(manifest["mapVersion"], "station-b2-v1")
            self.assertEqual(manifest["floor"], "B2")
            self.assertEqual(manifest["retrieval"]["imageCount"], 1)
            self.assertEqual(
                manifest["retrieval"]["descriptorDimension"],
                4096,
            )
            self.assertTrue((destination / "checksums.sha256").is_file())
            self.assertTrue((destination / "reference_sfm" / "points3D.bin").is_file())
            self.assertTrue((destination / "reference_features.db").is_file())
            self.assertTrue((destination / "global_descriptors.h5").is_file())
            self.assertFalse(any(path.name.endswith(".tmp") for path in output_root.iterdir()))

    @staticmethod
    def _create_source_database(path: Path) -> None:
        connection = sqlite3.connect(path)
        try:
            connection.executescript(
                """
                CREATE TABLE images (
                    image_id INTEGER PRIMARY KEY,
                    name TEXT,
                    camera_id INTEGER
                );
                CREATE TABLE keypoints (
                    image_id INTEGER PRIMARY KEY,
                    rows INTEGER,
                    cols INTEGER,
                    data BLOB
                );
                CREATE TABLE descriptors (
                    image_id INTEGER PRIMARY KEY,
                    type INTEGER,
                    rows INTEGER,
                    cols INTEGER,
                    data BLOB
                );
                INSERT INTO images VALUES (1, 'B2/frame.jpg', 1);
                INSERT INTO keypoints VALUES (1, 1, 6, X'0000');
                INSERT INTO descriptors VALUES (1, 1, 1, 128, X'0000');
                """
            )
            connection.commit()
        finally:
            connection.close()


if __name__ == "__main__":
    unittest.main()
