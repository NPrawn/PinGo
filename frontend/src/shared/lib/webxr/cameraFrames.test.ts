import {
  cameraImageOf,
  createXrCameraFrameGrabber,
  createXrCameraFrameSink,
  rawCameraOf,
} from './cameraFrames';

/**
 * XR 카메라 프레임 경로. (S15P11A206-89)
 *
 * jsdom 에는 WebGL 도 `captureStream` 도 없어 **자원 관리와 실패 처리만** 검사한다. 실제로
 * 카메라 영상이 나오는지는 실기기에서만 확인할 수 있다. 그래서 여기서 고정하는 것은
 * "어디서 실패해도 예외 없이 null 로 알린다"와 "빌린 GL 자원을 되돌린다"다 — 둘 중 하나라도
 * 어긋나면 세션 전체가 조용히 죽는데, 그 증상은 카메라가 아니라 추적에서 먼저 나타난다.
 */

const SIZE = { width: 4, height: 2 };

/** WebGL 호출을 기록하는 가짜 컨텍스트. 성공 경로를 기본값으로 둔다. */
function createFakeGl(overrides: Partial<Record<string, unknown>> = {}) {
  const deleted: string[] = [];
  const bound: (WebGLFramebuffer | null)[] = [];

  const gl = {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    ARRAY_BUFFER: 5,
    STATIC_DRAW: 6,
    TEXTURE_2D: 7,
    RGBA: 8,
    UNSIGNED_BYTE: 9,
    TEXTURE_MIN_FILTER: 10,
    TEXTURE_MAG_FILTER: 11,
    TEXTURE_WRAP_S: 12,
    TEXTURE_WRAP_T: 13,
    LINEAR: 14,
    CLAMP_TO_EDGE: 15,
    FRAMEBUFFER: 16,
    COLOR_ATTACHMENT0: 17,
    FRAMEBUFFER_COMPLETE: 18,
    TEXTURE0: 19,
    FLOAT: 20,
    TRIANGLE_STRIP: 21,

    createShader: vi.fn(() => ({}) as WebGLShader),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    deleteShader: vi.fn(() => deleted.push('shader')),
    createProgram: vi.fn(() => ({}) as WebGLProgram),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    deleteProgram: vi.fn(() => deleted.push('program')),
    createBuffer: vi.fn(() => ({}) as WebGLBuffer),
    deleteBuffer: vi.fn(() => deleted.push('buffer')),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    createTexture: vi.fn(() => ({}) as WebGLTexture),
    deleteTexture: vi.fn(() => deleted.push('texture')),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    createFramebuffer: vi.fn(() => ({}) as WebGLFramebuffer),
    deleteFramebuffer: vi.fn(() => deleted.push('framebuffer')),
    bindFramebuffer: vi.fn((_target: number, framebuffer: WebGLFramebuffer | null) => {
      bound.push(framebuffer);
    }),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn(() => 18),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({}) as WebGLUniformLocation),
    viewport: vi.fn(),
    useProgram: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    activeTexture: vi.fn(),
    uniform1i: vi.fn(),
    drawArrays: vi.fn(),
    readPixels: vi.fn(
      (
        _x: number,
        _y: number,
        _w: number,
        _h: number,
        _format: number,
        _type: number,
        target: Uint8Array,
      ) => {
        // 읽은 값이 그대로 나가는지 보려고 자리마다 다른 값을 채운다.
        target.forEach((_value, index) => {
          target[index] = index;
        });
      },
    ),
    ...overrides,
  };

  return { gl: gl as unknown as WebGL2RenderingContext, deleted, bound };
}

describe('rawCameraOf', () => {
  it('camera-access 가 부여되지 않은 뷰에서는 null 이다', () => {
    expect(rawCameraOf({} as XRView)).toBeNull();
  });

  it('뷰에 실린 카메라를 그대로 돌려준다', () => {
    const camera = { width: 640, height: 480 };

    expect(rawCameraOf({ camera } as unknown as XRView)).toBe(camera);
  });
});

describe('cameraImageOf', () => {
  const camera = { width: 640, height: 480 };

  /** 표준이 아니라 binding 에 이 메서드가 없는 기기가 있다. 없는 것은 실패가 아니다. */
  it('getCameraImage 가 없으면 null 이다', () => {
    expect(cameraImageOf({} as XRWebGLBinding, camera)).toBeNull();
  });

  it('텍스처를 돌려준다', () => {
    const texture = {} as WebGLTexture;
    const binding = { getCameraImage: () => texture } as unknown as XRWebGLBinding;

    expect(cameraImageOf(binding, camera)).toBe(texture);
  });

  /**
   * 기능이 부여됐어도 프레임에 따라 던진다. 그 프레임만 건너뛰어야 한다 — 예외가 프레임 루프까지
   * 올라가면 pose 수집이 함께 멈춘다.
   */
  it('던지면 그 프레임만 건너뛴다', () => {
    const binding = {
      getCameraImage: () => {
        throw new Error('camera image unavailable');
      },
    } as unknown as XRWebGLBinding;

    expect(cameraImageOf(binding, camera)).toBeNull();
  });
});

