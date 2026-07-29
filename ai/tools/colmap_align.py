#!/usr/bin/env python3
"""277 COLMAP <-> 평면도(캐노니컬 미터) 좌표 앵커링 스캐폴딩 (S15P11A206-277)"""
import os          # 경로 환경변수
import argparse     # 명령행 인자
import numpy as np  # pip install numpy

# COLMAP에서 3D track이 없는 point2D의 point3D_id (uint64 최댓값). pycolmap 구버전 fallback 판정용.
INVALID_POINT3D_ID = 18446744073709551615

# ── 경로 ── 우선순위: --base 인자 > COLMAP_BASE 환경변수 > 실행 위치 기준 상대경로 기본값.
#   절대경로 하드코딩 금지(다른 환경/CI에서 깨짐).
DEFAULT_BASE = os.environ.get("COLMAP_BASE", "pipeline_output/colmap_aliked_lightglue_v3")
BASE = DEFAULT_BASE
_SPARSE_REL = {"B2": "B2/sparse/0", "B3": "B3/sparse/1"}
def sparse_path(floor):
    return f"{BASE}/{_SPARSE_REL[floor]}"
FLOOR_Z = {"B2": 0.0, "B3": -5.0}  # 캐노니컬 프레임 z(nominal). 지물 실제높이 알면 그걸로.

# 커밋된 route_node (V4/V5) 캐노니컬 좌표. sim3 후 커버 안/밖 판정용. (node_id, name, x, y)
NODES = {
    "B2": [(101,"EVA",0.0,0.0),(102,"EVB",-0.4,27.2),(103,"EV4",-55.4,-14.8),
           (104,"EV3",-58.4,42.5),(105,"ESC4",-79.5,-14.2),(106,"ESC3",-80.0,40.4),
           (107,"WC",39.5,25.8),(108,"INFO1",118.4,14.3),(109,"INFO2",96.7,13.0),
           (110,"NURS",89.1,14.7),(111,"B2_N2",-56.7,17.9),(112,"B2_N3",-12.4,15.6),
           (113,"B2_N4",43.217,10.504)],
    "B3": [(201,"EVA",0.0,0.0),(202,"EVB",-0.4,27.2),(203,"NURS",90.0,17.7),
           (204,"B3_N2",-91.8,23.6),(205,"B3_N3",-25.3,25.6)],
}
# 캐노니컬 픽셀↔미터 (V4/V5 동일). 평면도 픽셀에서 미터 읽을 때.
FRAME = {"B2": dict(ox=622,oy=512,angle_deg=-21.28,mpp=0.19),
         "B3": dict(ox=597,oy=497,angle_deg=-21.28,mpp=0.19)}

def pixel_to_meter(px, py, floor):
    f = FRAME[floor]; t = np.deg2rad(f["angle_deg"]); c, s = np.cos(t), np.sin(t)
    dx, dy = px - f["ox"], py - f["oy"]
    return np.array([(dx*c+dy*s)*f["mpp"], (-dx*s+dy*c)*f["mpp"]])

def load(floor):
    import pycolmap
    return pycolmap.Reconstruction(sparse_path(floor))

def _valid_p3d(p2d):
    try: return p2d.has_point3D()
    except AttributeError: return int(p2d.point3D_id) != INVALID_POINT3D_ID

def summary(floor):
    rec = load(floor)
    print(f"\n[{floor}] {sparse_path(floor)}")
    try: print(rec.summary())
    except Exception: print(f"  images={len(rec.images)}  points3D={len(rec.points3D)}")
    print("  등록 이미지(최대 15개):")
    for i, (iid, img) in enumerate(rec.images.items()):
        if i >= 15: print("   ..."); break
        print(f"    id={iid}  {img.name}")

def point_xyz(floor, pid):
    return np.array(load(floor).points3D[int(pid)].xyz)

def pixel_to_point3d(floor, image_name, u, v, radius=10.0):
    """등록 이미지 (u,v) 근처 3D track 있는 최근접 키포인트의 COLMAP xyz. → (xyz, pid, 픽셀거리) or None"""
    rec = load(floor)
    img = next((im for im in rec.images.values() if im.name == image_name), None)
    if img is None: raise ValueError(f"등록 이미지 없음: {image_name} (summary로 확인)")
    best, best_d = None, radius
    for p2d in img.points2D:
        if not _valid_p3d(p2d): continue
        d = float(np.hypot(p2d.xy[0]-u, p2d.xy[1]-v))
        if d < best_d: best_d, best = d, int(p2d.point3D_id)
    if best is None: return None
    return np.array(rec.points3D[best].xyz), best, best_d

