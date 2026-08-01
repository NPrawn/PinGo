import type { CameraStatus } from '../model/cameraStream';
import styles from './CameraFallbackNotice.module.css';

/**
 * 카메라를 쓸 수 없는 이유.
 *
 * **`unsupported`를 따로 안내한다.** 실기기 확인 때 LAN 주소(`http://192.168.x.x:5173`)로
 * 접속하면 보안 컨텍스트가 아니어서 `getUserMedia` 자체가 막힌다. 그 경우와 사용자가 권한을
 * 거부한 경우는 대응이 완전히 다르다 — 앞은 접속 방법을 바꿔야 하고 뒤는 권한을 다시 허용해야
 * 한다. 구분해 주지 않으면 원인을 찾는 데 시간이 걸린다(실제로 그랬다).
 */
const REASON: Partial<Record<CameraStatus, string>> = {
  denied: '카메라 권한이 거부되어 미리보기를 표시할 수 없어요.',
  unsupported: '이 주소에서는 카메라를 쓸 수 없어요. HTTPS 또는 localhost로 접속해 주세요.',
  error: '카메라를 열지 못했어요.',
};

type CameraFallbackNoticeProps = {
  status: CameraStatus;
  className?: string;
};

/**
 * 카메라를 못 켠 이유를 한 줄로 알린다.
 *
 * 여는 중(`starting`)과 정상(`live`)에는 아무것도 그리지 않는다. 여는 중에 문구를 띄우면
 * 대부분 수백 ms 뒤에 사라져 깜빡이는 것으로만 보인다.
 */
export function CameraFallbackNotice({ status, className }: CameraFallbackNoticeProps) {
  const reason = REASON[status];
  if (!reason) return null;

  /**
   * **live region 역할을 주지 않는다.** 이 문구는 마운트 시점에 정해져 사라지지 않는 설명이다.
   * `role="status"`로 두면 화면 낭독기가 갱신으로 읽고, 이 저장소에서 `status`는 로딩처럼
   * 일시적인 알림에 쓰는 자리라 뜻이 어긋난다. 문서 순서대로 읽히면 충분하다.
   */
  return <p className={[styles.notice, className].filter(Boolean).join(' ')}>{reason}</p>;
}
