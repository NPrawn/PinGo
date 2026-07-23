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
            },
            clear=True,
        ):
            settings = AppSettings.from_env()

        self.assertEqual(settings.map_version, "station-b2-v1")
        self.assertEqual(
            settings.map_model_path,
            Path("maps/station-b2-v1/reference_sfm"),
        )

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
