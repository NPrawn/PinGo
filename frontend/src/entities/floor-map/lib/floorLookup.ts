import type { FloorMap } from '../model/types';

/**
 * 층 코드와 숫자 `floorId`를 잇는다.
 *
 * 두 체계가 앱 안에 공존한다. 조회·좌표는 숫자 `floorId`를 쓰고(지도·시설·경로 API), 화면의
 * 층 탭과 라벨은 `B1`·`B2` 같은 코드를 쓴다. 그 사이를 잇는 값이 층별 지도 응답의 `floorCode`다.
 *
 * **하드코딩 매핑 테이블을 만들지 않는다.** `floor_id`는 auto-increment라 역이 늘거나 시드를
 * 다시 넣으면 값이 바뀐다. 실제로 목업 상수(`MOCK_FLOOR_ID`)와 배포 값이 이미 다를 수 있다.
 * 언제나 응답에서 찾는다.
 */

/** 층 코드에 해당하는 숫자 floorId. 그 층의 지도가 없으면 undefined. */
export function floorIdOf(maps: readonly FloorMap[], floorCode: string): number | undefined {
  return maps.find((map) => map.floorCode === floorCode)?.floorId;
}

/** 숫자 floorId의 층 코드. 해당 지도가 없으면 undefined. */
export function floorCodeOf(maps: readonly FloorMap[], floorId: number): string | undefined {
  return maps.find((map) => map.floorId === floorId)?.floorCode;
}
