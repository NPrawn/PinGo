/**
 * 상담에 쓸 로컬 미디어를 상담이 연결되기 전에 미리 잡아 두는 자리.
 *
 * MediaStream 은 직렬화할 수 없어 Zustand 에 두지 않는다(AGENTS.md). 상담 요청 화면이
 * 여기에 맡기면 상담 화면이 그대로 가져다 쓴다.
 *
 * 미리 잡아 두는 이유는 협상이 시작될 때 보낼 트랙이 이미 있어야 하기 때문이다. 장치를
 * 얻는 동안 협상이 먼저 끝나면 트랙 없는 연결이 맺어져, 상담자 쪽에 영상이 한참 동안
 * (또는 끝내) 뜨지 않는다.
 *
 * 화면 공유(`getDisplayMedia`)는 쓰지 않는다. 데스크톱 브라우저에만 있는 기능이라 이
 * 서비스가 상대하는 모바일 기기에서는 함수 자체가 없다. 상담자는 사용자 카메라와, 별도로
 * 오는 MAP_SYNC 로 다시 그린 지도를 함께 본다.
 */

let heldStream: MediaStream | null = null;

/**
 * 마이크. 상담에 반드시 필요하다.
 *
 * 목소리가 오가지 않으면 안내할 방법이 없어, 이것만은 실패를 넘기지 않고 그대로 던진다.
 */
export function captureConsultMicrophone(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ audio: true });
}

/**
 * 상담자에게 보낼 스트림을 만든다.
 *
 * 카메라는 사용자가 동의했을 때만 담긴다. 담기지 않으면 목소리만 건너가고, 상담자 쪽
 * 영상 자리는 비어 있는 대로 둔다 — FR-U-015 는 영상 **또는** 음성을 요구한다.
 */
export function composeConsultMedia(
  microphone: MediaStream,
  camera: MediaStream | null,
): MediaStream {
  return new MediaStream([...microphone.getAudioTracks(), ...(camera?.getVideoTracks() ?? [])]);
}

export function holdConsultMedia(stream: MediaStream) {
  if (heldStream && heldStream !== stream) releaseConsultMedia();
  heldStream = stream;
}

/**
 * 맡겨 둔 스트림을 꺼내지 않고 들여다본다.
 *
 * 연결이 끊겨 다시 맺을 때도 같은 장치를 그대로 써야 한다. 꺼내 버리면 재연결마다 카메라와
 * 마이크를 새로 잡아, 표시등이 깜빡이고 영상이 한 번씩 끊긴다.
 */
export function peekConsultMedia(): MediaStream | null {
  return heldStream;
}

/**
 * 보내는 스트림의 영상 트랙을 다른 것으로 갈아 끼운다. (S15P11A206-89)
 *
 * 상담 화면이 XR 세션을 열면 `getUserMedia` 카메라를 놓아야 한다 — 둘은 공존하지 못한다(11.8).
 * 대신 세션 안에서 뽑은 프레임이 트랙이 되어 그 자리에 들어온다.
 *
 * **맡겨 둔 스트림 쪽도 함께 바꾸는 것이 요점이다.** 이미 맺어진 연결은 `replaceTrack`으로
 * 갈아 끼우지만, 끊겼다 다시 맺을 때는 시그널링이 `peekConsultMedia()`를 다시 읽는다. 여기를
 * 바꾸지 않으면 재연결에서 멈춘 옛 카메라 트랙이 다시 실려 상담자 화면이 검게 된다.
 *
 * 카메라를 잡은 적이 없으면(사용자가 영상 공유를 거절했다) 아무것도 하지 않는다. 거절한 사람의
 * 화면을 세션 프레임으로 대신 보내는 것은 그 선택을 뒤집는 일이다.
 */
export function swapConsultVideoTrack(next: MediaStreamTrack | null): boolean {
  if (!heldStream) return false;

  const previous = heldStream.getVideoTracks();

  if (previous.length === 0) return false;

  previous.forEach((track) => {
    heldStream?.removeTrack(track);
    track.stop();
  });

  if (next) heldStream.addTrack(next);

  /**
   * 셀프뷰용으로 따로 잡아 둔 카메라도 함께 놓는다.
   *
   * 이것을 남기면 `immersive-ar` 세션이 열려도 카메라 장치가 점유된 채라, 세션은 오류 없이
   * 열리고 pose만 영원히 들어오지 않는다(11.8). 상담 화면은 셀프뷰를 두지 않으므로 읽는 곳도
   * 없다 — 세션이 그리는 카메라 영상이 곧 사용자가 보는 화면이다.
   */
  heldCamera?.getTracks().forEach((track) => track.stop());
  heldCamera = null;

  return true;
}

/**
 * 사용자 카메라. 보내는 스트림과 따로 한 번 더 붙잡아 둔다.
 *
 * 상담 화면의 셀프뷰가 이걸 읽는다. 같은 영상 트랙이 보내는 스트림에도 담겨 있어, 사용자가
 * 자기 화면에서 보는 것과 상담자에게 건너가는 것이 어긋나지 않는다.
 */
let heldCamera: MediaStream | null = null;

/** 카메라를 잡는다. 거절하면 그대로 던진다 — 부르는 쪽이 받아 카메라 없이 이어 간다. */
export function captureConsultCamera(): Promise<MediaStream> {
  return navigator.mediaDevices.getUserMedia({ video: true });
}

export function holdConsultCamera(stream: MediaStream) {
  if (heldCamera && heldCamera !== stream) {
    heldCamera.getTracks().forEach((track) => track.stop());
  }
  heldCamera = stream;
}

export function peekConsultCamera(): MediaStream | null {
  return heldCamera;
}

/** 상담으로 이어지지 못했을 때 카메라·마이크 표시등이 켜진 채 남지 않게 정리한다. */
export function releaseConsultMedia() {
  heldStream?.getTracks().forEach((track) => track.stop());
  heldStream = null;
  heldCamera?.getTracks().forEach((track) => track.stop());
  heldCamera = null;
}
