from __future__ import annotations

import hashlib
import json
import sqlite3
from collections.abc import Callable
from pathlib import Path
from pathlib import PurePosixPath
from types import MappingProxyType
from typing import Any

from app.maps.global_descriptor_index import (
    GlobalDescriptorError,
    GlobalDescriptorIndex,
)
from app.maps.map_context import MapContext

REQUIRED_MODEL_FILES = ("cameras.bin", "images.bin", "points3D.bin")
REQUIRED_SERVING_FILES = (
    "reference_features.db",
    "global_descriptors.h5",
    "checksums.sha256",
)


class MapLoadError(RuntimeError):
    """COLMAP 맵을 서빙 가능한 상태로 읽지 못했을 때 발생하는 오류."""


class MapLoader:
    """COLMAP sparse model을 검증하고 읽기 전용 MapContext로 변환한다."""

    def __init__(
        self,
        reconstruction_factory: Callable[[Path], Any] | None = None,
    ) -> None:
        self._reconstruction_factory = reconstruction_factory or self._load_pycolmap_reconstruction

    def load(self, map_version: str, model_path: str | Path) -> MapContext:
        """지정한 sparse model을 로딩하고 요청 간 공유할 맵 정보를 생성한다."""
        resolved_path = Path(model_path).resolve()
        if (resolved_path / "manifest.json").is_file():
            return self.load_serving_map(map_version, resolved_path)
        return self._load_sparse_model(map_version, resolved_path)

    def load_serving_map(
        self,
        map_version: str,
        artifact_path: str | Path,
    ) -> MapContext:
        artifact_path = Path(artifact_path).resolve()
        manifest = self._load_manifest(artifact_path)
        normalized_version = map_version.strip()
        if manifest.get("mapVersion") != normalized_version:
            raise MapLoadError("요청한 mapVersion과 manifest의 mapVersion이 일치하지 않습니다.")
        self._verify_artifact_files(artifact_path, manifest)

        model_path = artifact_path / "reference_sfm"
        context = self._load_sparse_model(normalized_version, model_path)
        expected_names = set(context.image_name_to_id)
        reference_features_path = artifact_path / "reference_features.db"
        self._validate_reference_feature_names(
            reference_features_path,
            expected_names,
        )
        try:
            global_descriptor_index = GlobalDescriptorIndex.load(
                artifact_path / "global_descriptors.h5",
                expected_names=expected_names,
            )
        except GlobalDescriptorError as exc:
            raise MapLoadError(str(exc)) from exc
        self._validate_manifest_contract(manifest, global_descriptor_index)

        return MapContext(
            map_version=context.map_version,
            model_path=context.model_path,
            reconstruction=context.reconstruction,
            image_name_to_id=context.image_name_to_id,
            camera_count=context.camera_count,
            registered_image_count=context.registered_image_count,
            point3d_count=context.point3d_count,
            artifact_path=artifact_path,
            reference_features_path=reference_features_path,
            global_descriptor_index=global_descriptor_index,
            manifest=MappingProxyType(manifest),
        )

    def _load_sparse_model(
        self,
        map_version: str,
        model_path: Path,
    ) -> MapContext:
        if not map_version or not map_version.strip():
            raise MapLoadError("mapVersion은 비어 있을 수 없습니다.")

        self._validate_model_files(model_path)

        try:
            reconstruction = self._reconstruction_factory(model_path)
        except Exception as exc:
            raise MapLoadError(f"COLMAP sparse model 로딩에 실패했습니다: {model_path}") from exc

        camera_count = reconstruction.num_cameras()
        registered_image_count = reconstruction.num_reg_images()
        point3d_count = reconstruction.num_points3D()
        if camera_count == 0:
            raise MapLoadError("COLMAP 맵에 카메라가 없습니다.")
        if registered_image_count == 0:
            raise MapLoadError("COLMAP 맵에 등록된 이미지가 없습니다.")
        if point3d_count == 0:
            raise MapLoadError("COLMAP 맵에 3D point가 없습니다.")

        image_name_to_id: dict[str, int] = {}
        for image_id, image in reconstruction.images.items():
            if image.name in image_name_to_id:
                raise MapLoadError(f"중복된 COLMAP 이미지 이름입니다: {image.name}")
            if image.image_id != image_id:
                raise MapLoadError(f"COLMAP image ID가 일치하지 않습니다: {image.name}")
            image_name_to_id[image.name] = image_id

        if len(image_name_to_id) != registered_image_count:
            raise MapLoadError("등록 이미지 수와 이미지 이름 인덱스 크기가 일치하지 않습니다.")

        return MapContext(
            map_version=map_version.strip(),
            model_path=model_path,
            reconstruction=reconstruction,
            image_name_to_id=MappingProxyType(image_name_to_id),
            camera_count=camera_count,
            registered_image_count=registered_image_count,
            point3d_count=point3d_count,
        )

    @staticmethod
    def _load_manifest(artifact_path: Path) -> dict[str, Any]:
        manifest_path = artifact_path / "manifest.json"
        try:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            raise MapLoadError("serving map manifest를 읽을 수 없습니다.") from exc
        if manifest.get("schemaVersion") != 1:
            raise MapLoadError("지원하지 않는 serving map manifest 버전입니다.")
        if not isinstance(manifest.get("files"), list):
            raise MapLoadError("manifest files 목록이 올바르지 않습니다.")
        return manifest

    @staticmethod
    def _verify_artifact_files(
        artifact_path: Path,
        manifest: dict[str, Any],
    ) -> None:
        declared_paths: set[str] = set()
        for entry in manifest["files"]:
            if not isinstance(entry, dict):
                raise MapLoadError("manifest 파일 항목이 올바르지 않습니다.")
            relative_path = entry.get("path")
            if not isinstance(relative_path, str):
                raise MapLoadError("manifest 파일 경로가 올바르지 않습니다.")
            pure_path = PurePosixPath(relative_path)
            if pure_path.is_absolute() or ".." in pure_path.parts:
                raise MapLoadError(
                    f"manifest에 안전하지 않은 파일 경로가 있습니다: {relative_path}"
                )
            if relative_path in declared_paths:
                raise MapLoadError(f"manifest에 중복된 파일 경로가 있습니다: {relative_path}")
            file_path = artifact_path.joinpath(*pure_path.parts).resolve()
            if not file_path.is_relative_to(artifact_path):
                raise MapLoadError(
                    f"manifest 파일이 serving map 경로를 벗어납니다: {relative_path}"
                )
            if not file_path.is_file():
                raise MapLoadError(f"serving map 필수 파일이 없습니다: {relative_path}")
            if file_path.stat().st_size != entry.get("bytes"):
                raise MapLoadError(f"serving map 파일 크기가 일치하지 않습니다: {relative_path}")
            if MapLoader._sha256(file_path) != entry.get("sha256"):
                raise MapLoadError(f"serving map checksum이 일치하지 않습니다: {relative_path}")
            declared_paths.add(relative_path)

        required_paths = {
            *(f"reference_sfm/{name}" for name in REQUIRED_MODEL_FILES),
            *REQUIRED_SERVING_FILES,
        }
        missing = sorted(required_paths - declared_paths)
        if missing:
            raise MapLoadError(f"manifest에 serving map 필수 파일이 없습니다: {', '.join(missing)}")

    @staticmethod
    def _validate_reference_feature_names(
        database_path: Path,
        expected_names: set[str],
    ) -> None:
        database_uri = f"file:{database_path.resolve().as_posix()}?mode=ro"
        try:
            connection = sqlite3.connect(database_uri, uri=True)
            try:
                names = {
                    row[0]
                    for row in connection.execute(
                        """
                        SELECT images.name
                        FROM images
                        JOIN keypoints USING (image_id)
                        JOIN descriptors USING (image_id)
                        """
                    )
                }
            finally:
                connection.close()
        except sqlite3.Error as exc:
            raise MapLoadError("reference feature DB를 읽을 수 없습니다.") from exc
        if names != expected_names:
            raise MapLoadError(
                "COLMAP 맵과 완전한 reference feature 이미지 이름이 일치하지 않습니다."
            )

    @staticmethod
    def _validate_manifest_contract(
        manifest: dict[str, Any],
        descriptor_index: GlobalDescriptorIndex,
    ) -> None:
        versions = manifest.get("versions")
        if not isinstance(versions, dict) or not all(
            isinstance(versions.get(name), str) and versions[name]
            for name in ("hlocCommit", "pycolmap")
        ):
            raise MapLoadError("manifest 버전 정보가 올바르지 않습니다.")

        features = manifest.get("features")
        if (
            not isinstance(features, dict)
            or features.get("extractor") != "ALIKED_N16ROT"
            or features.get("matcher") != "ALIKED_LIGHTGLUE"
            or features.get("descriptorDimension") != 128
        ):
            raise MapLoadError("manifest local feature 설정이 호환되지 않습니다.")

        retrieval = manifest.get("retrieval")
        expected_retrieval = {
            "name": "netvlad",
            "modelName": descriptor_index.model_name,
            "descriptorDimension": descriptor_index.descriptors.shape[1],
            "resizeMax": descriptor_index.resize_max,
            "imageCount": len(descriptor_index.names),
        }
        if not isinstance(retrieval, dict) or any(
            retrieval.get(key) != value for key, value in expected_retrieval.items()
        ):
            raise MapLoadError("manifest와 global descriptor 검색 설정이 일치하지 않습니다.")

    @staticmethod
    def _sha256(path: Path) -> str:
        digest = hashlib.sha256()
        with path.open("rb") as file:
            while chunk := file.read(8 * 1024 * 1024):
                digest.update(chunk)
        return digest.hexdigest()

    @staticmethod
    def _validate_model_files(model_path: Path) -> None:
        if not model_path.is_dir():
            raise MapLoadError(f"COLMAP sparse model 디렉터리가 없습니다: {model_path}")
        missing = [
            filename for filename in REQUIRED_MODEL_FILES if not (model_path / filename).is_file()
        ]
        if missing:
            raise MapLoadError(f"COLMAP sparse model 필수 파일이 없습니다: {', '.join(missing)}")

    @staticmethod
    def _load_pycolmap_reconstruction(model_path: Path) -> Any:
        try:
            import pycolmap
        except ImportError as exc:
            raise MapLoadError(
                "pycolmap이 설치되지 않았습니다. AI 의존성을 먼저 설치하세요."
            ) from exc
        return pycolmap.Reconstruction(model_path)
