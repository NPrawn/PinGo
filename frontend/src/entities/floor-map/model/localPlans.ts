import type { CoordinateFrame } from './types';

/**
 * FE가 자체적으로 들고 있는 평면도와 **그 도면에 대응하는 좌표 프레임**.
 *
 * 층별 지도 응답의 `mapUrl`은 null일 수 있다. 좌표 프레임만 등록되고 이미지는 아직 백엔드에
 * 없는 상태이며(V9 seed), API 명세 5.1이 "클라이언트가 자체 이미지를 쓰고 프레임만 가져다
 * 쓴다"고 정한 경로다. 그 자체 이미지가 여기 있다.
 *
 * **프레임을 도면 옆에 두는 이유가 있다.** 프레임은 특정 이미지에 대해서만 의미가 있는 값이다.
 * 도면을 FE가 들고 있는 이상 그 도면의 프레임도 FE가 들고 있어야 둘이 어긋나지 않는다.
 * 백엔드가 올린 도면(`mapUrl`이 있는 경우)에는 백엔드 프레임을 쓴다 — `displayFrameOf` 참고.
 *
 * **기준 크기를 지켜야 프레임이 성립한다.** 응답의 `width`×`height`를 확대·축소한 것이어야
 * 하며, 잘라내거나 배치를 바꾸면 프레임을 다시 측정해야 한다. 아래 파일들은 V9 seed의 기준
 * 크기와 정확히 같다(B1 1626×967, B2 1624×969, B3 1659×948).
 *
 * **파일은 캡쳐 원본이 아니라 전처리본이다.** 원본은 지도 앱 화면을 캡쳐한 것이라 배경
 * 그라데이션·드롭섀도와 지상 필지(연두색)가 함께 담겨 있었고, 보행 공간(밝기 248)과 배경
 * (밝기 240)의 차이가 8밖에 안 돼 통로가 눈에 들어오지 않았다. 그래서 가장자리에서 채워
 * 들어가 역사 바깥을 판별한 뒤 다음과 같이 다시 칠했다.
 *
 * - 역사 바깥·지상 필지 → 투명 (뷰포트 배경이 비친다)
 * - 보행 공간 → 흰색
 * - 방·구조물 → 연회색, 벽·해칭 → 중간 회색
 *
 * 픽셀 크기는 건드리지 않았으므로 프레임은 그대로 성립한다. 부수 효과로 파일이 1.0~1.5MB에서
 * 약 50KB로 줄었다(합계 3.9MB → 154KB). 캡쳐 원본은 커밋 e69f9e9에 남아 있다.
 *
 * TODO: 관리자 업로드(FR-A-002)로 도면이 등록되면 응답의 `mapUrl`이 채워지므로 이 모듈은
 * 지워도 된다. 다른 역이 추가되면 그 역의 도면은 여기 없으므로 업로드가 선행되어야 한다.
 */
interface LocalPlan {
  file: string;
  /** 이 파일의 원본 픽셀 크기. 기준 층을 고를 때 캔버스 크기로 쓴다. */
  width: number;
  height: number;
  frame: CoordinateFrame;
}

/**
 * 세 도면은 **서로 다른 배율로 캡쳐됐다.** 그런데 백엔드에는 세 층 모두 `scaleMPerPx: 0.19`로
 * 등록돼 있어, 같은 미터 좌표가 층마다 다른 자리에 찍힌다. 층을 바꿀 때 역사가 어긋나 보이는
 * 원인이다(S15P11A206-314, `fixtures.ts`의 B1 미검증 주석).
 *
 * 도면끼리 직접 정합해 상대 오차를 측정했다. 세 쌍을 독립적으로 맞춘 결과가 사슬로 일치한다.
 *
 * ```
 * B1 → B2   정합률 31.7% → 68.4%   배율 1.025   회전 0.00°   이동 (8, 2)px
 * B2 → B3   정합률 46.7% → 75.0%   배율 0.990   회전 0.50°   이동 (0, -1)px
 * B1 → B3   정합률 42.0% → 65.4%   배율 1.010   회전 0.50°   이동 (9, 1)px
 *           1.025 × 0.990 = 1.015 ≒ 1.010,  0° + 0.5° = 0.5°
 * ```
 *
 * 아래 값은 **B2를 기준으로** 나머지 두 층을 B2에 맞춘 것이다. 백엔드 시설 좌표는 정확하다
 * (층을 잇는 엘리베이터 두 대가 위아래 층에서 0.001m까지 일치한다). 따라서 고쳐야 할 것은
 * 도면과 프레임뿐이고, 둘 다 FE가 들고 있다.
 *
 * **절대 배율은 미확정이다.** 셋 중 어느 층이 실제 축척과 맞는지는 실측 거리가 없어 정하지
 * 못했다. 다만 세 층에 같은 오차가 실리므로 층 전환 시에는 어긋나지 않고, 사용자에게 보이는
 * 거리는 도면이 아니라 백엔드 미터 좌표에서 나오므로 영향이 없다. 확정하려면 B2 도면에서
 * `B2-B3 엘리베이터 A·B`(미터 (0,0)과 (-0.4, 27.2))의 픽셀 위치 두 점이면 충분하다.
 */
const LOCAL_PLANS: Readonly<Record<string, LocalPlan>> = {
  B1: {
    file: 'yeoksam_B1.png',
    width: 1626,
    height: 967,
    // mpp = 0.19 × 1.025,  originPx = (594, 501) − (8, 2)/1.025
    frame: { originPx: [586.2, 499.0], angleDeg: -21.28, mpp: 0.19475 },
  },
  B2: {
    file: 'yeoksam_B2.png',
    width: 1624,
    height: 969,
    // 기준 층. 백엔드 등록값 그대로다.
    frame: { originPx: [622, 512], angleDeg: -21.28, mpp: 0.19 },
  },
  B3: {
    file: 'yeoksam_B3.png',
    width: 1659,
    height: 948,
    // mpp = 0.19 / 0.990,  angleDeg = -21.28 + 0.5,  originPx = (597, 497) + (0, -1)
    frame: { originPx: [597, 496], angleDeg: -20.78, mpp: 0.19192 },
  },
};

