#!/usr/bin/env python3
"""세 좌표계(COLMAP / 캐노니컬 미터 / 평면도 픽셀)를 각각 찍고, 같은 프레임으로 겹쳐 본다.

목적은 "정합이 맞는지" 눈으로 확인하는 것이다. 세 좌표계는 다음 사슬로 이어져 있고,
이 스크립트는 사슬의 각 단계를 그대로 재현한다.

    COLMAP (cx,cy,cz)
      --[ vps.anchoring.floors 의 2x3 어파인 ]-->  캐노니컬 미터 (x,y)
      --[ 좌표 프레임 originPx/angleDeg/mpp ]-->   원본 평면도 픽셀 (px,py)

어파인 계수와 프레임 값의 출처:
  - backend/src/main/resources/application.yaml  ->  vps.anchoring.floors
  - ai/tools/colmap_align_result.json            ->  floors[*].affine_m / affine_offset
  - docs/역삼역_FE_좌표연동_스펙.md §2            ->  층별 좌표 프레임
  - frontend/src/entities/floor-map/lib/coordinates.ts -> meterToPixel 구현

입력:
  colmap_centers.csv  : images.bin 에서 뽑은 등록 이미지의 카메라 중심
                        (floor,image_id,name,colmap_cx,colmap_cy,colmap_cz)
  colmap_align_result.json : 어파인 계수 + 기준점(COLMAP/캐노니컬 쌍)

출력:
  coords_aligned.csv  : 세 좌표계를 한 행에 나란히 담은 표 (파이썬에서 다시 그릴 용도)
  coords_panels.png   : 세 좌표계를 각각 따로 찍은 패널 + 캐노니컬 프레임으로 겹친 패널
  coords_residuals.png: 기준점 정합 잔차
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt

# 한글 라벨용 폰트. 없으면 기본값으로 두고 라벨만 깨진다.
for _f in ("Noto Sans CJK KR", "Noto Sans CJK JP", "NanumGothic", "Malgun Gothic"):
    try:
        matplotlib.font_manager.findfont(_f, fallback_to_default=False)
        plt.rcParams["font.family"] = _f
        break
    except Exception:
        continue
plt.rcParams["axes.unicode_minus"] = False
import numpy as np

# ── 표시 상수 ─────────────────────────────────────────────────────────────────
# 색은 슬롯 순서로 고정한다. 시리즈가 늘어도 순환시키지 않는다.
C_COLMAP = "#2a78d6"  # 슬롯 1 — COLMAP 원시
C_CANON = "#eb6834"  # 슬롯 2 — 캐노니컬 미터
C_PIXEL = "#1baf7a"  # 슬롯 3 — 평면도 픽셀
C_CTRL = "#4a3aa7"  # 슬롯 7 — 기준점
INK = "#0b0b0b"
INK_2 = "#52514e"
MUTED = "#898781"
GRID = "#e1e0d9"
SURFACE = "#fcfcfb"

# 층별 좌표 프레임 (좌표 스펙 §2). 원본 이미지 픽셀 크기 기준이다.
FRAME = {
    "B1": dict(ox=594, oy=501, angle_deg=-21.28, mpp=0.19, w=1626, h=967),
    "B2": dict(ox=622, oy=512, angle_deg=-21.28, mpp=0.19, w=1624, h=969),
    "B3": dict(ox=597, oy=497, angle_deg=-21.28, mpp=0.19, w=1659, h=948),
}


def meter_to_pixel(x, y, floor):
    """캐노니컬 미터 -> 원본 평면도 픽셀. coordinates.ts 의 meterToPixel 과 같은 식이다."""
    f = FRAME[floor]
    t = math.radians(f["angle_deg"])
    c, s = math.cos(t), math.sin(t)
    return (
        f["ox"] + (c * x - s * y) / f["mpp"],
        f["oy"] + (s * x + c * y) / f["mpp"],
    )


def pixel_to_meter(px, py, floor):
    """역변환. 왕복 오차 확인용이다."""
    f = FRAME[floor]
    t = math.radians(f["angle_deg"])
    c, s = math.cos(t), math.sin(t)
    dx, dy = px - f["ox"], py - f["oy"]
    return ((dx * c + dy * s) * f["mpp"], (-dx * s + dy * c) * f["mpp"])


def colmap_to_canonical(cx, cy, cz, m, offset):
    """COLMAP -> 캐노니컬 미터. ColmapToCanonicalMapper.toCanonical 과 같은 식이다."""
    return (
        m[0] * cx + m[1] * cy + m[2] * cz + offset[0],
        m[3] * cx + m[4] * cy + m[5] * cz + offset[1],
    )


def load_centers(path):
    rows = []
    with open(path, newline="", encoding="utf-8") as fh:
        for r in csv.DictReader(fh):
            rows.append(
                dict(
                    floor=r["floor"],
                    name=r["name"],
                    cx=float(r["colmap_cx"]),
                    cy=float(r["colmap_cy"]),
                    cz=float(r["colmap_cz"]),
                )
            )
    return rows


def build(centers, align, floors):
    """각 층별로 세 좌표계를 계산해 한 행씩 만든다."""
    out = []
    for row in centers:
        fl = row["floor"]
        if fl not in floors:
            continue
        spec = align["floors"][fl]
        m, off = spec["affine_m"], spec["affine_offset"]
        mx, my = colmap_to_canonical(row["cx"], row["cy"], row["cz"], m, off)
        px, py = meter_to_pixel(mx, my, fl)
        # 왕복 검증: 픽셀에서 미터로 되돌렸을 때 벌어지는 거리.
        rx, ry = pixel_to_meter(px, py, fl)
        out.append(
            dict(
                floor=fl,
                name=row["name"],
                colmap_cx=row["cx"],
                colmap_cy=row["cy"],
                colmap_cz=row["cz"],
                map_x=mx,
                map_y=my,
                map_z=spec["nominal_z"],
                pixel_px=px,
                pixel_py=py,
                roundtrip_err_m=math.hypot(rx - mx, ry - my),
            )
        )
    return out


def style(ax, title, xlabel, ylabel, note=None):
    ax.set_facecolor(SURFACE)
    ax.set_title(title, color=INK, fontsize=11, pad=10, loc="left")
    ax.set_xlabel(xlabel, color=MUTED, fontsize=9)
    ax.set_ylabel(ylabel, color=MUTED, fontsize=9)
    ax.grid(True, color=GRID, linewidth=0.6, zorder=0)
    ax.set_axisbelow(True)
    for side in ("top", "right"):
        ax.spines[side].set_visible(False)
    for side in ("left", "bottom"):
        ax.spines[side].set_color("#c3c2b7")
        ax.spines[side].set_linewidth(1)
    ax.tick_params(colors=MUTED, labelsize=8)
    if note:
        ax.text(
            0.015,
            0.015,
            note,
            transform=ax.transAxes,
            fontsize=7.5,
            color=INK_2,
            va="bottom",
            ha="left",
        )


# 층별 마커 — 색만으로 층을 구분하지 않는다.
FLOOR_MARKER = {"B1": "^", "B2": "o", "B3": "s"}


def panels(rows, align, floors, out_png):
    """세 좌표계를 각각 따로, 마지막에 캐노니컬 프레임으로 겹쳐서 그린다."""
    fig, axes = plt.subplots(2, 2, figsize=(14.5, 12.5), facecolor=SURFACE)
    fig.suptitle(
        "역삼역 좌표계 대조 — COLMAP · 캐노니컬 미터 · 평면도 픽셀",
        color=INK,
        fontsize=14,
        x=0.02,
        ha="left",
        y=0.985,
    )

    by_floor = {fl: [r for r in rows if r["floor"] == fl] for fl in floors}

    # ① COLMAP 원시. 축이 재구성마다 임의(gauge freedom)이므로 분산이 큰 두 축을 골라 쓴다.
    ax = axes[0][0]
    for fl in floors:
        rs = by_floor[fl]
        if not rs:
            continue
        arr = np.array([[r["colmap_cx"], r["colmap_cy"], r["colmap_cz"]] for r in rs])
        order = np.argsort(arr.var(axis=0))[::-1][:2]
        a, b = sorted(order)
        label = "xyz"
        ax.scatter(
            arr[:, a],
            arr[:, b],
            s=14,
            c=C_COLMAP,
            alpha=0.75,
            marker=FLOOR_MARKER[fl],
            linewidths=0.5,
            edgecolors=SURFACE,
            label=f"{fl} COLMAP ({label[a]},{label[b]})",
            zorder=3,
        )
    for fl in floors:
        for cp in align["floors"][fl]["control_points"]:
            c = cp["colmap"]
            arr = np.array(
                [[r["colmap_cx"], r["colmap_cy"], r["colmap_cz"]] for r in by_floor[fl]]
            )
            order = np.argsort(arr.var(axis=0))[::-1][:2]
            a, b = sorted(order)
            ax.scatter(
                c[a],
                c[b],
                s=70,
                marker="X",
                c=C_CTRL,
                edgecolors=SURFACE,
                linewidths=1.2,
                zorder=5,
            )
    style(
        ax,
        "① COLMAP 원시 좌표 (분산 상위 2축)",
        "COLMAP 축 (임의 단위)",
        "COLMAP 축 (임의 단위)",
        "축·축척·원점이 재구성마다 임의로 정해진다 (gauge freedom).\n"
        "층별로 별개 재구성이라 B2·B3 를 같은 그림에서 비교하면 안 된다.\nX = 정합 기준점",
    )
    ax.legend(
        frameon=False, fontsize=8, labelcolor=INK_2, loc="upper right", handletextpad=0.4
    )
    ax.set_aspect("equal", adjustable="datalim")

    # ② 캐노니컬 미터.
    ax = axes[0][1]
    for fl in floors:
        rs = by_floor[fl]
        if not rs:
            continue
        ax.scatter(
            [r["map_x"] for r in rs],
            [r["map_y"] for r in rs],
            s=14,
            c=C_CANON,
            alpha=0.75,
            marker=FLOOR_MARKER[fl],
            linewidths=0.5,
            edgecolors=SURFACE,
            label=f"{fl} 캐노니컬 (m)",
            zorder=3,
        )
    for fl in floors:
        for cp in align["floors"][fl]["control_points"]:
            ax.scatter(
                cp["canonical"][0],
                cp["canonical"][1],
                s=70,
                marker="X",
                c=C_CTRL,
                edgecolors=SURFACE,
                linewidths=1.2,
                zorder=5,
            )
            ax.annotate(
                cp["name"],
                (cp["canonical"][0], cp["canonical"][1]),
                textcoords="offset points",
                xytext=(6, 4),
                fontsize=7.5,
                color=INK_2,
            )
    ax.scatter(0, 0, s=110, marker="+", c=INK, linewidths=1.6, zorder=6)
    ax.annotate(
        "원점 EVA (0,0)",
        (0, 0),
        textcoords="offset points",
        xytext=(8, -12),
        fontsize=8,
        color=INK,
    )
    style(
        ax,
        "② 캐노니컬 미터 좌표 — 어파인 적용 후",
        "캐노니컬 X (m)",
        "캐노니컬 Y (m)",
        "원점 = 층간 엘리베이터 EVA, +X = 승강장·6번출구 축.\nX = 정합 기준점(실측 캐노니컬 값)",
    )
    ax.legend(
        frameon=False, fontsize=8, labelcolor=INK_2, loc="upper right", handletextpad=0.4
    )
    ax.set_aspect("equal", adjustable="datalim")

    # ③ 평면도 픽셀. 이미지 좌표라 y축을 뒤집는다.
    ax = axes[1][0]
    for fl in floors:
        rs = by_floor[fl]
        if not rs:
            continue
        ax.scatter(
            [r["pixel_px"] for r in rs],
            [r["pixel_py"] for r in rs],
            s=14,
            c=C_PIXEL,
            alpha=0.75,
            marker=FLOOR_MARKER[fl],
            linewidths=0.5,
            edgecolors=SURFACE,
            label=f"{fl} 픽셀 (원본 {FRAME[fl]['w']}×{FRAME[fl]['h']})",
            zorder=3,
        )
    for fl in floors:
        f = FRAME[fl]
        ax.add_patch(
            plt.Rectangle(
                (0, 0),
                f["w"],
                f["h"],
                fill=False,
                edgecolor="#c3c2b7",
                linewidth=1,
                linestyle="--",
                zorder=2,
            )
        )
        for cp in align["floors"][fl]["control_points"]:
            px, py = meter_to_pixel(cp["canonical"][0], cp["canonical"][1], fl)
            ax.scatter(
                px, py, s=70, marker="X", c=C_CTRL, edgecolors=SURFACE, linewidths=1.2, zorder=5
            )
    # 이미지 경계에 맞춰 잘라 둔다. 평면도 위에 올렸을 때의 자리와 같게 읽히도록.
    wmax = max(FRAME[fl]["w"] for fl in floors)
    hmax = max(FRAME[fl]["h"] for fl in floors)
    ax.set_xlim(-40, wmax + 40)
    ax.set_ylim(hmax + 40, -40)
    style(
        ax,
        "③ 원본 평면도 픽셀 좌표",
        "px (이미지 좌표)",
        "py (이미지 좌표, 아래로 증가)",
        "점선 = 원본 이미지 경계. 밖으로 나간 점은 평면도에 그릴 수 없다.\n"
        "표시 크기가 다르면 표시크기/원본크기 배율을 곱한다.",
    )
    ax.legend(
        frameon=False, fontsize=8, labelcolor=INK_2, loc="upper right", handletextpad=0.4
    )
    ax.set_aspect("equal", adjustable="datalim")

    # ④ 겹치기. 픽셀을 미터로 되돌려 캐노니컬 프레임에서 세 계열을 한 축에 올린다.
    ax = axes[1][1]
    for fl in floors:
        rs = by_floor[fl]
        if not rs:
            continue
        ax.scatter(
            [r["map_x"] for r in rs],
            [r["map_y"] for r in rs],
            s=42,
            c=C_CANON,
            alpha=0.5,
            marker=FLOOR_MARKER[fl],
            linewidths=0,
            label=f"{fl} 캐노니컬 (어파인 결과)",
            zorder=3,
        )
        back = [pixel_to_meter(r["pixel_px"], r["pixel_py"], fl) for r in rs]
        ax.scatter(
            [b[0] for b in back],
            [b[1] for b in back],
            s=8,
            c=C_PIXEL,
            alpha=0.9,
            marker=FLOOR_MARKER[fl],
            linewidths=0,
            label=f"{fl} 픽셀 → 미터 역변환",
            zorder=4,
        )
    for fl in floors:
        for cp in align["floors"][fl]["control_points"]:
            spec = align["floors"][fl]
            fx, fy = colmap_to_canonical(*cp["colmap"], spec["affine_m"], spec["affine_offset"])
            gx, gy = cp["canonical"][0], cp["canonical"][1]
            ax.annotate(
                "",
                xy=(fx, fy),
                xytext=(gx, gy),
                arrowprops=dict(arrowstyle="->", color=C_CTRL, linewidth=1.4, shrinkA=0, shrinkB=0),
                zorder=6,
            )
            ax.scatter(gx, gy, s=60, marker="X", c=C_CTRL, edgecolors=SURFACE, linewidths=1, zorder=7)
    style(
        ax,
        "④ 캐노니컬 프레임에서 겹쳐보기",
        "캐노니컬 X (m)",
        "캐노니컬 Y (m)",
        "두 계열이 겹치면 미터↔픽셀 변환이 무손실이라는 뜻이다.\n"
        "화살표 = 기준점 실측값 → 어파인 결과 (정합 잔차)",
    )
    ax.legend(
        frameon=False, fontsize=8, labelcolor=INK_2, loc="upper right", handletextpad=0.4
    )
    ax.set_aspect("equal", adjustable="datalim")

    fig.tight_layout(rect=(0, 0, 1, 0.965))
    fig.savefig(out_png, dpi=150, facecolor=SURFACE)
    plt.close(fig)


def residuals(align, floors, out_png):
    """기준점 잔차. 발표된 rms/max 와 맞는지 여기서 확인한다."""
    fig, axes = plt.subplots(1, len(floors), figsize=(5.6 * len(floors), 5.0), facecolor=SURFACE)
    if len(floors) == 1:
        axes = [axes]
    summary = {}
    for ax, fl in zip(axes, floors):
        spec = align["floors"][fl]
        m, off = spec["affine_m"], spec["affine_offset"]
        names, errs = [], []
        for cp in spec["control_points"]:
            fx, fy = colmap_to_canonical(*cp["colmap"], m, off)
            gx, gy = cp["canonical"][0], cp["canonical"][1]
            names.append(cp["name"])
            errs.append(math.hypot(fx - gx, fy - gy))
        rms = math.sqrt(sum(e * e for e in errs) / len(errs))
        summary[fl] = dict(rms=rms, mx=max(errs), n=len(errs))
        ax.bar(
            names,
            errs,
            color=C_CTRL,
            width=0.62,
            zorder=3,
            edgecolor=SURFACE,
            linewidth=2,
        )
        for i, e in enumerate(errs):
            ax.text(i, e, f"{e:.2f}", ha="center", va="bottom", fontsize=8, color=INK_2)
        pub = spec["verification"]
        ax.axhline(pub["rms_xy_m"], color=MUTED, linewidth=1, linestyle="--", zorder=4)
        ax.text(
            len(names) - 0.4,
            pub["rms_xy_m"],
            f" 발표 RMS {pub['rms_xy_m']}m",
            fontsize=8,
            color=INK_2,
            va="bottom",
            ha="right",
        )
        style(
            ax,
            f"{fl} 기준점 정합 잔차 — 재계산 RMS {rms:.3f}m / 최대 {max(errs):.3f}m",
            "기준점",
            "수평 잔차 (m)",
            f"기준점 {len(errs)}개 · leave-one-out 평균 {pub['leave_one_out_mean_m']}m\n"
            f"(백엔드가 정확도 원으로 쓰는 값)",
        )
    fig.tight_layout()
    fig.savefig(out_png, dpi=150, facecolor=SURFACE)
    plt.close(fig)
    return summary


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--centers", required=True)
    p.add_argument("--align", required=True)
    p.add_argument("--outdir", default=".")
    p.add_argument("--floors", default="B2,B3")
    a = p.parse_args()

    outdir = Path(a.outdir)
    outdir.mkdir(parents=True, exist_ok=True)
    align = json.loads(Path(a.align).read_text(encoding="utf-8"))
    floors = [f for f in a.floors.split(",") if f in align["floors"]]

    rows = build(load_centers(a.centers), align, floors)

    csv_path = outdir / "coords_aligned.csv"
    cols = [
        "floor",
        "name",
        "colmap_cx",
        "colmap_cy",
        "colmap_cz",
        "map_x",
        "map_y",
        "map_z",
        "pixel_px",
        "pixel_py",
        "roundtrip_err_m",
    ]
    with open(csv_path, "w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=cols)
        w.writeheader()
        for r in rows:
            w.writerow({k: (f"{r[k]:.6f}" if isinstance(r[k], float) else r[k]) for k in cols})

    panels(rows, align, floors, outdir / "coords_panels.png")
    summary = residuals(align, floors, outdir / "coords_residuals.png")

    print(f"rows={len(rows)} -> {csv_path}")
    worst = max(r["roundtrip_err_m"] for r in rows)
    print(f"미터<->픽셀 왕복 최대 오차: {worst:.3e} m")
    for fl in floors:
        rs = [r for r in rows if r["floor"] == fl]
        f = FRAME[fl]
        inside = sum(0 <= r["pixel_px"] <= f["w"] and 0 <= r["pixel_py"] <= f["h"] for r in rs)
        s = summary[fl]
        print(
            f"[{fl}] n={len(rs)}  기준점 {s['n']}개 재계산 RMS={s['rms']:.3f}m "
            f"max={s['mx']:.3f}m  |  이미지 안 {inside}/{len(rs)} "
            f"({100 * inside / len(rs):.1f}%)"
        )
        xs = [r["map_x"] for r in rs]
        ys = [r["map_y"] for r in rs]
        print(
            f"      캐노니컬 범위  X {min(xs):8.2f} ~ {max(xs):8.2f} m"
            f"   Y {min(ys):8.2f} ~ {max(ys):8.2f} m"
        )


if __name__ == "__main__":
    main()
