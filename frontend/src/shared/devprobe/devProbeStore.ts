import { create } from 'zustand';

/**
 * 검사 패널이 읽는 값 저장소. **실 서비스 스토어와 섞지 않는다.**
 *
 * persist 를 걸지 않는다 — 새로고침하면 지난 상담의 로그가 남아 지금 상담을 잘못 읽게 된다.
 */

export type DevProbeValue = string | number | boolean | null | undefined;

/** 담아 두는 최대 줄 수. 오래된 줄부터 버린다. */
const MAX_LINES = 80;

/** 잘린 것을 모르고 읽으면 응답이 그렇게 짧은 줄로 오해한다. */
const MAX_LINE_LENGTH = 400;

type DevProbeState = {
  /** `[이름, 값]` 순서를 그대로 지킨다. 화면에 적히는 순서가 곧 이 순서다. */
  fields: [string, string][];
  /** 몇 번 일어났는지. 흐르고 있는지 멈췄는지는 값이 아니라 횟수로만 보인다. */
  counts: Record<string, number>;
  lines: string[];
};

export const useDevProbeStore = create<DevProbeState>(() => ({
  fields: [],
  counts: {},
  lines: [],
}));

export function publishDevProbeFields(fields: [string, string][]) {
  useDevProbeStore.setState({ fields });
}

/**
 * 무언가가 한 번 일어났음을 센다.
 *
 * 값만 보면 "지금 값이 무엇인지"만 알 수 있고 **그 값이 계속 갱신되는지는 알 수 없다.** 지도
 * 동기화가 한 번 도착한 뒤 멈춘 것인지 계속 오는 것인지가 그 차이였다. 화면이 아니라 스토어에
 * 세므로 이것을 부르는 쪽은 리렌더되지 않는다.
 */
export function countDevProbe(name: string) {
  useDevProbeStore.setState((state) => ({
    counts: { ...state.counts, [name]: (state.counts[name] ?? 0) + 1 },
  }));
}

export function logDevProbe(message: string) {
  const stamp = new Date().toTimeString().slice(0, 8);
  const text = message.length > MAX_LINE_LENGTH ? `${message.slice(0, MAX_LINE_LENGTH)}…` : message;

  useDevProbeStore.setState((state) => ({
    lines: [...state.lines, `${stamp} ${text}`].slice(-MAX_LINES),
  }));
}

export function clearDevProbeLines() {
  useDevProbeStore.setState({ lines: [] });
}
