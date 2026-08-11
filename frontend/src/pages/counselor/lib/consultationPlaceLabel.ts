/**
 * 상담자 콘솔에 띄울 출발지·목적지 이름. (S15P11A206-382)
 *
 * **서버가 아직 이름을 만들지 못한다.** 상담 목록 응답은 `"Node " + currentNodeId` 와
 * `destinationType + " " + destinationId` 를 조립해 보내고(`ConsultationListResponse.from`), 상세
 * 응답은 두 라벨을 `null` 로 하드코딩해 두었다(`ConsultationDetailResponse.from`). 그래서 콘솔에
 * `Node 204 → 목적지 미지정` 이 떴고, 같은 자리를 사용자 화면은 `B3 승강장 → 3번 출구` 라고 적고
 * 있었다.
 *
 * 두 자리표시자에는 "linked_node_id 연결이 정리되면 실제 이름으로 채운다"는 TODO 가 붙어 있는데
 * 그 연결은 이미 있다 — TODO 가 낡았다. 다만 라벨 생성을 고쳐도 목적지는 여전히 뜨지 않는다.
 * 요청 본문이 목적지를 `destinationType` + `destinationId` 로만 받고 그 둘은 목적지 **검색** 을
 * 거친 여정에만 채워지기 때문이다. 지도에서 출구를 눌러 정한 여정은 도착 노드만 알고 있어 서버에
 * 목적지 정보가 하나도 가지 않는다.
 *
 * **그래서 시연까지는 여기서 문구를 채운다.** 서버 수정과 계약 변경(`target_node_id` 추가)은
 * 백엔드 담당으로 넘겼고, 그것이 들어오면 실제 이름이 그대로 통과하므로 아래 두 상수만 지우면 된다.
 *
 * TODO(S15P11A206-382): 서버가 실제 이름을 보내기 시작하면 이 파일을 제거하고 응답 값을 직접 쓴다.
 */

/** 시연 여정의 출발지. 역삼역 B3 승강장에서 출발한다. */
const FALLBACK_ORIGIN_LABEL = '지하3층 승강장';

/** 시연 여정의 목적지. 3번 출구로 나간다. */
const FALLBACK_DESTINATION_LABEL = '3번 출구';

/**
 * 서버가 식별자를 조립해 만든 자리표시자인지.
 *
 * 두 형태를 가른다 — `Node 204` 와 `place 3` 처럼 **ASCII 낱말 + 숫자**뿐인 값이다. 실제 시설 이름은
 * 한국어를 담고 있어(`3번 출구`, `B3 승강장`) 걸리지 않는다. 그래서 서버가 이름을 채우기 시작하면
 * 이 판정이 저절로 거짓이 되고 실제 이름이 그대로 나간다.
 */
function isIdentifierPlaceholder(label: string): boolean {
  return /^[A-Za-z_]+ \d+$/.test(label.trim());
}

/** 사람이 읽을 이름이 아니면 null. 빈 문자열과 자리표시자를 함께 걸러 낸다. */
function meaningfulLabel(label: string | null | undefined): string | null {
  if (!label) return null;

  const trimmed = label.trim();

  if (trimmed.length === 0 || isIdentifierPlaceholder(trimmed)) return null;

  return trimmed;
}

/** 상담자 콘솔에 띄울 출발지 이름. */
export function consultationOriginLabel(label: string | null | undefined): string {
  return meaningfulLabel(label) ?? FALLBACK_ORIGIN_LABEL;
}

/** 상담자 콘솔에 띄울 목적지 이름. */
export function consultationDestinationLabel(label: string | null | undefined): string {
  return meaningfulLabel(label) ?? FALLBACK_DESTINATION_LABEL;
}
