import json
import unittest
from dataclasses import dataclass
from io import BytesIO
from types import SimpleNamespace

from fastapi.testclient import TestClient
from PIL import Image

from app.core.config import AppSettings
from app.engine.localizer import LocalizationResult, RetrievalCandidate
from app.main import create_app


def _jpeg_bytes(width=16, height=12):
    output = BytesIO()
    Image.new("RGB", (width, height), color=(20, 30, 40)).save(output, format="JPEG")
    return output.getvalue()


@dataclass
class _FakeLocalizer:
    calls: list

    def localize(self, image, focal_length_px, top_k):
        self.calls.append(
            {
                "image": image,
                "focal_length_px": focal_length_px,
                "top_k": top_k,
            }
        )
        return LocalizationResult(
            status="LOCALIZED",
            candidates=(RetrievalCandidate("B2/frame_000001.jpg", 0.91),),
            total_matches=30,
            correspondence_count=26,
            supporting_reference_images=2,
            num_inliers=25,
            inlier_ratio=0.96,
            median_reprojection_error=2.5,
            camera_center=(1.0, 2.0, 3.0),
            cam_from_world={
                "rotation_xyzw": [0.0, 0.0, 0.0, 1.0],
                "translation": [4.0, 5.0, 6.0],
            },
        )


class _RejectingLimiter:
    def __init__(self):
        self.release_called = False

    async def acquire(self):
        return False

    async def release(self):
        self.release_called = True


class LocalizationApiTest(unittest.TestCase):
    def setUp(self):
        self.calls = []

        def factory(_context):
            return _FakeLocalizer(self.calls)

        self.app = create_app(
            settings=AppSettings(
                map_version="station-b2-v1",
                internal_token="secret",
                max_image_bytes=1024 * 1024,
                max_pixels=1000,
                default_top_k=20,
                max_top_k=30,
            ),
            localizer_factory=factory,
        )

    def test_localizes_image_with_request_id_and_metadata(self):
        with TestClient(self.app) as client:
            self.app.state.map_context = SimpleNamespace(map_version="station-b2-v1")
            response = client.post(
                "/internal/v1/maps/station-b2-v1/localize",
                headers={
                    "X-Request-Id": "loc_test",
                    "X-Internal-Token": "secret",
                },
                files={"image": ("query.jpg", _jpeg_bytes(), "image/jpeg")},
                data={
                    "metadata": json.dumps(
                        {
                            "camera": {
                                "params": [900.0, 8.0, 6.0],
                                "intrinsicsSource": "DEVICE_PROFILE",
                            },
                            "topK": 99,
                        }
                    )
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["requestId"], "loc_test")
        self.assertEqual(payload["status"], "LOCALIZED")
        self.assertEqual(payload["pose"]["cameraCenter"], [1.0, 2.0, 3.0])
        self.assertEqual(payload["quality"]["intrinsicsSource"], "DEVICE_PROFILE")
        self.assertIsInstance(payload["timingMs"]["validation"], int)
        self.assertIsInstance(payload["timingMs"]["queue"], int)
        self.assertIsInstance(payload["timingMs"]["inference"], int)
        self.assertEqual(self.calls[0]["focal_length_px"], 900.0)
        self.assertEqual(self.calls[0]["top_k"], 30)

    def test_uses_estimated_focal_length_when_intrinsics_are_missing(self):
        with TestClient(self.app) as client:
            self.app.state.map_context = SimpleNamespace(map_version="station-b2-v1")
            response = client.post(
                "/internal/v1/maps/station-b2-v1/localize",
                headers={"X-Internal-Token": "secret"},
                files={"image": ("query.jpg", _jpeg_bytes(20, 10), "image/jpeg")},
            )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.calls[0]["focal_length_px"], 24.0)
        self.assertEqual(response.json()["quality"]["intrinsicsSource"], "ESTIMATED")

    def test_rejects_missing_internal_token(self):
        with TestClient(self.app) as client:
            self.app.state.map_context = SimpleNamespace(map_version="station-b2-v1")
            response = client.post(
                "/internal/v1/maps/station-b2-v1/localize",
                files={"image": ("query.jpg", _jpeg_bytes(), "image/jpeg")},
            )

        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["failureReason"], "UNAUTHORIZED")
        self.assertEqual(self.calls, [])

    def test_rejects_invalid_image(self):
        with TestClient(self.app) as client:
            self.app.state.map_context = SimpleNamespace(map_version="station-b2-v1")
            response = client.post(
                "/internal/v1/maps/station-b2-v1/localize",
                headers={"X-Internal-Token": "secret"},
                files={"image": ("query.txt", b"not an image", "text/plain")},
            )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["status"], "INVALID_IMAGE")
        self.assertEqual(self.calls, [])

    def test_rejects_unloaded_map_version(self):
        with TestClient(self.app) as client:
            self.app.state.map_context = SimpleNamespace(map_version="station-b2-v1")
            response = client.post(
                "/internal/v1/maps/other-map/localize",
                headers={"X-Internal-Token": "secret"},
                files={"image": ("query.jpg", _jpeg_bytes(), "image/jpeg")},
            )

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()["status"], "MAP_NOT_LOADED")
        self.assertEqual(self.calls, [])

    def test_returns_overloaded_when_inference_queue_is_full(self):
        limiter = _RejectingLimiter()
        self.app.state.inference_limiter = limiter
        with TestClient(self.app) as client:
            self.app.state.map_context = SimpleNamespace(map_version="station-b2-v1")
            response = client.post(
                "/internal/v1/maps/station-b2-v1/localize",
                headers={"X-Internal-Token": "secret"},
                files={"image": ("query.jpg", _jpeg_bytes(), "image/jpeg")},
            )

        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["status"], "OVERLOADED")
        self.assertIsInstance(response.json()["timingMs"]["queue"], int)
        self.assertFalse(limiter.release_called)
        self.assertEqual(self.calls, [])


if __name__ == "__main__":
    unittest.main()