def umeyama(src, dst, with_scale=True):
    """dst ≈ scale * R @ src + t"""
    src = np.asarray(src, float); dst = np.asarray(dst, float)
    n, dim = src.shape
    mu_s, mu_d = src.mean(0), dst.mean(0)
    sc, dc = src-mu_s, dst-mu_d
    cov = (dc.T @ sc) / n
    U, D, Vt = np.linalg.svd(cov)
    S = np.eye(dim)
    if np.linalg.det(U)*np.linalg.det(Vt) < 0: S[-1,-1] = -1
    R = U @ S @ Vt
    var_s = (sc**2).sum() / n
    s = (D*np.diag(S)).sum()/var_s if with_scale else 1.0
    t = mu_d - s*R@mu_s
    return s, R, t

def apply_sim3(s, R, t, xyz):
    xyz = np.asarray(xyz, float)
    return (s*(R@xyz.T)).T + t

def estimate_up(rec, trim_pct=95):
    """COLMAP 점군 PCA로 바닥 법선(수직)을 추정. 세장형 실내(길이>>폭>>높이)라 최소분산축≈수직.
    아웃라이어(먼 점) 트림 후 SVD 최소 특이벡터를 반환."""
    pts = np.array([p.xyz for p in rec.points3D.values()], float)
    d = np.linalg.norm(pts - np.median(pts, axis=0), axis=1)
    pts = pts[d < np.percentile(d, trim_pct)]
    _, _, Vt = np.linalg.svd(pts - pts.mean(0), full_matrices=False)
    n = Vt[2]
    return n / np.linalg.norm(n)

def _plane_basis(normal):
    """normal을 z축으로 하는 우수(right-handed) 직교기저 [u, v, n] (행 벡터)."""
    n = np.asarray(normal, float); n = n / np.linalg.norm(n)
    a = np.array([1.0, 0.0, 0.0]) if abs(n[0]) < 0.9 else np.array([0.0, 1.0, 0.0])
    u = a - (a @ n) * n; u = u / np.linalg.norm(u)
    v = np.cross(n, u)  # u × v = n
    return np.array([u, v, n])

def plane_sim3(src, dst, normal):
    """바닥평면 정렬 sim3 (접근법 A, S15P11A206-277 리뷰 반영).
    캐노니컬 제어점이 한 평면(z=const)이라 3D Umeyama는 면외축이 rank-deficient → 회전 불안정.
    COLMAP 수직축(normal)을 캐노니컬 z에 고정하고, 수평면에서 2D similarity로 정합해 회피한다.
    출력은 3D (s, R, t)로 유지 → 런타임(128) 적용식 canonical = s·R·xyz + t 그대로.
    단, collinear 제어점(예: B3)의 축 수직 방향 미결정은 별개 한계로 남는다."""
    src = np.asarray(src, float); dst = np.asarray(dst, float)
    B = _plane_basis(normal)
    local = src @ B.T                                # 열 = [·u, ·v, ·n]
    s2, R2, t2 = umeyama(local[:, :2], dst[:, :2])   # 수평면 2D 정합 (well-posed)
    E = np.eye(3); E[:2, :2] = R2
    R = E @ B                                         # 수평=R2, 수직 n→z 인 3D 회전
    t = np.zeros(3); t[:2] = t2
    t[2] = dst[:, 2].mean() - s2 * local[:, 2].mean()  # 바닥 z를 nominal(FLOOR_Z)에 맞춤
    return s2, R, t

def fit_and_report(name, corr, normal=None):
    src = np.array([c[0] for c in corr], float); dst = np.array([c[1] for c in corr], float)
    s, R, t = plane_sim3(src, dst, normal) if normal is not None else umeyama(src, dst)
    # 캐노니컬 프레임은 2D(z는 nominal 층높이) → 실사용 지표는 수평(x,y) 잔차.
    res = np.linalg.norm((apply_sim3(s,R,t,src)-dst)[:, :2], axis=1)
    print(f"\n=== {name} sim3 (n={len(corr)}) ===")
    print(f"scale = {s:.6f}")
    print("R =\n", np.array2string(R, precision=6))
    print("t =", np.array2string(t, precision=6))
    print(f"residual  RMS = {np.sqrt((res**2).mean()):.4f} m  max = {res.max():.4f} m")
    print("per-point residual(m):", np.round(res,3).tolist())
    return dict(scale=float(s), R=R.tolist(), t=t.tolist(),
                rms=float(np.sqrt((res**2).mean())), max=float(res.max()))

