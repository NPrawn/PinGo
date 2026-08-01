import { useEffect } from 'react';
import type { CameraPreview } from '../model/useCameraPreview';

type CameraFeedProps = {
  camera: CameraPreview;
  /** 화면이 카메라 영역에 맞춰 넣는 클래스. 기존 가짜 장면과 같은 자리를 차지한다. */
  className?: string;
};

/**
 * 후면 카메라 영상.
 *
 * `aria-hidden`이다. 영상 자체는 읽어 줄 내용이 없고, 카메라 영역의 설명은 그것을 감싼 화면이
 * 가지고 있다(`aria-label="후면 카메라 화면"`).
 *
 * `playsInline`이 없으면 iOS Safari가 전체 화면 재생기로 띄워 화면을 덮는다. `muted`가 없으면
 * 자동 재생이 차단된다.
 */
export function CameraFeed({ camera, className }: CameraFeedProps) {
  const { videoRef, stream } = camera;

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    video.srcObject = stream;
    /**
     * **`autoPlay` 속성만으로는 부족하다.** 요소가 마운트될 때는 소스가 없고 `srcObject`를
     * 여기서 넣는데, 그 순서에서 자동 재생이 걸리지 않는 브라우저가 있다. 그러면 첫 프레임에
     * 멈춘 것처럼 보인다.
     *
     * 거부는 삼킨다 — 자동 재생 정책에 막혀도 `muted`라 실제로는 거의 없고, 막혔다면 미리보기가
     * 정지된 것 말고 할 수 있는 일이 없다.
     */
    void video.play().catch(() => {});

    return () => {
      // 스트림을 끊는 것은 소유자(`cameraStream`)가 한다. 여기서는 참조만 놓는다.
      video.srcObject = null;
    };
  }, [stream, videoRef]);

  if (!stream) return null;

  return <video ref={videoRef} className={className} autoPlay muted playsInline aria-hidden />;
}
