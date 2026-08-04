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
  lines: string[];
};

export const useDevProbeStore = create<DevProbeState>(() => ({ fields: [], lines: [] }));

export function publishDevProbeFields(fields: [string, string][]) {
  useDevProbeStore.setState({ fields });
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
