/**
 * XR 세션의 카메라 영상을 `MediaStream`으로 뽑는 경로. (S15P11A206-89)
 *
 * **왜 이것이 필요한가.** `getUserMedia`와 `immersive-ar` 세션은 공존하지 못한다(11.8,
 * `session.ts`의 `releaseCamera` 주석). 그런데 상담은 두 가지를 동시에 요구한다 — 사용자는
 * 세션을 열어야 위치를 추적하고, 상담자는 그 사용자의 카메라를 봐야 한다. `getUserMedia`로는
 * 둘 중 하나를 포기해야 하므로, 세션 **안에서** 카메라 이미지를 얻어 트랙으로 만든다.
 *
 * 경로는 이렇다.
 *
 * ```
 * XRView.camera → getCameraImage() → WebGLTexture
 *   → 작은 프레임버퍼에 축소 렌더 → readPixels
 *   → 2D 캔버스 putImageData → canvas.captureStream()
 * ```
 *
 * **축소해서 읽는 것이 핵심이다.** 카메라 원본은 기기에 따라 1920×1080이고, 그것을 그대로
 * CPU로 내리면 프레임마다 8MB다. 추적과 같은 GPU를 쓰므로 그 비용이 pose 품질로 되돌아온다.
 * 320×240으로 줄이면 300KB이고, 상담자가 주변을 알아보는 데는 충분하다.
 *
 * **미확정 사항이 둘 있다. 실기기 확인이 필요하다.**
 *
 * 1. `readPixels`는 파이프라인을 flush한다. 11.8이 금지한 것은 XR 레이어 프레임버퍼에 대한
 *    동기 읽기이고 여기서는 별도 프레임버퍼를 읽지만, flush 자체는 같다. 추적이 흔들리면
 *    PBO(`PIXEL_PACK_BUFFER` + `clientWaitSync`)로 비동기화한다 — 컨텍스트를 webgl2로 만들어
 *    둔 이유가 그것이다(11.8).
 * 2. `getCameraImage` 텍스처의 방향은 기기마다 다를 수 있다. 세로로 든 단말에서 90도 누워
 *    나오면 `orientation` 옵션으로 돌린다.
 */

/**
 * Raw Camera Access 모듈의 타입. **`@types/webxr` 0.5에 없어 직접 선언한다.**
 *
 * 표준이 아니라 부여되지 않는 기기가 있다. 그래서 전부 optional로 두고, 없으면 `unsupported`로
 * 알린다 — 예외를 던지면 세션 전체가 죽는다.
 */
interface XrRawCamera {
  readonly width: number;
  readonly height: number;
}

interface XrViewWithCamera {
  readonly camera?: XrRawCamera;
}

interface XrCameraImageBinding {
  getCameraImage?: (camera: XrRawCamera) => WebGLTexture | null;
}

/** 세션의 뷰에서 카메라를 꺼낸다. 기능이 부여되지 않았으면 null. */
export function rawCameraOf(view: XRView): XrRawCamera | null {
  return (view as XRView & XrViewWithCamera).camera ?? null;
}

/**
 * 카메라 이미지를 텍스처로 얻는다. 실패하면 null.
 *
 * binding 은 세션마다 하나만 만들어 재사용한다. 프레임마다 만들면 GPU 자원을 매번 새로 잡는다.
 */
export function cameraImageOf(binding: XRWebGLBinding, camera: XrRawCamera): WebGLTexture | null {
  const withImage = binding as XRWebGLBinding & XrCameraImageBinding;

  if (typeof withImage.getCameraImage !== 'function') return null;

  try {
    return withImage.getCameraImage(camera);
  } catch {
    // 기능이 부여됐어도 프레임에 따라 던질 수 있다. 그 프레임만 건너뛴다.
    return null;
  }
}

