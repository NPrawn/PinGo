import { transcribeConsultationAudio } from '@/shared/api';

/**
 * 마이크 소리를 직접 녹음해 서버에 받아쓰기를 맡긴다.
 *
 * 브라우저 음성 인식(`SpeechRecognition`)을 쓰지 않는 이유는 그것이 `getUserMedia` 와
 * **마이크를 다투기** 때문이다. 데스크톱에서는 둘이 공존하지만 안드로이드에서는 배타적이라
 * 통화 캡처가 이기고 인식기가 `audio-capture` 로 죽는다. 목소리는 멀쩡히 오가니 아무도
 * 눈치채지 못한 채 그쪽 발화만 전문에서 통째로 빠진다.
 *
 * `MediaRecorder` 는 **이미 열려 있는 트랙을 인코딩할 뿐** 마이크를 새로 열지 않는다. 그래서
 * 이 다툼이 아예 없다. 덤으로 그 트랙에는 `getUserMedia` 의 에코 제거가 이미 걸려 있다 —
 * 인식기의 자체 캡처에는 걸리지 않던 것이라, 스피커로 나간 소리를 되받아 적는 일도 줄어든다.
 */

/** 이만큼 조용하면 한 마디가 끝난 것으로 본다. */
const SILENCE_HOLD_MS = 700;

/**
 * 한 조각의 최대 길이.
 *
 * 서버가 받아 주는 상한(약 30초)의 절반이다. 길이를 늘려도 비용은 거의 그대로지만 — 모델은
 * 오디오를 초당 32 토큰으로 세고 지시문은 열 토큰 남짓이다 — **왕복 시간이 조각 길이와
 * 무관하게 3초쯤 걸리므로 짧게 끊을수록 자막이 빨리 뜬다.**
 */
const MAX_SEGMENT_MS = 15000;

/** 이보다 짧은 소리는 말이 아니라 잡음으로 본다. */
const MIN_SEGMENT_MS = 400;

/**
 * 말소리로 칠 음량.
 *
 * 마이크 이득이 기기마다 달라 절대값 하나로는 맞출 수 없다. 조용할 때의 바닥 소음을 재서
 * 그보다 뚜렷하게 큰 소리만 말로 본다.
 */
const SPEECH_MARGIN = 0.012;
const NOISE_FLOOR_ALPHA = 0.02;

/** 소리 크기를 재는 간격. */
const ANALYSE_INTERVAL_MS = 50;

export type ServerCaptionRecorderOptions = {
  consultationId: string;
  stream: MediaStream;
  language?: string;
  /** 받아쓴 글이 나올 때마다 부른다. 여러 문장이면 줄마다 따로 부른다. */
  onFinalText: (text: string) => void;
  /** 말이 시작되고 끝날 때 알린다. 화면이 "말하는 중"을 띄우는 데 쓴다. */
  onSpeakingChange?: (speaking: boolean) => void;
  /** 서버에 닿지 못했다. 몇 번 이어지면 화면이 상대에게 알린다. */
  onError?: () => void;
};

export type ServerCaptionRecorder = {
  stop: () => void;
};

/**
 * 브라우저가 실제로 만들어 낼 수 있는 형식을 고른다.
 *
 * Chrome 은 webm/opus, Safari 는 mp4 를 준다. 지원하지 않는 형식으로 `MediaRecorder` 를
 * 만들면 생성 자체가 실패해 자막이 통째로 없어진다.
 */
function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;

  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type));
}

function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  // 한 번에 넘기면 인자가 너무 많아 스택이 넘친다. 조금씩 끊어 잇는다.
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunk));
  }
  return btoa(binary);
}

/**
 * 마이크를 지켜보다가 한 마디가 끝날 때마다 그 토막을 서버로 보낸다.
 *
 * 조각마다 `MediaRecorder` 를 새로 만든다. `start(timeslice)` 로 쪼개면 **두 번째 조각부터는
 * 컨테이너 헤더가 없어** 단독으로 디코딩되지 않기 때문이다. 서버는 그런 조각을 받으면
 * 아무 말도 없이 빈 글을 돌려주므로, 원인을 찾기가 매우 어렵다.
 */
