/** 서버가 안내 문장에서 거리 자리를 비워 둔 표시. `RouteStep.instructionTemplate` 참고. */
const DISTANCE_PLACEHOLDER = '{distance}';

/** 문장을 채우는 데 필요한 만큼만 받는다. 응답 타입 전체에 묶이지 않게 좁게 둔다. */
export interface StepInstruction {
  instruction?: string;
  instructionTemplate?: string;
  moveType?: string;
}

/**
 * 안내 문장에 거리를 채운다.
 *
 * **왜 서버 문장을 그대로 쓰지 않는가.** `instruction`에는 구간 전체 길이가 박혀 있다. 한 안내가
 * 여러 간선을 담게 되면서(S15P11A206-339) 역삼역 B3 승강장은 한 구간이 197m 인데, 절반을 걸어도
 * 문장은 계속 `197m 직진하세요`다. 걷고 있는데 숫자가 그대로면 아무 일도 일어나지 않는 것처럼
 * 보인다.
 *
 * 그래서 서버가 거리 자리를 비운 같은 문장(`instructionTemplate`)을 함께 주고 여기서 채운다.
 * **숫자를 앞에 붙이는 방법은 쓸 수 없다** — 한국어는 `197m 직진하세요`로 앞이고 영어는
 * `Go straight for 197m.`으로 중간이다. 문장을 클라이언트가 조립하는 방법도 조사 처리
 * (`계단을/를`, `계단으로/에스컬레이터로`)를 여기 다시 만들게 한다.
 *
 * 템플릿이 없으면 `instruction`을 그대로 쓴다. 배포 시점이 어긋나 서버가 아직 템플릿을 주지 않을
 * 때 거리가 갱신되지 않을 뿐 문장은 온전하다.
 */
export function instructionAt(step: StepInstruction, distanceM: number): string {
  const template = step.instructionTemplate ?? step.instruction;
  if (!template) return step.moveType ?? '이동';
  return template.replace(DISTANCE_PLACEHOLDER, `${Math.round(distanceM)}m`);
}

/**
 * 문장이 거리를 품고 있는지.
 *
 * 층 이동과 개찰구 문장에는 거리가 들어가지 않는다(`계단으로 한 층 올라가세요`). 그런 구간은
 * 거리를 따로 적어야 하고, 품는 구간은 문장 안에 이미 있으므로 또 적으면 같은 줄에 숫자가 두 개
 * 놓인다.
 */
export function carriesDistance(step: StepInstruction): boolean {
  return step.instructionTemplate?.includes(DISTANCE_PLACEHOLDER) ?? false;
}
