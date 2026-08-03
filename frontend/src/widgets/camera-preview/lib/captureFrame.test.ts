import { captureFrame } from './captureFrame';

/** `videoWidth`는 읽기 전용이라 테스트에서 직접 정의한다. */
function fakeVideo(width: number, height: number): HTMLVideoElement {
  const video = document.createElement('video');
  Object.defineProperty(video, 'videoWidth', { value: width });
  Object.defineProperty(video, 'videoHeight', { value: height });
  return video;
}

describe('captureFrame', () => {
  it('요소가 없으면 뜨지 않는다', async () => {
    await expect(captureFrame(null)).resolves.toBeNull();
  });

  /**
   * 미리보기를 붙인 직후에는 첫 프레임이 아직 없어 `videoWidth`가 0이다. 그 상태로 뜨면
   * 0×0 이미지가 나오고 서버는 `invalid_image`로 돌려준다.
   */
  it('첫 프레임이 오기 전에는 뜨지 않는다', async () => {
    await expect(captureFrame(fakeVideo(0, 0))).resolves.toBeNull();
  });

  /**
   * 캔버스는 CSS 크기가 아니라 영상 원본 크기로 만든다. 화면에서는 영역에 맞춰 잘려 있는데,
   * 잘린 그림을 원본이라고 보내면 위치추정이 카메라 내부 파라미터와 맞지 않는다.
   */
  it('캔버스를 영상 원본 크기로 만들고 JPEG으로 뜬다', async () => {
    const created: HTMLCanvasElement[] = [];
    const original = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      const element = original(tag as 'canvas');
      if (tag === 'canvas') created.push(element as HTMLCanvasElement);
      return element;
    });
    // jsdom에는 2d 컨텍스트도 toBlob 구현도 없다. 둘 다 대신 세운다.
    const context = { drawImage: vi.fn() } as unknown as CanvasRenderingContext2D;
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context);
    const blob = new Blob(['frame'], { type: 'image/jpeg' });
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback) => callback(blob));

    await expect(captureFrame(fakeVideo(1280, 720))).resolves.toBe(blob);

    expect(created).toHaveLength(1);
    expect(created[0].width).toBe(768);
    expect(created[0].height).toBe(432);
    expect(context.drawImage).toHaveBeenCalledWith(
      expect.anything(),
      0,
      0,
      1280,
      720,
      0,
      0,
      768,
      432,
    );
    // 사진이라 JPEG이다. PNG로 뜨면 같은 화면이 몇 배 커진다.
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.9);
  });
});