/**
 * 모든 층을 얹는 **공통 기준 캔버스**.
 *
 * 프레임만 맞춰서는 층 전환 정합이 잡히지 않는다. 도면 세 장은 캔버스 크기가 제각각인데
 * (1626×967 · 1624×969 · 1659×948) 이것을 같은 상자에 각각 맞추면, 이미지→화면 배율이
 * 층마다 2.2% 다르고 위아래 여백도 4px 달라진다. 프레임을 아무리 정확히 맞춰도 이 단계에서
 * 다시 어긋난다 — 실측으로 150m 지점에서 층 간 13px이 벌어졌다.
 *
 * 그래서 표시 좌표계를 한 층(B2)의 픽셀 공간으로 고정하고, 나머지 층 도면은 프레임 차이만큼
 * 변환해 그 위에 얹는다(`planPlacementOf`). 그러면 미터→화면 경로가 세 층에서 완전히 같아진다.
 *
 * B2를 고른 이유는 배율 보정의 기준 층이기 때문이다. 기준을 바꾸려면 여기만 바꾸면 되고,
 * 다른 층들의 프레임 값은 이 기준에 상대적으로 정의돼 있으므로 함께 다시 계산해야 한다.
 */
const REFERENCE_FLOOR_CODE = 'B2';

/** 표시 좌표계의 원점·축척. 미터 변환이 이 프레임 하나만 쓴다. */
export const PLAN_REFERENCE: {
  readonly width: number;
  readonly height: number;
  readonly frame: CoordinateFrame;
} = {
  width: LOCAL_PLANS[REFERENCE_FLOOR_CODE].width,
  height: LOCAL_PLANS[REFERENCE_FLOOR_CODE].height,
  frame: LOCAL_PLANS[REFERENCE_FLOOR_CODE].frame,
};

/**
 * 실제로 그리는 캔버스. 기준 프레임과 원점은 같고 **크기만 넓다.**
 *
 * 기준 층(B2)의 크기를 그대로 쓰면 다른 층이 잘린다. 배율 보정을 거치면 B1은 오른쪽으로
 * 64px·아래로 23px, B3는 오른쪽으로 75px 넘치기 때문이다. 세 층을 모두 담도록 넓혔다.
 *
 * 좌상단은 (0, 0) 그대로다 — 세 층 중 어느 것도 왼쪽·위로는 넘치지 않아 좌표를 옮길 필요가
 * 없다. 덕분에 기준 프레임의 originPx를 그대로 쓸 수 있다.
 *
 * 값이 맞는지는 `planPlacement.test.ts`가 층별 배치 범위를 계산해 검사한다. 프레임을 고치면
 * 그 테스트가 먼저 깨진다.
 */
export const PLAN_CANVAS: { readonly width: number; readonly height: number } = {
  width: 1699,
  height: 992,
};

/** 등록된 자체 도면 전체. 캔버스가 세 층을 다 담는지 검사하는 데 쓴다. */
export function localPlanList(): readonly {
  floorCode: string;
  width: number;
  height: number;
  frame: CoordinateFrame;
}[] {
  return Object.entries(LOCAL_PLANS).map(([floorCode, plan]) => ({
    floorCode,
    width: plan.width,
    height: plan.height,
    frame: plan.frame,
  }));
}

/**
 * 층 코드에 해당하는 자체 평면도 URL. 없으면 null.
 *
 * `public/`이 서빙하는 파일이라 백엔드가 아니라 **현재 오리진**에 있다. `resolveAssetUrl`이
 * 상대 경로에 `VITE_API_BASE_URL`을 붙이므로, 그대로 통과하도록 절대 URL로 만든다.
 *
 * 브라우저 밖(SSR·노드 테스트)에서는 오리진을 알 수 없어 null을 준다. 이미지를 그릴 수 없는
 * 환경이므로 문제가 되지 않는다.
 */
export function localPlanUrl(floorCode: string): string | null {
  const plan = LOCAL_PLANS[floorCode];
  if (!plan) return null;
  if (typeof window === 'undefined') return null;

  return `${window.location.origin}/maps/${plan.file}`;
}

/**
 * 자체 평면도에 대응하는 좌표 프레임. 등록된 도면이 없는 층이면 null.
 *
 * `localPlanUrl`과 **같은 표를 본다.** 도면과 프레임이 따로 놀면 마커가 도면에서 밀리므로
 * 한쪽만 바뀌는 일이 없어야 한다.
 */
export function localPlanFrame(floorCode: string): CoordinateFrame | null {
  return LOCAL_PLANS[floorCode]?.frame ?? null;
}

/** 자체 평면도를 들고 있는 층인지. 프레임을 어느 쪽에서 읽을지 판단하는 데 쓴다. */
export function hasLocalPlan(floorCode: string): boolean {
  return floorCode in LOCAL_PLANS;
}

/**
 * 화면에 표시할 지도 이미지 URL을 정한다.
 *
 * 백엔드에 등록된 이미지가 있으면 그것을 쓴다. 관리자가 올린 도면이 FE 번들보다 최신이기
 * 때문이다. 없으면 자체 이미지로 떨어지고, 그것도 없으면 null이다.
 */
export function floorPlanImageUrl(map: { mapUrl: string | null; floorCode: string }): string | null {
  return map.mapUrl ?? localPlanUrl(map.floorCode);
}
