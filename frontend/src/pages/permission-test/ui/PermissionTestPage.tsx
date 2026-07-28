import { useEffect, useRef, useState } from 'react';
import {
  requestCameraPermission,
  requestLocationPermission,
  requestMicrophonePermission,
  stopMediaStream,
  type PermissionRequestResult,
  type PermissionStatus,
  type SingleMediaPermissionResult,
} from '@/features/permissions';
import styles from './PermissionTestPage.module.css';

interface LogEntry {
  id: number;
  time: string;
  message: string;
}

/**
 * 권한 상태에 따라 배지 색상 class를 고른다.
 */
function badgeClass(status: PermissionStatus | undefined): string {
  if (status === 'granted') return styles.badgeGranted;
  if (status === 'denied') return styles.badgeDenied;
  return styles.badgeNeutral;
}

/**
 * 아직 요청하지 않은 경우 '미요청'으로 표시한다.
 */
function statusLabel(status: PermissionStatus | undefined): string {
  return status ?? '미요청';
}

function formatResult(label: string, status: PermissionStatus, errorName?: string): string {
  return `${label} → ${status}${errorName ? ` (${errorName})` : ''}`;
}

/**
 * 권한 요청 테스트 페이지 (FR-U-002 실기기 검증용).
 *
 * 위치, 카메라, 마이크 권한을 각각 요청해 실제 브라우저 동작과 결과를 확인한다.
 * 카메라는 미리보기를 제공하고, 미디어 스트림은 수동으로 종료할 수 있다.
 * Android Chrome, iOS Safari 실기기에서 허용·거부·오류 결과를 눈으로 검증하기 위한 화면이다.
 */
export function PermissionTestPage() {
  const [location, setLocation] = useState<PermissionRequestResult | null>(null);
  const [camera, setCamera] = useState<SingleMediaPermissionResult | null>(null);
  const [microphone, setMicrophone] = useState<SingleMediaPermissionResult | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [log, setLog] = useState<LogEntry[]>([]);

  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const logIdRef = useRef(0);

  // 카메라 스트림을 video 요소에 연결한다.
  useEffect(() => {
    const video = videoRef.current;
    if (video) {
      video.srcObject = cameraStream;
    }
  }, [cameraStream]);

  // 화면을 벗어날 때 카메라 표시등이 남지 않도록 스트림을 정리한다.
  useEffect(() => {
    return () => {
      stopMediaStream(cameraStreamRef.current ?? undefined);
    };
  }, []);

  function addLog(message: string) {
    logIdRef.current += 1;
    const entry: LogEntry = {
      id: logIdRef.current,
      time: new Date().toLocaleTimeString(),
      message,
    };
    setLog((prev) => [entry, ...prev]);
  }

  // 새 카메라 스트림으로 교체하면서 이전 스트림은 정리한다.
  function replaceCameraStream(stream: MediaStream | null) {
    stopMediaStream(cameraStreamRef.current ?? undefined);
    cameraStreamRef.current = stream;
    setCameraStream(stream);
  }

  async function handleLocation() {
    const result = await requestLocationPermission();
    setLocation(result);
    addLog(formatResult('위치', result.status, result.error?.name));
  }

  async function handleCamera() {
    const result = await requestCameraPermission();
    setCamera(result);
    replaceCameraStream(result.status === 'granted' ? (result.stream ?? null) : null);
    addLog(formatResult('카메라', result.status, result.error?.name));
  }

  async function handleMicrophone() {
    const result = await requestMicrophonePermission();
    setMicrophone(result);
    // 마이크는 미리보기가 없으므로 권한 확인 후 스트림을 즉시 정리한다.
    stopMediaStream(result.stream);
    addLog(formatResult('마이크', result.status, result.error?.name));
  }

  function handleStopStream() {
    replaceCameraStream(null);
    addLog('카메라 스트림 수동 종료');
  }

  return (
    <main className={styles.page}>
      <header>
        <h1 className={styles.title}>권한 요청 테스트</h1>
        <p className={styles.hint}>
          각 버튼으로 위치, 카메라, 마이크 권한을 개별 요청해 동작과 결과를 확인한다.
          카메라·마이크·위치는 HTTPS 또는 localhost 보안 컨텍스트가 필요하다.
        </p>
      </header>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>권한 요청</h2>
        <div className={styles.actions}>
          <button type="button" className={styles.button} onClick={() => void handleLocation()}>
            위치 요청
          </button>
          <button type="button" className={styles.button} onClick={() => void handleCamera()}>
            카메라 요청
          </button>
          <button type="button" className={styles.button} onClick={() => void handleMicrophone()}>
            마이크 요청
          </button>
          <button
            type="button"
            className={styles.buttonSecondary}
            onClick={handleStopStream}
            disabled={cameraStream === null}
          >
            카메라 스트림 종료
          </button>
        </div>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>현재 상태</h2>
        <ul className={styles.statusList}>
          <li className={styles.statusItem}>
            <span>위치</span>
            <span className={`${styles.badge} ${badgeClass(location?.status)}`}>
              {statusLabel(location?.status)}
            </span>
          </li>
          <li className={styles.statusItem}>
            <span>카메라</span>
            <span className={`${styles.badge} ${badgeClass(camera?.status)}`}>
              {statusLabel(camera?.status)}
            </span>
          </li>
          <li className={styles.statusItem}>
            <span>마이크</span>
            <span className={`${styles.badge} ${badgeClass(microphone?.status)}`}>
              {statusLabel(microphone?.status)}
            </span>
          </li>
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>카메라 미리보기</h2>
        <video ref={videoRef} className={styles.preview} autoPlay muted playsInline />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>결과 기록</h2>
        {log.length === 0 ? (
          <p className={styles.empty}>아직 요청 기록이 없다.</p>
        ) : (
          <ul className={styles.log}>
            {log.map((entry) => (
              <li key={entry.id} className={styles.logItem}>
                [{entry.time}] {entry.message}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
