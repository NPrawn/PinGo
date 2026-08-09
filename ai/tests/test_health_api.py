import unittest

from fastapi.testclient import TestClient

from app.main import create_app


class HealthApiTest(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()

    def test_liveness_is_available_before_models_are_loaded(self):
        response = self.client.get("/health/live")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "LIVE", "components": {}})

    def test_readiness_returns_503_before_engine_and_map_are_loaded(self):
        response = self.client.get("/health/ready")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.json(),
            {
                "status": "NOT_READY",
                "components": {"engine": "NOT_LOADED", "map": "NOT_LOADED"},
            },
        )

    def test_readiness_returns_200_after_engine_and_map_are_loaded(self):
        self.app.state.readiness.mark_ready("engine")
        self.app.state.readiness.mark_ready("map")

        response = self.client.get("/health/ready")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.json(),
            {
                "status": "READY",
                "components": {"engine": "READY", "map": "READY"},
            },
        )

    def test_readiness_exposes_component_failure_reason(self):
        self.app.state.readiness.mark_ready("engine")
        self.app.state.readiness.mark_not_ready("map", "MAP_LOAD_FAILED")

        response = self.client.get("/health/ready")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["components"]["map"], "MAP_LOAD_FAILED")


if __name__ == "__main__":
    unittest.main()