export function startServerCaptionRecorder(
  options: ServerCaptionRecorderOptions,
): ServerCaptionRecorder | null {
  const { consultationId, stream, language, onFinalText, onSpeakingChange, onError } = options;

  const mimeType = pickMimeType();
  if (!mimeType || stream.getAudioTracks().length === 0) return null;

  const AudioCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;

  const audioContext = new AudioCtor();
  const source = audioContext.createMediaStreamSource(stream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);

  const samples = new Float32Array(analyser.fftSize);
  let noiseFloor = 0.01;
  let disposed = false;

  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let speaking = false;
  let segmentStartedAt = 0;
  let lastLoudAt = 0;

  const setSpeaking = (next: boolean) => {
    if (speaking === next) return;
    speaking = next;
    onSpeakingChange?.(next);
  };

  const upload = async (blob: Blob) => {
    try {
      const audio = toBase64(await blob.arrayBuffer());
      const response = await transcribeConsultationAudio(consultationId, {
        audio,
        mimeType,
        ...(language ? { language } : {}),
      });
      if (disposed) return;

      /*
       * 한 조각에 여러 문장이 담길 수 있다. 줄마다 따로 넘겨야 전문에서 한 줄이 한 마디가
       * 된다. 한 덩어리로 넣으면 나중에 읽는 사람이 어디서 말이 바뀌었는지 알 수 없다.
       */
      response.text
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach(onFinalText);
    } catch {
      if (!disposed) onError?.();
    }
  };

  const startSegment = () => {
    if (disposed || recorder) return;
    try {
      const instance = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 16000 });
      chunks = [];
      instance.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      instance.onstop = () => {
        const collected = chunks;
        chunks = [];
        if (collected.length > 0) void upload(new Blob(collected, { type: mimeType }));
      };
      instance.start();
      recorder = instance;
      segmentStartedAt = Date.now();
    } catch {
      // 이 기기에서는 녹음을 시작할 수 없다. 다음 발화에서 다시 시도한다.
      recorder = null;
    }
  };

  const endSegment = (keep: boolean) => {
    const instance = recorder;
    if (!instance) return;
    recorder = null;

    // 너무 짧은 소리는 올리지 않는다. 올려 봐야 빈 글이 오고 왕복만 낭비한다.
    if (!keep) instance.ondataavailable = null;
    try {
      instance.stop();
    } catch {
      // 이미 멈춰 있으면 그대로 둔다.
    }
  };

  const tick = () => {
    if (disposed) return;

    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (let index = 0; index < samples.length; index += 1) sum += samples[index] * samples[index];
    const level = Math.sqrt(sum / samples.length);

    const now = Date.now();
    const loud = level > noiseFloor + SPEECH_MARGIN;

    // 조용한 동안에만 바닥 소음을 갱신한다. 말소리까지 섞으면 기준이 계속 올라가 말을 놓친다.
    if (!loud) noiseFloor += (level - noiseFloor) * NOISE_FLOOR_ALPHA;

    if (loud) {
      lastLoudAt = now;
      setSpeaking(true);
      startSegment();
    }

    if (recorder) {
      const elapsed = now - segmentStartedAt;
      const silentFor = now - lastLoudAt;

      // 말이 길어지면 중간에 한 번 끊는다. 서버가 받아 주는 크기에도 상한이 있다.
      if (elapsed >= MAX_SEGMENT_MS) {
        endSegment(true);
        return;
      }
      if (silentFor >= SILENCE_HOLD_MS) {
        setSpeaking(false);
        endSegment(elapsed >= MIN_SEGMENT_MS);
      }
    }
  };

  const timer = window.setInterval(tick, ANALYSE_INTERVAL_MS);

  return {
    stop: () => {
      if (disposed) return;
      disposed = true;
      window.clearInterval(timer);
      // 마지막 조각은 버린다. 화면을 떠난 뒤에 도착한 자막은 넣을 곳이 없다.
      endSegment(false);
      setSpeaking(false);
      try {
        source.disconnect();
        void audioContext.close();
      } catch {
        // 이미 닫혔으면 그대로 둔다.
      }
    },
  };
}