describe('createXrCameraFrameGrabber', () => {
  it('읽은 픽셀을 그대로 돌려준다', () => {
    const { gl } = createFakeGl();
    const grabber = createXrCameraFrameGrabber(gl, SIZE);

    const pixels = grabber?.grab({} as WebGLTexture);

    expect(pixels).toHaveLength(SIZE.width * SIZE.height * 4);
    expect(pixels?.[5]).toBe(5);
  });

  /**
   * 읽고 나서 세션 레이어로 되돌려야 한다.
   *
   * 남겨 두면 다음 프레임의 `clearToTransparent`가 이 작은 프레임버퍼를 지우고, 카메라를
   * 보이게 하는 그 지우기가 일어나지 않아 **화면에서 카메라가 사라진다.** 카메라 전송을 붙였는데
   * 사용자 화면이 검게 되는 증상이 여기서 나온다.
   */
  it('읽은 뒤 프레임버퍼 바인딩을 되돌린다', () => {
    const { gl, bound } = createFakeGl();
    const grabber = createXrCameraFrameGrabber(gl, SIZE);

    bound.length = 0;
    grabber?.grab({} as WebGLTexture);

    expect(bound.at(-1)).toBeNull();
  });

  it('dispose 뒤에는 읽지 않는다', () => {
    const { gl } = createFakeGl();
    const grabber = createXrCameraFrameGrabber(gl, SIZE);

    grabber?.dispose();

    expect(grabber?.grab({} as WebGLTexture)).toBeNull();
  });

  it('dispose 는 두 번 불러도 자원을 한 번만 반납한다', () => {
    const { gl, deleted } = createFakeGl();
    const grabber = createXrCameraFrameGrabber(gl, SIZE);

    grabber?.dispose();
    grabber?.dispose();

    expect(deleted.filter((name) => name === 'program')).toHaveLength(1);
  });

  /** 셰이더 컴파일은 기기·드라이버에 따라 실패한다. 세션을 죽이지 않고 null 로 알린다. */
  it('셰이더 컴파일이 실패하면 null 이고 셰이더를 반납한다', () => {
    const { gl, deleted } = createFakeGl({ getShaderParameter: vi.fn(() => false) });

    expect(createXrCameraFrameGrabber(gl, SIZE)).toBeNull();
    expect(deleted).toContain('shader');
  });

  it('프로그램 링크가 실패하면 null 이고 프로그램을 반납한다', () => {
    const { gl, deleted } = createFakeGl({ getProgramParameter: vi.fn(() => false) });

    expect(createXrCameraFrameGrabber(gl, SIZE)).toBeNull();
    expect(deleted).toContain('program');
  });

  /**
   * 프레임버퍼가 불완전한 채로 읽으면 값이 정의되지 않는다. 만들 때 확인하고, 실패하면 빌린
   * 자원을 모두 되돌린다 — GL 자원은 컨텍스트당 개수 제한이 있어 새는 것이 곧 다음 세션 실패다.
   */
  it('프레임버퍼가 불완전하면 null 이고 빌린 자원을 모두 반납한다', () => {
    const { gl, deleted } = createFakeGl({ checkFramebufferStatus: vi.fn(() => 0) });

    expect(createXrCameraFrameGrabber(gl, SIZE)).toBeNull();
    expect(deleted).toEqual(
      expect.arrayContaining(['program', 'buffer', 'texture', 'framebuffer']),
    );
  });
});

describe('createXrCameraFrameSink', () => {
  /** jsdom 에는 2d 컨텍스트도 captureStream 도 없다. 둘 다 대신 세운다. */
  function stubCanvas() {
    const putImageData = vi.fn();
    const track = { stop: vi.fn() } as unknown as MediaStreamTrack;
    const stream = { getTracks: () => [track] } as unknown as MediaStream;

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      createImageData: (width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
        width,
        height,
      }),
      putImageData,
    } as unknown as CanvasRenderingContext2D);

    HTMLCanvasElement.prototype.captureStream = vi.fn(() => stream);

    return { putImageData, track, stream };
  }

  afterEach(() => {
    vi.restoreAllMocks();
    // spyOn 으로는 되돌아가지 않는다 — jsdom 에 원래 없는 메서드를 직접 붙였기 때문이다.
    delete (HTMLCanvasElement.prototype as { captureStream?: unknown }).captureStream;
  });

  it('픽셀을 캔버스에 옮긴다', () => {
    const { putImageData } = stubCanvas();
    const sink = createXrCameraFrameSink(SIZE, 10);

    sink?.push(new Uint8Array(SIZE.width * SIZE.height * 4).fill(7));

    expect(putImageData).toHaveBeenCalledTimes(1);
  });

  /** 상담이 끝나면 트랙을 멈춘다. 남겨 두면 카메라 표시등이 켜진 채로 남는다. */
  it('dispose 는 트랙을 멈추고 그 뒤로는 그리지 않는다', () => {
    const { putImageData, track } = stubCanvas();
    const sink = createXrCameraFrameSink(SIZE, 10);

    sink?.dispose();
    sink?.push(new Uint8Array(SIZE.width * SIZE.height * 4));

    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(putImageData).not.toHaveBeenCalled();
  });

  it('captureStream 이 없는 환경에서는 null 이다', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      {} as unknown as CanvasRenderingContext2D,
    );

    expect(createXrCameraFrameSink(SIZE, 10)).toBeNull();
  });
});
