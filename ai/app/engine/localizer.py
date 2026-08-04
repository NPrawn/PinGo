from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import numpy as np
import torch

from app.engine.feature_extractor import AlikedFeatureExtractor, LocalFeatures
from app.engine.global_feature_extractor import NetVladFeatureExtractor
from app.engine.image_preprocessor import prepare_query_variants
from app.maps.map_context import MapContext


@dataclass(frozen=True, slots=True)
class RetrievalCandidate:
    image_name: str
    similarity: float


@dataclass(frozen=True, slots=True)
class LocalizationResult:
    status: str
    candidates: tuple[RetrievalCandidate, ...]
    total_matches: int
    correspondence_count: int
    supporting_reference_images: int
    num_inliers: int
    inlier_ratio: float
    median_reprojection_error: float | None
    camera_center: tuple[float, float, float] | None
    cam_from_world: dict[str, Any] | None


@dataclass(frozen=True, slots=True)
class PreparedQuery:
    """모든 맵이 공유하는 Query 전역·지역 특징."""

    global_descriptor: np.ndarray
    local_features: LocalFeatures


@dataclass(frozen=True, slots=True)
class MapLocalizationResult:
    map_version: str
    floor: str | None
    result: LocalizationResult


@dataclass(frozen=True, slots=True)
class MultiMapLocalizationResult:
    selected_map_version: str | None
    floor: str | None
    result: LocalizationResult
    map_results: tuple[MapLocalizationResult, ...]


@dataclass(frozen=True, slots=True)
class _ReferenceFeatures:
    keypoints: np.ndarray
    descriptors: np.ndarray
    image_size: tuple[int, int]


@dataclass(frozen=True, slots=True)
class _Correspondence:
    query_index: int
    point3d_id: int
    score: float
    reference_name: str


