import tempfile
import unittest
from pathlib import Path

import h5py
import numpy as np

from app.maps.global_descriptor_index import (
    GlobalDescriptorError,
    GlobalDescriptorIndex,
)


class GlobalDescriptorIndexTest(unittest.TestCase):
    def test_loads_normalized_descriptors_and_name_index(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "global_descriptors.h5"
            with h5py.File(path, "w") as file:
                file.attrs["model_name"] = "VGG16-NetVLAD-Pitts30K"
                file.attrs["resize_max"] = 1024
                group = file.create_group("B2/frame.jpg")
                descriptor = np.zeros(4096, dtype=np.float32)
                descriptor[0] = 1.0
                group.create_dataset("global_descriptor", data=descriptor)

            index = GlobalDescriptorIndex.load(path, expected_names={"B2/frame.jpg"})

            self.assertEqual(index.names, ("B2/frame.jpg",))
            self.assertEqual(index.model_name, "VGG16-NetVLAD-Pitts30K")
            self.assertEqual(index.resize_max, 1024)
            self.assertEqual(index.find("B2/frame.jpg")[0], 1.0)
            self.assertFalse(index.descriptors.flags.writeable)

    def test_rejects_missing_reference_image_descriptor(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "global_descriptors.h5"
            with h5py.File(path, "w") as file:
                group = file.create_group("B2/frame.jpg")
                descriptor = np.zeros(4096, dtype=np.float32)
                descriptor[0] = 1.0
                group.create_dataset("global_descriptor", data=descriptor)

            with self.assertRaises(GlobalDescriptorError):
                GlobalDescriptorIndex.load(
                    path,
                    expected_names={"B2/frame.jpg", "B2/missing.jpg"},
                )


if __name__ == "__main__":
    unittest.main()
