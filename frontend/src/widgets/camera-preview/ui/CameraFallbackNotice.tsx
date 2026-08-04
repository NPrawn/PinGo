import { useTranslation } from 'react-i18next';
import type { CameraStatus } from '../model/cameraStream';
import styles from './CameraFallbackNotice.module.css';

/**
 * 카메라를 쓸 수 없을 때 사용자에게 보여줄 문구.
 *
 * **사용자가 할 수 있는 일만 적는다.** 원인을 그대로 옮기면 안 된다 — 보안 컨텍스트나 프로토콜은
 * 지하철에서 앱을 쓰는 사람이 손댈 수 있는 것이 아니다. 권한 거부만 사용자가 되돌릴 수 있으므로
 * 그 경우에만 행동을 안내하고, 나머지는 카메라를 쓸 수 없다는 사실만 알린다. 진단에 필요한
 * 구분은 개발 빌드의 콘솔 경고(`cameraStream`)가 맡는다.
 */
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
  const { t } = useTranslation();
  const reason = ['denied', 'unsupported', 'error'].includes(status)
    ? t(`user.camera.${status}`)
    : undefined;
  if (!reason) return null;

  /**
   * **live region 역할을 주지 않는다.** 이 문구는 마운트 시점에 정해져 사라지지 않는 설명이다.
   * `role="status"`로 두면 화면 낭독기가 갱신으로 읽고, 이 저장소에서 `status`는 로딩처럼
   * 일시적인 알림에 쓰는 자리라 뜻이 어긋난다. 문서 순서대로 읽히면 충분하다.
   */
  return <p className={[styles.notice, className].filter(Boolean).join(' ')}>{reason}</p>;
}