class ImageLocalizer:
    """단일 Query 이미지를 기존 serving map에 위치시키는 로컬 추론기."""

    MIN_INLIERS = 25
    MIN_INLIER_RATIO = 0.20
    MAX_MEDIAN_REPROJECTION_ERROR = 8.0

    def __init__(
        self,
        context: MapContext,
        device: str | torch.device | None = None,
        global_extractor: NetVladFeatureExtractor | None = None,
        local_extractor: AlikedFeatureExtractor | None = None,
        matcher: Any | None = None,
        input_size: int = 768,
    ) -> None:
        if context.reference_features_path is None:
            raise ValueError("reference feature DB가 포함된 serving map이 필요합니다.")
        if context.global_descriptor_index is None:
            raise ValueError("global descriptor가 포함된 serving map이 필요합니다.")
        self.context = context
        requested_device = str(device or "auto").lower()
        if requested_device == "auto":
            requested_device = "cuda" if torch.cuda.is_available() else "cpu"
        if requested_device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("AI_DEVICE=cuda로 설정됐지만 CUDA를 사용할 수 없습니다.")
        self.device = torch.device(requested_device)
        self.global_extractor = global_extractor or NetVladFeatureExtractor(
            resize_max=context.global_descriptor_index.resize_max,
            device=self.device,
        )
        self.local_extractor = local_extractor or AlikedFeatureExtractor(device=self.device)
        self._matcher: Any | None = matcher
        self.input_size = input_size

    def load(self) -> None:
        """서버 시작 시 세 모델을 한 번 로드하여 요청 경로에서 재사용한다."""
        self.global_extractor.load()
        self.local_extractor.load()
        self._load_matcher()

    def localize(
        self,
        image: bytes,
        focal_length_px: float,
        top_k: int = 20,
    ) -> LocalizationResult:
        return self.localize_prepared(
            self.prepare_query(image),
            focal_length_px=focal_length_px,
            top_k=top_k,
        )

    def prepare_query(self, image: bytes) -> PreparedQuery:
        """Query 특징을 한 번 추출하여 여러 맵에서 재사용할 수 있게 한다."""
        return PreparedQuery(
            global_descriptor=self.global_extractor.extract(image),
            local_features=self.local_extractor.extract(image),
        )

    def localize_prepared(
        self,
        prepared: PreparedQuery,
        focal_length_px: float,
        top_k: int = 20,
    ) -> LocalizationResult:
        candidates = self._retrieve(prepared.global_descriptor, top_k)
        query = prepared.local_features
        correspondences, total_matches = self._match_candidates(query, candidates)
        selected = self._select_correspondences(correspondences)
        if len(selected) < 4:
            return self._failed_result("INSUFFICIENT_MATCHES", candidates, total_matches, selected)

        import pycolmap

        camera = pycolmap.Camera(
            model="SIMPLE_PINHOLE",
            width=query.image_size[0],
            height=query.image_size[1],
            params=[
                focal_length_px,
                query.image_size[0] / 2.0,
                query.image_size[1] / 2.0,
            ],
        )
        points2d = np.asarray(
            [query.keypoints[item.query_index] for item in selected],
            dtype=np.float64,
        )
        points3d = np.asarray(
            [self.context.reconstruction.points3D[item.point3d_id].xyz for item in selected],
            dtype=np.float64,
        )
        pose = pycolmap.estimate_and_refine_absolute_pose(points2d, points3d, camera)
        if pose is None:
            return self._failed_result(
                "POSE_ESTIMATION_FAILED", candidates, total_matches, selected
            )

        num_inliers = int(pose["num_inliers"])
        inlier_ratio = num_inliers / len(selected)
        rigid = pose["cam_from_world"]
        inlier_mask = np.asarray(pose["inlier_mask"], dtype=bool)
        projected = camera.img_from_cam(rigid * points3d)
        reprojection_errors = np.linalg.norm(projected - points2d, axis=1)
        median_reprojection_error = (
            float(np.median(reprojection_errors[inlier_mask])) if inlier_mask.any() else None
        )
        if (
            num_inliers < self.MIN_INLIERS
            or inlier_ratio < self.MIN_INLIER_RATIO
            or median_reprojection_error is None
            or median_reprojection_error > self.MAX_MEDIAN_REPROJECTION_ERROR
        ):
            return LocalizationResult(
                status="LOW_GEOMETRIC_QUALITY",
                candidates=candidates,
                total_matches=total_matches,
                correspondence_count=len(selected),
                supporting_reference_images=len({item.reference_name for item in selected}),
                num_inliers=num_inliers,
                inlier_ratio=inlier_ratio,
                median_reprojection_error=median_reprojection_error,
                camera_center=None,
                cam_from_world=None,
            )

        center = np.asarray(rigid.inverse().translation, dtype=np.float64)
        return LocalizationResult(
            status="LOCALIZED",
            candidates=candidates,
            total_matches=total_matches,
            correspondence_count=len(selected),
            supporting_reference_images=len({item.reference_name for item in selected}),
            num_inliers=num_inliers,
            inlier_ratio=inlier_ratio,
            median_reprojection_error=median_reprojection_error,
            camera_center=tuple(float(value) for value in center),
            cam_from_world={
                "rotation_xyzw": [float(value) for value in rigid.rotation.quat],
                "translation": [float(value) for value in rigid.translation],
            },
        )

    def _retrieve(
        self,
        descriptor: np.ndarray,
        top_k: int,
    ) -> tuple[RetrievalCandidate, ...]:
        index = self.context.global_descriptor_index
        assert index is not None
        if top_k <= 0:
            raise ValueError("top_k는 1 이상이어야 합니다.")
        similarities = index.descriptors @ descriptor
        count = min(top_k, len(index.names))
        indices = np.argpartition(-similarities, count - 1)[:count]
        indices = indices[np.argsort(-similarities[indices])]
        return tuple(RetrievalCandidate(index.names[i], float(similarities[i])) for i in indices)

    def _match_candidates(
        self,
        query: LocalFeatures,
        candidates: tuple[RetrievalCandidate, ...],
    ) -> tuple[list[_Correspondence], int]:
        all_correspondences: list[_Correspondence] = []
        total_matches = 0
        for candidate in candidates:
            reference = self._load_reference(candidate.image_name)
            matches, scores = self._match(query, reference)
            total_matches += len(matches)
            image_id = self.context.find_image_id(candidate.image_name)
            if image_id is None:
                continue
            reference_image = self.context.reconstruction.images[image_id]
            for (query_index, reference_index), score in zip(matches, scores):
                point2d = reference_image.points2D[int(reference_index)]
                if not point2d.has_point3D():
                    continue
                all_correspondences.append(
                    _Correspondence(
                        query_index=int(query_index),
                        point3d_id=int(point2d.point3D_id),
                        score=float(score),
                        reference_name=candidate.image_name,
                    )
                )
        return all_correspondences, total_matches

    def _load_reference(self, image_name: str) -> _ReferenceFeatures:
        database_path = Path(self.context.reference_features_path).resolve()
        uri = f"file:{database_path.as_posix()}?mode=ro"
        connection = sqlite3.connect(uri, uri=True)
        try:
            row = connection.execute(
                """
                SELECT i.camera_id,
                       k.rows, k.cols, k.data,
                       d.rows, d.cols, d.data
                FROM images i
                JOIN keypoints k USING(image_id)
                JOIN descriptors d USING(image_id)
                WHERE i.name = ?
                """,
                (image_name,),
            ).fetchone()
        finally:
            connection.close()
        if row is None:
            raise RuntimeError(f"기준 특징을 찾을 수 없습니다: {image_name}")
        camera_id, kp_rows, kp_cols, kp_data, desc_rows, desc_cols, desc_data = row
        descriptor_dimension = desc_cols // np.dtype("<f4").itemsize
        if kp_cols < 2 or descriptor_dimension != 128 or kp_rows != desc_rows:
            raise RuntimeError(f"기준 특징 형식이 올바르지 않습니다: {image_name}")
        camera = self.context.reconstruction.cameras[int(camera_id)]
        return _ReferenceFeatures(
            keypoints=np.frombuffer(kp_data, dtype="<f4").reshape(kp_rows, kp_cols)[:, :2],
            descriptors=np.frombuffer(desc_data, dtype="<f4").reshape(
                desc_rows, descriptor_dimension
            ),
            image_size=(int(camera.width), int(camera.height)),
        )

    def _match(
        self,
        query: LocalFeatures,
        reference: _ReferenceFeatures,
    ) -> tuple[np.ndarray, np.ndarray]:
        self._load_matcher()
        data = {
            "image0": self._as_matcher_input(query.keypoints, query.descriptors, query.image_size),
            "image1": self._as_matcher_input(
                reference.keypoints,
                reference.descriptors,
                reference.image_size,
            ),
        }
        with torch.inference_mode():
            result = self._matcher(data)
        return (
            result["matches"][0].detach().cpu().numpy(),
            result["scores"][0].detach().cpu().numpy(),
        )

    def _load_matcher(self) -> None:
        if self._matcher is None:
            from lightglue import LightGlue

            self._matcher = LightGlue(features="aliked").eval().to(self.device)

    def _as_matcher_input(
        self,
        keypoints: np.ndarray,
        descriptors: np.ndarray,
        image_size: tuple[int, int],
    ) -> dict[str, torch.Tensor]:
        return {
            "keypoints": torch.from_numpy(np.array(keypoints, copy=True))
            .float()
            .unsqueeze(0)
            .to(self.device),
            "descriptors": torch.from_numpy(np.array(descriptors, copy=True))
            .float()
            .unsqueeze(0)
            .to(self.device),
            "image_size": torch.tensor(
                image_size, dtype=torch.float32, device=self.device
            ).unsqueeze(0),
        }

    @staticmethod
    def _select_correspondences(
        correspondences: list[_Correspondence],
    ) -> list[_Correspondence]:
        selected: list[_Correspondence] = []
        query_indices: set[int] = set()
        point3d_ids: set[int] = set()
        for item in sorted(correspondences, key=lambda value: value.score, reverse=True):
            if item.query_index in query_indices or item.point3d_id in point3d_ids:
                continue
            selected.append(item)
            query_indices.add(item.query_index)
            point3d_ids.add(item.point3d_id)
        return selected

    @staticmethod
    def _failed_result(
        status: str,
        candidates: tuple[RetrievalCandidate, ...],
        total_matches: int,
        selected: list[_Correspondence],
    ) -> LocalizationResult:
        return LocalizationResult(
            status=status,
            candidates=candidates,
            total_matches=total_matches,
            correspondence_count=len(selected),
            supporting_reference_images=len({item.reference_name for item in selected}),
            num_inliers=0,
            inlier_ratio=0.0,
            median_reprojection_error=None,
            camera_center=None,
            cam_from_world=None,
        )


