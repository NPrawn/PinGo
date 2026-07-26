import tempfile
import unittest
from pathlib import Path

from fastapi.testclient import TestClient

from app.core.config import AppSettings
from app.main import create_app
from app.maps.map_loader import MapLoadError


class _FakeMapLoader:
    def __init__(self, result=None, error: Exception | None = None):
        self.result = result
        self.error = error
        self.calls = []

    def load(self, map_version, model_path):
        self.calls.append((map_version, model_path))
        if self.error:
            raise self.error
        return self.result


class _FakeLocalizer:
    def __init__(self):
        self.load_called = False

    def load(self):
        self.load_called = True


class AppLifespanTest(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.model_path = Path(self.temporary_directory.name)

    def tearDown(self):
        self.temporary_directory.cleanup()

    def test_loads_map_once_and_marks_map_ready(self):
        expected_context = object()
        loader = _FakeMapLoader(result=expected_context)
        settings = AppSettings("station-b2-v1", self.model_path)
        localizer = _FakeLocalizer()
        app = create_app(
            settings=settings,
            map_loader=loader,
            localizer_factory=lambda _context: localizer,
        )

        with TestClient(app) as client:
            response = client.get("/health/ready")

            self.assertIs(app.state.map_context, expected_context)
            self.assertEqual(loader.calls, [("station-b2-v1", self.model_path)])
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()["components"]["map"], "READY")
            self.assertEqual(response.json()["components"]["engine"], "READY")
            self.assertTrue(localizer.load_called)

        self.assertIsNone(app.state.map_context)
        self.assertEqual(
            app.state.readiness.snapshot().components["map"], "NOT_LOADED"
        )

    def test_loads_multiple_maps_into_one_engine(self):
        expected_context = object()
        loader = _FakeMapLoader(result=expected_context)
        settings = AppSettings(
            map_set_version="station-v1",
            map_root=self.model_path,
            map_versions=("station-b2-v1", "station-b3-v1"),
        )
        localizer = _FakeLocalizer()
        received_contexts = []
        app = create_app(
            settings=settings,
            map_loader=loader,
            localizer_factory=lambda contexts: (
                received_contexts.append(contexts) or localizer
            ),
        )

        with TestClient(app) as client:
            response = client.get("/health/ready")

            self.assertEqual(response.status_code, 200)
            self.assertEqual(
                loader.calls,
                [
                    ("station-b2-v1", self.model_path / "station-b2-v1"),
                    ("station-b3-v1", self.model_path / "station-b3-v1"),
                ],
            )
            self.assertEqual(
                set(app.state.map_contexts),
                {"station-b2-v1", "station-b3-v1"},
            )
            self.assertIsNone(app.state.map_context)
            self.assertEqual(len(received_contexts), 1)
            self.assertTrue(localizer.load_called)

        self.assertEqual(app.state.map_contexts, {})

    def test_map_load_failure_keeps_process_live_and_readiness_failed(self):
        loader = _FakeMapLoader(error=MapLoadError("broken map"))
        settings = AppSettings("station-b2-v1", self.model_path)
        app = create_app(settings=settings, map_loader=loader)

        with self.assertLogs("app.main", level="ERROR"):
            with TestClient(app) as client:
                liveness = client.get("/health/live")
                readiness = client.get("/health/ready")

        self.assertEqual(liveness.status_code, 200)
        self.assertEqual(readiness.status_code, 503)
        self.assertEqual(
            readiness.json()["components"]["map"], "MAP_LOAD_FAILED"
        )

    def test_missing_map_configuration_does_not_call_loader(self):
        loader = _FakeMapLoader()
        app = create_app(settings=AppSettings(), map_loader=loader)

        with TestClient(app) as client:
            response = client.get("/health/ready")

        self.assertEqual(loader.calls, [])
        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json()["components"]["map"], "MAP_NOT_CONFIGURED"
        )


if __name__ == "__main__":
    unittest.main()
