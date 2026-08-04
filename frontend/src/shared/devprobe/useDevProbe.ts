import { useEffect } from 'react';
import { publishDevProbeFields, type DevProbeValue } from './devProbeStore';

function describe(value: DevProbeValue): string {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'boolean') return value ? '예' : '아니오';
  return String(value);
}

/**
 * 화면이 알고 있는 값을 검사 패널로 흘려보낸다.
 *
 * 화면에서 지울 때는 이 호출 한 줄만 지운다. 값은 화면의 것을 읽기만 하므로, 지워도 화면의
 * 동작이 달라지지 않는다.
 */
export function useDevProbe(fields: Record<string, DevProbeValue>) {
  /**
   * 값을 문자열로 굳혀 의존성으로 쓴다.
   *
   * 객체를 그대로 의존성에 두면 렌더마다 새 참조라 effect 가 매번 돌고, ref 에 담아 우회하면
   * 렌더 중 쓰기가 된다. 어차피 화면에 적는 것은 문자열이라 여기서 굳혀도 잃는 것이 없다.
   */
  const encoded = JSON.stringify(
    Object.entries(fields).map(([key, value]) => [key, describe(value)]),
  );

  useEffect(() => {
    publishDevProbeFields(JSON.parse(encoded) as [string, string][]);
  }, [encoded]);
}
