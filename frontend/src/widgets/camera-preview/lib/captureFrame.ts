/**
 * 위치추정에 보낼 이미지 형식. 백엔드는 `image/jpeg`와 `image/png`만 받는다.
 * 사진이라 JPEG이 훨씬 작다.
 */
const MIME = 'image/jpeg';
const QUALITY = 0.9;
export const VPS_FRAME_SIZE = 768;

export function vpsFrameDimensions(width: number, height: number) {
  const scale = Math.min(1, VPS_FRAME_SIZE / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/**
 * 미리보기의 현재 프레임을 이미지로 뜬다.
 *
 * **`videoWidth`를 쓰고 CSS 크기를 쓰지 않는다.** 화면에서는 영역에 맞춰 잘리거나 늘어나 있는데,
 * 위치추정은 카메라가 실제로 본 화면과 그때의 내부 파라미터가 맞아야 한다. CSS 크기로 뜨면
 * 잘린 그림을 원본이라고 보내는 셈이 된다.
 *
 * 아직 첫 프레임이 도착하지 않으면 `videoWidth`가 0이다. 그때는 뜨지 않는다 — 0×0 이미지를
 * 보내면 서버가 `invalid_image`로 돌려준다.
 */
export async function captureFrame(video: HTMLVideoElement | null): Promise<Blob | null> {
  if (!video || video.videoWidth === 0 || video.videoHeight === 0) return null;

  const canvas = document.createElement('canvas');
  const output = vpsFrameDimensions(video.videoWidth, video.videoHeight);
  canvas.width = output.width;
  canvas.height = output.height;

  const context = canvas.getContext('2d');
  if (!context) return null;

  context.drawImage(
    video,
    0,
    0,
    video.videoWidth,
    video.videoHeight,
    0,
    0,
    output.width,
    output.height,
  );

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((blob) => resolve(blob), MIME, QUALITY);
  });
}
