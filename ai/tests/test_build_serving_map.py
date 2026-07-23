import sqlite3
import tempfile
import unittest
from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from build_serving_map import export_reference_features


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
                for row in exported.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                )
            }
            image = exported.execute(
                "SELECT image_id, name, camera_id FROM images"
            ).fetchone()
            exported.close()

            self.assertEqual(tables, {"images", "keypoints", "descriptors"})
            self.assertEqual(image, (1, "B2/frame.jpg", 1))


if __name__ == "__main__":
    unittest.main()