class MultiMapLocalizer:
    """하나의 Query 특징으로 여러 층 맵을 비교하는 공유 추론 엔진."""

    def __init__(
        self,
        contexts: dict[str, MapContext],
        device: str | torch.device | None = None,
        global_extractor: NetVladFeatureExtractor | None = None,
        local_extractor: AlikedFeatureExtractor | None = None,
        matcher: Any | None = None,
    ) -> None:
        if not contexts:
            raise ValueError("하나 이상의 serving map이 필요합니다.")
        requested_device = str(device or "auto").lower()
        if requested_device == "auto":
            requested_device = "cuda" if torch.cuda.is_available() else "cpu"
        if requested_device == "cuda" and not torch.cuda.is_available():
            raise RuntimeError("AI_DEVICE=cuda로 설정됐지만 CUDA를 사용할 수 없습니다.")
        self.device = torch.device(requested_device)
        self.contexts = dict(contexts)

        indexes = [context.global_descriptor_index for context in contexts.values()]
        if any(index is None for index in indexes):
            raise ValueError("모든 맵에 global descriptor가 필요합니다.")
        resize_values = {index.resize_max for index in indexes if index is not None}
        model_names = {index.model_name for index in indexes if index is not None}
        if len(resize_values) != 1 or len(model_names) != 1:
            raise ValueError("모든 맵의 NetVLAD 모델과 resize 설정이 같아야 합니다.")

        self.global_extractor = global_extractor or NetVladFeatureExtractor(
            resize_max=resize_values.pop(),
            device=self.device,
        )
        self.local_extractor = local_extractor or AlikedFeatureExtractor(device=self.device)
        self._matcher = matcher
        self._localizers: dict[str, ImageLocalizer] = {}

    def load(self) -> None:
        """공유 모델은 한 번만 로드하고 맵별 로컬라이저에 같은 객체를 주입한다."""
        self.global_extractor.load()
        self.local_extractor.load()
        if self._matcher is None:
            from lightglue import LightGlue

            self._matcher = LightGlue(features="aliked").eval().to(self.device)
        if not self._localizers:
            self._localizers = {
                version: ImageLocalizer(
                    context,
                    device=self.device,
                    global_extractor=self.global_extractor,
                    local_extractor=self.local_extractor,
                    matcher=self._matcher,
                )
                for version, context in self.contexts.items()
            }

    def localize(
        self,
        image: bytes,
        focal_length_px: float,
        top_k: int = 20,
        map_versions: tuple[str, ...] | None = None,
    ) -> MultiMapLocalizationResult:
        self.load()
        versions = map_versions or tuple(self.contexts)
        unknown = sorted(set(versions) - set(self.contexts))
        if unknown:
            raise ValueError(f"로드되지 않은 mapVersion입니다: {', '.join(unknown)}")

        prepared = PreparedQuery(
            global_descriptor=self.global_extractor.extract(image),
            local_features=self.local_extractor.extract(image),
        )
        map_results = tuple(
            MapLocalizationResult(
                map_version=version,
                floor=self._floor(self.contexts[version]),
                result=self._localizers[version].localize_prepared(
                    prepared,
                    focal_length_px=focal_length_px,
                    top_k=top_k,
                ),
            )
            for version in versions
        )
        localized = tuple(
            item for item in map_results if item.result.status == "LOCALIZED"
        )
        ranked = localized or map_results
        best = max(
            ranked,
            key=lambda item: (
                item.result.num_inliers,
                item.result.inlier_ratio,
                -(
                    item.result.median_reprojection_error
                    if item.result.median_reprojection_error is not None
                    else float("inf")
                ),
            ),
        )
        return MultiMapLocalizationResult(
            selected_map_version=best.map_version if localized else None,
            floor=best.floor if localized else None,
            result=best.result,
            map_results=map_results,
        )

    @staticmethod
    def _floor(context: MapContext) -> str | None:
        if context.manifest is None:
            return None
        floor = context.manifest.get("floor")
        return str(floor) if floor is not None else None
