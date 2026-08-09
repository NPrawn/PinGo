import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { RefObject } from 'react';
import { acquireCamera, releaseCamera, useCameraStore, type CameraStatus } from './cameraStream';
import { captureFrame } from '../lib/captureFrame';

export interface CameraPreview {
  /** `CameraFeed`에 넘겨 붙인다. 촬영은 이 요소에서 프레임을 뜬다. */
  videoRef: RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  status: CameraStatus;
  /** 화면에 실제 영상이 보이는 상태. 대체 그림을 그릴지 판단하는 값이다. */
  isLive: boolean;
  /** 현재 프레임을 JPEG으로 뜬다. 영상이 없으면 null이다. */
  capture: () => Promise<Blob | null>;
}

/**
 * 후면 카메라 미리보기를 붙인다.
 *
 * 스트림은 화면이 아니라 모듈이 소유한다(`cameraStream`). 촬영 흐름의 여러 화면이 같은 카메라를
 * 이어 쓰고, XR 진입 시 한 곳에서 끊을 수 있어야 한다.
 */
export function useCameraPreview(): CameraPreview {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const stream = useCameraStore((state) => state.stream);
  const status = useCameraStore((state) => state.status);

  useEffect(() => {
    void acquireCamera();

    return releaseCamera;
  }, []);

  const capture = useCallback(() => captureFrame(videoRef.current), []);

  return useMemo(
    () => ({
      videoRef,
      stream,
      status,
      isLive: status === 'live' && stream !== null,
      capture,
    }),
    [capture, status, stream],
  );
}
