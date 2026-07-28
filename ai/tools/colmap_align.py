#!/usr/bin/env python3
"""277 COLMAP <-> 평면도(캐노니컬 미터) 좌표 앵커링 스캐폴딩 (S15P11A206-277)"""
import numpy as np  # pip install numpy

# ── 경로 (★ 이 컴퓨터의 pipeline_output 경로) ──
BASE = "C:/Users/SSAFY/Desktop/pipeline_output/colmap_aliked_lightglue_v3"
SPARSE = {"B2": f"{BASE}/B2/sparse/0", "B3": f"{BASE}/B3/sparse/1"}
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
    return pycolmap.Reconstruction(SPARSE[floor])

def _valid_p3d(p2d):
    try: return p2d.has_point3D()
    except AttributeError: return int(p2d.point3D_id) != 18446744073709551615

def summary(floor):
    rec = load(floor)
    print(f"\n[{floor}] {SPARSE[floor]}")
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

def fit_and_report(name, corr):
    src = np.array([c[0] for c in corr], float); dst = np.array([c[1] for c in corr], float)
    s, R, t = umeyama(src, dst)
    res = np.linalg.norm(apply_sim3(s,R,t,src)-dst, axis=1)
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
#   canonical_xyz: 평면도 미터(x,y)+지물 높이 z (모르면 FLOOR_Z). coplanar 회피(높이 다른 점 섞기).
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
    import sys
    cmd = sys.argv[1] if len(sys.argv) > 1 else "help"
    if cmd == "summary":
        for fl in ("B2","B3"): summary(fl)
    elif cmd in ("fit","coverage"):
        for fl in ("B2","B3"):
            cps = CONTROL_POINTS[fl]
            if len(cps) < 3: print(f"[{fl}] control point {len(cps)}개 — 최소 3개(권장 6~10) 필요"); continue
            res = fit_and_report(fl, cps)
            if cmd == "coverage": coverage_report(fl, res["scale"], np.array(res["R"]), np.array(res["t"]))
    else:
        print("commands: summary | fit | coverage")