/**
 * 상담자에게 보낼 프레임 크기. 320×240은 4:3이다.
 *
 * 카메라 원본 비율이 16:9면 축소 렌더에서 늘어난다. 상담자 화면의 `object-fit: contain`이
 * 다시 맞춰 주지 않으므로 여기서 원본 비율을 따르게 할 수도 있는데, 그러면 기기마다 트랙
 * 해상도가 달라진다. 고정 크기로 두고 비율 보정은 실기기에서 확인한다.
 */
export const DEFAULT_CAMERA_FRAME_SIZE = { width: 320, height: 240 } as const;

/**
 * 초당 몇 장을 보낼지.
 *
 * 30fps로 보내면 읽기 비용이 3배가 되는데 상담에서 얻는 것은 거의 없다 — 상담자는 사용자가
 * 어디에 서서 무엇을 보고 있는지 알려는 것이고, 그 판단에 10fps면 충분하다. 추적을 지키는 것이
 * 먼저다.
 */
export const DEFAULT_CAMERA_FRAME_FPS = 10;

export interface XrCameraFrameSize {
  width: number;
  height: number;
}

export interface XrCameraFrameGrabber {
  /** 카메라 텍스처를 축소해 픽셀로 내린다. 실패하면 null. */
  grab(texture: WebGLTexture): Uint8Array | null;
  dispose(): void;
}

/** 전체 화면 사각형. `TRIANGLE_STRIP` 네 점이다. */
const QUAD = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);

/**
 * 정점 셰이더. **세로를 뒤집는다.**
 *
 * `readPixels`는 프레임버퍼의 **아래 줄부터** 돌려주는데 `ImageData`는 위 줄부터 채운다. 여기서
 * 뒤집어 두면 읽은 배열이 그대로 위에서 아래 순서가 되어, CPU에서 줄을 다시 세울 필요가 없다.
 *
 * 버전 지시자를 두지 않아 ES 1.00으로 컴파일된다. webgl2 컨텍스트도 이 셰이더를 받으므로,
 * webgl1로 떨어진 기기와 같은 코드를 쓴다.
 */
const VERTEX_SHADER = `
attribute vec2 a_pos;
varying vec2 v_uv;
void main() {
  v_uv = vec2(a_pos.x, -a_pos.y) * 0.5 + 0.5;
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;
uniform sampler2D u_tex;
varying vec2 v_uv;
void main() {
  gl_FragColor = texture2D(u_tex, v_uv);
}
`;

function compile(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);

  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

/**
 * 축소 렌더와 읽기를 담당하는 GL 자원을 만든다. 어느 단계든 실패하면 null이다.
 *
 * **세션의 GL 컨텍스트를 그대로 쓴다.** 카메라 텍스처는 그 컨텍스트에 속하므로 다른 컨텍스트로
 * 옮길 방법이 없다. 컨텍스트를 공유하는 대신 상태를 건드린 뒤 되돌리지 않는다는 점에 주의한다 —
 * 이 모듈이 부르는 시점은 세션 프레임 루프의 `clearToTransparent` 뒤이고, 그 함수는 매 프레임
 * 자기 상태를 다시 세우므로 서로 간섭하지 않는다.
 */