def coverage_report(floor, s, R, t, thresh=2.0):
    """sim3 후 COLMAP 점군 bbox + 커밋 노드 커버 안/밖 판정."""
    rec = load(floor)
    pts = np.array([p.xyz for p in rec.points3D.values()], float)
    canon = apply_sim3(s, R, t, pts)[:, :2]
    print(f"\n[{floor}] COLMAP 커버 bbox(m): "
          f"x[{canon[:,0].min():.1f},{canon[:,0].max():.1f}] "
          f"y[{canon[:,1].min():.1f},{canon[:,1].max():.1f}] (점 {len(pts)}개)")
    for nid, name, x, y in NODES[floor]:
        d = float(np.min(np.hypot(canon[:,0]-x, canon[:,1]-y)))
        print(f"    {nid} {name:6s} ({x:7.1f},{y:6.1f}) 최근접 {d:7.2f}m -> {'커버' if d<=thresh else '커버밖'}")

# ▼▼▼ control point 채우기: (colmap_xyz[X,Y,Z], canonical_xyz[mX,mY,z]) ▼▼▼
#   colmap_xyz: 강민수 제공 or pixel_to_point3d로 추출
#   canonical_xyz: 평면도 미터(x,y)+층 nominal z(FLOOR_Z).
#   ※ 캐노니컬이 한 평면(z=const)이라도 plane_sim3(접근법 A)가 수직축을 캐노니컬 z에
#     고정해 coplanar 퇴화를 회피하므로, 높이 다른 점을 억지로 섞을 필요는 없다.
# 확정 세트 (S15P11A206-277). ((colmap X,Y,Z),(canonical mX,mY,z)). 강민수 추출 COLMAP좌표 + V4 seed canonical.
#  B2: EVB(102)/EV3(104)/B2_N2(111)/B2_N3(112) — ESC3(106)은 불량추출로 제외, 개찰구는 노드아님.
#  B3: B3_N2(204)/B3_N3(205)/EVB(202) — 노드가 3개뿐. EVB 수직쌍(z=0)은 scale불일치로 제외.
CONTROL_POINTS = {
    "B2": [
        ((1.1187734761, -1.1377925957, 6.6222666070), (-0.4, 27.2, 0.0)),    # 102 EVB
        ((3.5644412788, -0.4475291070, -3.3370019985), (-58.4, 42.5, 0.0)),  # 104 EV3
        ((-1.1795818080, 0.9363197810, -2.9962785234), (-56.7, 17.9, 0.0)),  # 111 B2_N2
        ((-1.0367248671, -0.4925373892, 4.5957285178), (-12.4, 15.6, 0.0)),  # 112 B2_N3
    ],
    "B3": [
        ((6.4, 1.0, -8.0), (-91.8, 23.6, -5.0)),                              # 204 B3_N2 (서쪽끝)
        ((-0.1872048344, 0.8283563945, 0.9953325044), (-25.3, 25.6, -5.0)),  # 205 B3_N3 (계단시작)
        ((-3.6084512190, 0.9069546550, 5.7589226150), (-0.4, 27.2, -5.0)),   # 202 EVB
    ],
}

if __name__ == "__main__":
    ap = argparse.ArgumentParser(description="277 COLMAP<->평면도(캐노니컬 미터) 좌표 앵커링")
    ap.add_argument("command", nargs="?", default="help",
                    choices=["summary", "fit", "coverage", "help"])
    ap.add_argument("--base", default=DEFAULT_BASE,
                    help="pipeline_output/colmap_aliked_lightglue_v3 경로 "
                         "(기본: $COLMAP_BASE 또는 실행 위치 기준 상대경로)")
    args = ap.parse_args()
    BASE = args.base  # 모듈 전역 재지정 → sparse_path()가 참조
    cmd = args.command
    if cmd == "summary":
        for fl in ("B2","B3"): summary(fl)
    elif cmd in ("fit","coverage"):
        for fl in ("B2","B3"):
            cps = CONTROL_POINTS[fl]
            if len(cps) < 3: print(f"[{fl}] control point {len(cps)}개 — 최소 3개(권장 6~10) 필요"); continue
            normal = estimate_up(load(fl))  # 바닥평면 정렬(접근법 A)
            res = fit_and_report(fl, cps, normal)
            if cmd == "coverage": coverage_report(fl, res["scale"], np.array(res["R"]), np.array(res["t"]))
    else:
        print("commands: summary | fit | coverage")
