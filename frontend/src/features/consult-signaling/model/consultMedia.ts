/**
 * 상담에 쓸 로컬 미디어를 상담이 연결되기 전에 미리 잡아 두는 자리.
 *
 * MediaStream 은 직렬화할 수 없어 Zustand 에 두지 않는다(AGENTS.md). 상담 요청 화면이
 * 여기에 맡기면 상담 화면이 그대로 가져다 쓴다.
 *
 * 미리 잡아 두는 이유는 두 가지다.
 * - 화면 선택 창은 브라우저가 사용자 조작 직후에만 열어 준다. 상담이 연결된 뒤에 열려고
 *   하면 조작 흔적이 없어 거절되거나, 사용자가 창을 보지 못한 채 넘어간다.
 * - 협상이 시작될 때 보낼 트랙이 이미 있어야 한다. 화면을 고르는 동안 협상이 먼저 끝나면
 *   트랙 없는 연결이 맺어져, 상담자 쪽에 영상이 한참 동안(또는 끝내) 뜨지 않는다.
 */

let heldStream: MediaStream | null = null;

/**
 * 화면 공유와 마이크를 함께 잡는다.
 *
 * `preferCurrentTab` 은 크롬이 목록 대신 지금 이 탭을 바로 제시하게 한다. 선택 자체를
 * 건너뛰게 할 수는 없다 — 어떤 화면을 넘길지는 브라우저가 사용자에게 직접 확인해야 하며
 * 페이지가 대신 고를 수 없다.
 */
/**
 * 이 기기에서 화면을 공유할 수 있는지.
 *
 * `getDisplayMedia`는 데스크톱 브라우저에만 있다. Android Chrome·iOS Safari에는 함수 자체가
 * 없어 부르는 순간 `TypeError`가 난다. 그걸 거절로 읽으면 사용자가 아무것도 거부하지 않았는데
 * "모두 동의해주세요" 대화상자가 뜨고, 눌러도 같은 자리를 맴돈다.
 */
export function canShareConsultScreen(): boolean {
  return typeof navigator.mediaDevices?.getDisplayMedia === 'function';
}

export async function captureConsultMedia(): Promise<MediaStream> {
  const display = await navigator.mediaDevices.getDisplayMedia({
    video: true,
    preferCurrentTab: true,
  } as DisplayMediaStreamOptions);

  try {
    const microphone = await navigator.mediaDevices.getUserMedia({ audio: true });
    return new MediaStream([...display.getVideoTracks(), ...microphone.getAudioTracks()]);
  } catch (error) {
    // 마이크만 실패했다면 잡아 둔 화면까지 흘리지 않는다.
    display.getTracks().forEach((track) => track.stop());
    throw error;
  }
}

export function holdConsultMedia(stream: MediaStream) {
  if (heldStream && heldStream !== stream) releaseConsultMedia();
  heldStream = stream;
}

/**
 * 맡겨 둔 스트림을 꺼내지 않고 들여다본다.
 *
 * 연결이 끊겨 다시 맺을 때도 같은 화면을 그대로 써야 한다. 꺼내 버리면 재연결마다 화면
 * 선택 창이 다시 떠서 사용자가 매번 골라야 한다.
 */
export function peekConsultMedia(): MediaStream | null {
  return heldStream;
}

/** 맡겨 둔 스트림이 아직 화면을 보내고 있는지. 끝난 트랙은 되살릴 수 없다. */
export function isConsultScreenLive(): boolean {
  return (heldStream?.getVideoTracks() ?? []).some((track) => track.readyState === 'live');
}

/**
 * 맡겨 둔 스트림의 화면 트랙을 새로 고른 것으로 갈아 끼운다.
 *
 * 다시 공유할 때 보내는 트랙만 바꾸고 여기를 그대로 두면, 연결이 끊겼다 다시 맺어질 때
 * 이미 끝난 옛 트랙을 다시 집어 든다. 그러면 상담자 화면은 검은 채로 남고, 사용자는 방금
 * 다시 공유했는데 왜 안 보이는지 알 수 없다.
 */
export function replaceConsultScreenTrack(track: MediaStreamTrack) {
  if (!heldStream) {
    heldStream = new MediaStream([track]);
    return;
  }

  heldStream.getVideoTracks().forEach((previous) => {
    previous.stop();
    heldStream?.removeTrack(previous);
  });
  heldStream.addTrack(track);
}

/**
 * 사용자 카메라. 공유 화면·마이크와 따로 잡아 둔다.
 *
 * 상담자에게 따로 보내지 않고 사용자 화면 위에 셀프뷰로 띄운다. 화면 전체가 이미 공유
 * 대상이라 그 안에 담겨 함께 건너간다 — 영상 트랙을 하나 더 협상하지 않아도 상담자는
 * 사용자가 무엇을 보고 어떤 상황인지 함께 볼 수 있다.
 *
 * 화면·마이크와 한 스트림에 묶지 않는 이유는, 그 스트림의 영상 트랙이 곧 상담자에게 보내는
 * 화면 공유 트랙이기 때문이다. 카메라를 같이 담으면 어느 쪽을 보내야 하는지 알 수 없다.
 */
let heldCamera: MediaStream | null = null;

/** 카메라를 잡는다. 거절하면 그대로 던진다 — 상담은 카메라 없이도 이어진다. */
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