export function createXrCameraFrameGrabber(
  gl: WebGLRenderingContext | WebGL2RenderingContext,
  size: XrCameraFrameSize = DEFAULT_CAMERA_FRAME_SIZE,
): XrCameraFrameGrabber | null {
  const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
  const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  const program = vertex && fragment ? gl.createProgram() : null;

  if (!vertex || !fragment || !program) {
    if (vertex) gl.deleteShader(vertex);
    if (fragment) gl.deleteShader(fragment);
    return null;
  }

  gl.attachShader(program, vertex);
  gl.attachShader(program, fragment);
  gl.linkProgram(program);
  // 셰이더는 링크된 뒤에는 프로그램이 들고 있으므로 참조를 놓는다.
  gl.deleteShader(vertex);
  gl.deleteShader(fragment);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  const buffer = gl.createBuffer();
  const target = gl.createTexture();
  const framebuffer = gl.createFramebuffer();

  if (!buffer || !target || !framebuffer) {
    gl.deleteProgram(program);
    if (buffer) gl.deleteBuffer(buffer);
    if (target) gl.deleteTexture(target);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    return null;
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, QUAD, gl.STATIC_DRAW);

  gl.bindTexture(gl.TEXTURE_2D, target);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    size.width,
    size.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null,
  );
  /**
   * 축소하므로 확대 필터는 쓰이지 않지만 둘 다 지정해야 한다. 밉맵을 만들지 않으므로
   * `LINEAR_MIPMAP_*`은 쓸 수 없다 — 지정하면 텍스처가 불완전해져 검은 화면이 나온다.
   */
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, target, 0);

  const complete = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  if (!complete) {
    gl.deleteProgram(program);
    gl.deleteBuffer(buffer);
    gl.deleteTexture(target);
    gl.deleteFramebuffer(framebuffer);
    return null;
  }

  const position = gl.getAttribLocation(program, 'a_pos');
  const sampler = gl.getUniformLocation(program, 'u_tex');
  const pixels = new Uint8Array(size.width * size.height * 4);

  let disposed = false;

  return {
    grab(texture) {
      if (disposed) return null;

      gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
      gl.viewport(0, 0, size.width, size.height);
      gl.useProgram(program);

      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      /**
       * 카메라 텍스처의 필터를 여기서 정한다. `getCameraImage`가 돌려주는 텍스처는 밉맵이
       * 없어, 기본값(`NEAREST_MIPMAP_LINEAR`)이면 불완전 텍스처로 취급되어 검게 나온다.
       */
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.uniform1i(sampler, 0);

      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      gl.readPixels(0, 0, size.width, size.height, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

      /**
       * 세션 레이어로 되돌린다. 프레임 루프가 이 뒤에 다시 바인딩하지 않으므로, 남겨 두면
       * 다음 프레임의 `clear`가 이 작은 프레임버퍼로 가고 카메라가 화면에서 사라진다.
       */
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);

      return pixels;
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      gl.deleteProgram(program);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(target);
      gl.deleteFramebuffer(framebuffer);
    },
  };
}

export interface XrCameraFrameSink {
  /** WebRTC 로 보낼 트랙이 담긴 스트림. */
  stream: MediaStream;
  /** 읽어 온 픽셀을 화면에 옮긴다. */
  push(pixels: Uint8Array): void;
  dispose(): void;
}

/**
 * 픽셀을 받아 트랙으로 흘려보내는 캔버스를 만든다. 캔버스를 쓸 수 없으면 null.
 *
 * **`captureStream`의 fps 는 상한이다.** 실제로 나가는 것은 캔버스가 바뀐 횟수만큼이므로,
 * 프레임 루프가 이보다 자주 그려도 트랙은 이 값을 넘지 않는다. 반대로 덜 그리면 그만큼만 간다.
 */
export function createXrCameraFrameSink(
  size: XrCameraFrameSize = DEFAULT_CAMERA_FRAME_SIZE,
  fps: number = DEFAULT_CAMERA_FRAME_FPS,
): XrCameraFrameSink | null {
  const canvas = document.createElement('canvas');

  canvas.width = size.width;
  canvas.height = size.height;

  const context = canvas.getContext('2d');

  if (!context || typeof canvas.captureStream !== 'function') return null;

  const stream = canvas.captureStream(fps);
  /**
   * 버퍼를 한 번만 만들어 재사용한다. `putImageData`가 값을 복사하므로 같은 버퍼를 계속 써도
   * 앞 프레임이 덮이지 않는다.
   */
  const image = context.createImageData(size.width, size.height);

  let disposed = false;

  return {
    stream,
    push(pixels) {
      if (disposed) return;
      image.data.set(pixels);
      context.putImageData(image, 0, 0);
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      stream.getTracks().forEach((track) => track.stop());
    },
  };
}
