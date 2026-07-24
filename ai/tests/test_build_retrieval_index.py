import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

import h5py
import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "tools"))

from build_retrieval_index import build_retrieval_index


class BuildRetrievalIndexTest(unittest.TestCase):
    def test_builds_validated_index_atomically(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            images = root / "images"
            image_path = images / "B2" / "frame.jpg"
            image_path.parent.mkdir(parents=True)
            image_path.write_bytes(b"fixture")
            database = root / "database.db"
            connection = sqlite3.connect(database)
            try:
                connection.executescript(
                    """
                    CREATE TABLE images (
                        image_id INTEGER PRIMARY KEY,
                        name TEXT NOT NULL
                    );
                    INSERT INTO images VALUES (1, 'B2/frame.jpg');
                    """
                )
                connection.commit()
            finally:
                connection.close()
            output = root / "global_descriptors.h5"

            def fake_extractor(image_root, image_names, output_path):
                self.assertEqual(image_root, images.resolve())
                self.assertEqual(tuple(image_names), ("B2/frame.jpg",))
                with h5py.File(output_path, "w") as file:
                    group = file.create_group("B2/frame.jpg")
                    descriptor = np.zeros(4096, dtype=np.float32)
                    descriptor[0] = 1.0
                    group.create_dataset("global_descriptor", data=descriptor)

            index = build_retrieval_index(
                images,
                database,
                output,
                extractor=fake_extractor,
            )

            self.assertTrue(output.is_file())
            self.assertEqual(index.names, ("B2/frame.jpg",))
            with h5py.File(output, "r") as file:
                self.assertEqual(file.attrs["format_version"], 1)
                self.assertEqual(file.attrs["resize_max"], 1024)

    def test_does_not_overwrite_existing_index(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            output = root / "global_descriptors.h5"
            output.write_bytes(b"existing")

            with self.assertRaises(FileExistsError):
                build_retrieval_index(root, root / "database.db", output)


if __name__ == "__main__":
    unittest.main()
