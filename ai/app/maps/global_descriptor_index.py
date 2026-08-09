from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from types import MappingProxyType
from typing import Mapping

import h5py
import numpy as np


class GlobalDescriptorError(ValueError):
    """검색용 global descriptor 파일의 계약이 올바르지 않을 때 발생하는 오류."""


@dataclass(frozen=True, slots=True)
class GlobalDescriptorIndex:
    names: tuple[str, ...]
    descriptors: np.ndarray
    name_to_index: Mapping[str, int]
    model_name: str
    resize_max: int

    @classmethod
    def load(
        cls,
        path: str | Path,
        expected_names: set[str] | None = None,
        expected_dimension: int = 4096,
    ) -> GlobalDescriptorIndex:
        descriptor_path = Path(path)
        if not descriptor_path.is_file():
            raise GlobalDescriptorError(f"global descriptor 파일이 없습니다: {descriptor_path}")

        entries: dict[str, np.ndarray] = {}
        with h5py.File(descriptor_path, "r") as file:
            model_name = str(file.attrs.get("model_name", ""))
            resize_max = int(file.attrs.get("resize_max", 0))

            def collect(name: str, value: h5py.Group | h5py.Dataset) -> None:
                if isinstance(value, h5py.Dataset) and name.endswith("/global_descriptor"):
                    image_name = name.removesuffix("/global_descriptor")
                    entries[image_name] = np.asarray(value, dtype=np.float32)

            file.visititems(collect)

        if not entries:
            raise GlobalDescriptorError("global descriptor가 하나도 없습니다.")
        if expected_names is not None and set(entries) != expected_names:
            missing = sorted(expected_names - set(entries))
            unexpected = sorted(set(entries) - expected_names)
            raise GlobalDescriptorError(
                "기준 이미지와 global descriptor 이름이 일치하지 않습니다: "
                f"missing={missing[:3]}, unexpected={unexpected[:3]}"
            )

        names = tuple(sorted(entries))
        for name in names:
            descriptor = entries[name]
            if descriptor.shape != (expected_dimension,):
                raise GlobalDescriptorError(
                    f"global descriptor 차원이 올바르지 않습니다: {name}={descriptor.shape}"
                )
            if not np.isfinite(descriptor).all():
                raise GlobalDescriptorError(
                    f"global descriptor에 유한하지 않은 값이 있습니다: {name}"
                )

        descriptors = np.stack([entries[name] for name in names])
        norms = np.linalg.norm(descriptors, axis=1)
        if not np.allclose(norms, 1.0, atol=1e-3):
            raise GlobalDescriptorError("global descriptor는 L2 정규화되어야 합니다.")

        descriptors.setflags(write=False)
        return cls(
            names=names,
            descriptors=descriptors,
            name_to_index=MappingProxyType({name: index for index, name in enumerate(names)}),
            model_name=model_name,
            resize_max=resize_max,
        )

    def find(self, image_name: str) -> np.ndarray | None:
        index = self.name_to_index.get(image_name)
        return None if index is None else self.descriptors[index]
