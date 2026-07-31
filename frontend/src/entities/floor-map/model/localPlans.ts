/**
 * FE가 자체적으로 들고 있는 평면도 이미지.
 *
 * 층별 지도 응답의 `mapUrl`은 null일 수 있다. 좌표 프레임만 등록되고 이미지는 아직 백엔드에
 * 없는 상태이며(V9 seed), API 명세 5.1이 "클라이언트가 자체 이미지를 쓰고 프레임만 가져다
 * 쓴다"고 정한 경로다. 그 자체 이미지가 여기 있다.
 *
 * **기준 크기를 지켜야 프레임이 성립한다.** 응답의 `width`×`height`를 확대·축소한 것이어야
 * 하며, 잘라내거나 배치를 바꾸면 프레임을 다시 측정해야 한다. 아래 파일들은 V9 seed의 기준
 * 크기와 정확히 같다(B1 1626×967, B2 1624×969, B3 1659×948).
 *
 * TODO: 관리자 업로드(FR-A-002)로 도면이 등록되면 응답의 `mapUrl`이 채워지므로 이 모듈은
 * 지워도 된다. 다른 역이 추가되면 그 역의 도면은 여기 없으므로 업로드가 선행되어야 한다.
 */
const LOCAL_PLAN_FILES: Readonly<Record<string, string>> = {
  B1: 'yeoksam_B1.png',
  B2: 'yeoksam_B2.png',
  B3: 'yeoksam_B3.png',
};

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
  const fileName = LOCAL_PLAN_FILES[floorCode];
  if (!fileName) return null;
  if (typeof window === 'undefined') return null;

  return `${window.location.origin}/maps/${fileName}`;
}

/**
 * 화면에 표시할 지도 이미지 URL을 정한다.
 *
 * 백엔드에 등록된 이미지가 있으면 그것을 쓴다. 관리자가 올린 도면이 FE 번들보다 최신이기
 * 때문이다. 없으면 자체 이미지로 떨어지고, 그것도 없으면 null이다.
 */
export function floorPlanImageUrl(map: {
  mapUrl: string | null;
  floorCode: string;
}): string | null {
  return map.mapUrl ?? localPlanUrl(map.floorCode);
}
