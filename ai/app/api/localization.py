from __future__ import annotations

import json
import math
import time
from io import BytesIO
from typing import Any, Callable
from uuid import uuid4

from fastapi import APIRouter, File, Form, Header, Request, Response, UploadFile, status
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool

from app.core.config import AppSettings
from app.core.inference_limiter import InferenceLimiter
from app.engine.localizer import ImageLocalizer, LocalizationResult
from app.maps.map_context import MapContext
from app.schemas.localization import (
    LocalizationResponse,
    PoseResponse,
    QualityResponse,
    TimingResponse,
)

router = APIRouter(prefix="/internal/v1/maps", tags=["localization"])

LocalizerFactory = Callable[[MapContext], ImageLocalizer]


@router.post("/{map_version}/localize", response_model=LocalizationResponse)
async def localize(
    map_version: str,
    request: Request,
    response: Response,
    image: UploadFile = File(...),
    metadata: str = Form("{}"),
    x_request_id: str | None = Header(default=None, alias="X-Request-Id"),
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> LocalizationResponse:
    started = time.perf_counter()
    request_id = _request_id(x_request_id)
    settings: AppSettings = request.app.state.settings
    validation_started = time.perf_counter()

    if settings.internal_token is not None and x_internal_token != settings.internal_token:
        response.status_code = status.HTTP_401_UNAUTHORIZED
        return _failure(request_id, map_version, "INTERNAL_ERROR", "UNAUTHORIZED", started)

    context: MapContext | None = request.app.state.map_context
    if context is None or context.map_version != map_version:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return _failure(
            request_id,
            map_version,
            "MAP_NOT_LOADED",
            "MAP_NOT_LOADED",
            started,
            validation_ms=_elapsed_ms(validation_started),
        )

    image_bytes = await image.read(settings.max_image_bytes + 1)
    dimensions = _validate_image_bytes(image_bytes, settings)
    if dimensions is None:
        response.status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
        return _failure(
            request_id,
            map_version,
            "INVALID_IMAGE",
            "INVALID_IMAGE",
            started,
            validation_ms=_elapsed_ms(validation_started),
        )

    parsed_metadata = _parse_metadata(metadata)
    focal_length = _focal_length_px(parsed_metadata, dimensions)
    if focal_length is None:
        response.status_code = status.HTTP_422_UNPROCESSABLE_CONTENT
        return _failure(
            request_id,
            map_version,
            "INVALID_INTRINSICS",
            "INVALID_INTRINSICS",
            started,
            validation_ms=_elapsed_ms(validation_started),
        )

    top_k = _top_k(parsed_metadata, settings)
    validation_ms = _elapsed_ms(validation_started)
    factory: LocalizerFactory = request.app.state.localizer_factory
    limiter: InferenceLimiter = request.app.state.inference_limiter
    queue_started = time.perf_counter()
    if not await limiter.acquire():
        response.status_code = status.HTTP_429_TOO_MANY_REQUESTS
        return _failure(
            request_id,
            map_version,
            "OVERLOADED",
            "OVERLOADED",
            started,
            validation_ms=validation_ms,
            queue_ms=_elapsed_ms(queue_started),
        )

    queue_ms = _elapsed_ms(queue_started)
    inference_started = time.perf_counter()
    try:
        result = await run_in_threadpool(
            lambda: factory(context).localize(
                image_bytes,
                focal_length_px=focal_length,
                top_k=top_k,
            )
        )
    except Exception:
        response.status_code = status.HTTP_500_INTERNAL_SERVER_ERROR
        return _failure(
            request_id,
            map_version,
            "INTERNAL_ERROR",
            "INTERNAL_ERROR",
            started,
            validation_ms=validation_ms,
            queue_ms=queue_ms,
            inference_ms=_elapsed_ms(inference_started),
        )
    finally:
        await limiter.release()

    return _from_result(
        request_id=request_id,
        map_version=map_version,
        result=result,
        intrinsics_source=_intrinsics_source(parsed_metadata),
        started=started,
        validation_ms=validation_ms,
        queue_ms=queue_ms,
        inference_ms=_elapsed_ms(inference_started),
    )


def _request_id(value: str | None) -> str:
    if value is not None and value.strip():
        return value.strip()
    return f"loc_{uuid4().hex}"


def _validate_image_bytes(image: bytes, settings: AppSettings) -> tuple[int, int] | None:
    if not image or len(image) > settings.max_image_bytes:
        return None
    if not (image.startswith(b"\xff\xd8\xff") or image.startswith(b"\x89PNG\r\n\x1a\n")):
        return None
    try:
        with Image.open(BytesIO(image)) as opened:
            normalized = ImageOps.exif_transpose(opened)
            width, height = normalized.size
    except (OSError, UnidentifiedImageError, ValueError):
        return None
    if width <= 0 or height <= 0 or width * height > settings.max_pixels:
        return None
    return width, height


def _parse_metadata(raw_metadata: str) -> dict[str, Any]:
    if not raw_metadata.strip():
        return {}
    try:
        parsed = json.loads(raw_metadata)
    except json.JSONDecodeError:
        return {}
    return parsed if isinstance(parsed, dict) else {}


def _focal_length_px(
    metadata: dict[str, Any],
    dimensions: tuple[int, int],
) -> float | None:
    camera = metadata.get("camera") if isinstance(metadata.get("camera"), dict) else {}
    params = camera.get("params")
    if isinstance(params, list) and params:
        focal = params[0]
    else:
        focal = metadata.get("focalLengthPx", max(dimensions) * 1.2)
    try:
        focal_value = float(focal)
    except (TypeError, ValueError):
        return None
    return focal_value if math.isfinite(focal_value) and focal_value > 0 else None


def _top_k(metadata: dict[str, Any], settings: AppSettings) -> int:
    try:
        value = int(metadata.get("topK", settings.default_top_k))
    except (TypeError, ValueError):
        return settings.default_top_k
    return min(max(value, 1), settings.max_top_k)


def _intrinsics_source(metadata: dict[str, Any]) -> str:
    camera = metadata.get("camera") if isinstance(metadata.get("camera"), dict) else {}
    source = camera.get("intrinsicsSource")
    return source if isinstance(source, str) and source else "ESTIMATED"


def _from_result(
    request_id: str,
    map_version: str,
    result: LocalizationResult,
    intrinsics_source: str,
    started: float,
    validation_ms: int | None = None,
    queue_ms: int | None = None,
    inference_ms: int | None = None,
) -> LocalizationResponse:
    pose = None
    if result.camera_center is not None and result.cam_from_world is not None:
        pose = PoseResponse(
            convention="CAM_FROM_COLMAP_WORLD",
            rotationXyzw=result.cam_from_world["rotation_xyzw"],
            translation=result.cam_from_world["translation"],
            cameraCenter=list(result.camera_center),
        )
    return LocalizationResponse(
        requestId=request_id,
        status=result.status,
        mapVersion=map_version,
        pose=pose,
        quality=QualityResponse(
            numMatches=result.total_matches,
            numCorrespondences=result.correspondence_count,
            numInliers=result.num_inliers,
            inlierRatio=result.inlier_ratio,
            medianReprojectionErrorPx=result.median_reprojection_error,
            retrievedImages=len(result.candidates),
            supportingImages=result.supporting_reference_images,
            intrinsicsSource=intrinsics_source,
        ),
        timingMs=TimingResponse(
            total=_elapsed_ms(started),
            validation=validation_ms,
            queue=queue_ms,
            inference=inference_ms,
        ),
        failureReason=None if result.status == "LOCALIZED" else result.status,
    )


def _failure(
    request_id: str,
    map_version: str,
    status_value: str,
    reason: str,
    started: float,
    validation_ms: int | None = None,
    queue_ms: int | None = None,
    inference_ms: int | None = None,
) -> LocalizationResponse:
    return LocalizationResponse(
        requestId=request_id,
        status=status_value,
        mapVersion=map_version,
        timingMs=TimingResponse(
            total=_elapsed_ms(started),
            validation=validation_ms,
            queue=queue_ms,
            inference=inference_ms,
        ),
        failureReason=reason,
    )


def _elapsed_ms(started: float) -> int:
    return int((time.perf_counter() - started) * 1000)
