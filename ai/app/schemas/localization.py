from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


LocalizationStatus = Literal[
    "LOCALIZED",
    "INVALID_IMAGE",
    "INVALID_INTRINSICS",
    "MAP_NOT_LOADED",
    "NO_RETRIEVAL_CANDIDATE",
    "INSUFFICIENT_MATCHES",
    "POSE_ESTIMATION_FAILED",
    "LOW_GEOMETRIC_QUALITY",
    "OVERLOADED",
    "INTERNAL_ERROR",
]


class PoseResponse(BaseModel):
    convention: Literal["CAM_FROM_COLMAP_WORLD"]
    rotationXyzw: list[float] = Field(min_length=4, max_length=4)
    translation: list[float] = Field(min_length=3, max_length=3)
    cameraCenter: list[float] = Field(min_length=3, max_length=3)


class QualityResponse(BaseModel):
    numMatches: int
    numCorrespondences: int
    numInliers: int
    inlierRatio: float
    medianReprojectionErrorPx: float | None
    retrievedImages: int
    supportingImages: int
    intrinsicsSource: str
    confidenceScore: float = Field(ge=0.0, le=1.0)


class TimingResponse(BaseModel):
    total: int
    validation: int | None = None
    queue: int | None = None
    inference: int | None = None


class MapResultResponse(BaseModel):
    mapVersion: str
    floor: str | None = None
    status: LocalizationStatus
    quality: QualityResponse


class LocalizationResponse(BaseModel):
    requestId: str
    status: LocalizationStatus
    mapVersion: str
    selectedMapVersion: str | None = None
    floor: str | None = None
    pose: PoseResponse | None = None
    quality: QualityResponse | None = None
    mapResults: list[MapResultResponse] = Field(default_factory=list)
    timingMs: TimingResponse
    failureReason: str | None = None
