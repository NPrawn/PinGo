import os
import unittest
from pathlib import Path
from unittest.mock import patch

from app.core.config import AppSettings


class AppSettingsTest(unittest.TestCase):
    def test_reads_map_configuration_from_environment(self):
        with patch.dict(
            os.environ,
            {
                "AI_MAP_VERSION": " station-b2-v1 ",
                "AI_MAP_MODEL_PATH": "maps/station-b2-v1/reference_sfm",
                "AI_INTERNAL_TOKEN": " secret ",
                "AI_MAX_IMAGE_BYTES": "1234",
                "AI_MAX_PIXELS": "5678",
                "AI_DEFAULT_TOP_K": "12",
                "AI_MAX_TOP_K": "34",
                "AI_MAX_CONCURRENT_INFERENCES": "2",
                "AI_MAX_QUEUE_SIZE": "3",
            },
            clear=True,
        ):
            settings = AppSettings.from_env()

        self.assertEqual(settings.map_version, "station-b2-v1")
        self.assertEqual(
            settings.map_model_path,
            Path("maps/station-b2-v1/reference_sfm"),
        )
        self.assertEqual(settings.internal_token, "secret")
        self.assertEqual(settings.max_image_bytes, 1234)
        self.assertEqual(settings.max_pixels, 5678)
        self.assertEqual(settings.default_top_k, 12)
        self.assertEqual(settings.max_top_k, 34)
        self.assertEqual(settings.max_concurrent_inferences, 2)
        self.assertEqual(settings.max_queue_size, 3)

    def test_empty_environment_values_are_treated_as_missing(self):
        with patch.dict(
            os.environ,
            {"AI_MAP_VERSION": " ", "AI_MAP_MODEL_PATH": ""},
            clear=True,
        ):
            settings = AppSettings.from_env()

        self.assertIsNone(settings.map_version)
        self.assertIsNone(settings.map_model_path)


if __name__ == "__main__":
    unittest.main()
