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

/** 권장 길이를 넘긴 뒤에는 단어 사이의 짧은 쉼에서도 분할한다. */
const TARGET_SEGMENT_SILENCE_MS = 200;

/**
 * 한 조각의 권장 길이와 강제 상한.
 *
 * Whisper는 조각 전체를 받은 뒤 전사하므로 지나치게 길면 자막도 그만큼 늦어진다. 평소에는
 * 아래 무음 판정에서 먼저 끊고, 쉬지 않고 길게 말할 때만 이 상한을 사용한다.
 */
const TARGET_SEGMENT_MS = 4000;
const MAX_SEGMENT_MS = 6000;

/** 이보다 짧은 소리는 말이 아니라 잡음으로 본다. */
const MIN_SEGMENT_MS = 400;

/**
 * 바닥 소음의 몇 배여야 말로 보는지.
 *
 * **더한 값이 아니라 곱한 값으로 본다.** 마이크 이득은 기기마다 열 배씩 차이 나서, 고정폭을
 * 더하는 방식은 조용한 기기에서는 지나치게 민감하고 시끄러운 기기에서는 말을 놓친다.
 */
const SPEECH_RATIO = 2.5;

/** 아무리 바닥이 낮아도 이보다 작으면 말이 아니다. */
const ABSOLUTE_SPEECH_FLOOR = 0.02;

/**
 * 바닥 소음을 좇는 속도. **시끄러울 때도 아주 조금씩은 올라가야 한다.**
 *
 * 예전에는 조용할 때만 갱신했다. 그런데 `getUserMedia` 는 기본으로 자동 이득(AGC)을 걸어
 * 조용한 소리를 끌어올리므로, 실내 암소음도 첫 문턱을 쉽게 넘는다. 그러면 시작부터 계속
 * "말하는 중"이 되고 바닥은 영영 갱신되지 않는다. 침묵을 한 번도 감지하지 못해 **모든 조각이
 * 최대 길이를 다 채우고, 그 안은 순수 암소음이라 모델이 가사 같은 헛소리를 지어냈다.**
 *
 * 올라가는 쪽을 느리게 두는 것은 말하는 도중에 기준이 따라 올라와 말을 잘라 먹지 않게 하기
 * 위해서다. 느려도 방향이 있으면 시끄러운 곳에서도 결국 스스로 다시 맞춘다.
 */
const NOISE_FLOOR_FALL_ALPHA = 0.05;
const NOISE_FLOOR_RISE_ALPHA = 0.002;

/** 짧은 충격음은 버리되 "네"처럼 짧은 대답은 살리는 최소 발화 감지 횟수(약 150ms). */
const MIN_LOUD_TICKS = 3;

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

  const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type));
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
  const audioTracks = stream.getAudioTracks();
  if (!mimeType || audioTracks.length === 0) return null;

  /**
   * **소리만 담긴 스트림을 따로 만들어 녹음한다.**
   *
   * 사용자 쪽 스트림에는 카메라도 함께 들어 있다. 그것을 오디오 전용 형식과 함께 넘기면
   * 브라우저에 따라 `NotSupportedError` 로 생성이 실패하거나, 영상까지 인코딩해 조각이 수 MB
   * 로 부푼다. 뒤쪽이 더 고약하다 — 서버의 크기 제한에 전부 걸려 **자막이 하나도 남지 않는데
   * 오류는 어디에도 뜨지 않는다.**
   */
  const audioOnlyStream = new MediaStream(audioTracks);

  // 아래 콜백들이 이미 이 값을 읽는다. 오디오 그래프를 세우기 전에 정해 둔다.
  let disposed = false;

  const AudioCtor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtor) return null;

  const audioContext = new AudioCtor();

  /**
   * 멈춰 있는 오디오 그래프를 깨운다.
   *
   * `suspended` 상태에서는 그래프가 돌지 않아 `getFloatTimeDomainData` 가 계속 0을 채운다.
   * 그러면 말소리를 영영 감지하지 못해 **녹음이 한 번도 시작되지 않는다** — 오류도 경고도
   * 없이 자막만 나오지 않는다. 지금 고치려는 증상과 똑같은 모양이라 특히 위험하다.
   *
   * 만들 때 한 번으로는 부족하다. 상담 도중 앱을 전환하거나 화면이 꺼지면 브라우저가 다시
   * 재우는데, 돌아와도 스스로 깨어나지는 않는다. 역에서 폰을 들고 안내받는 동안 흔한 일이다.
   */
  const resumeAudioContext = () => {
    if (disposed || audioContext.state !== 'suspended') return;
    void audioContext.resume().catch(() => undefined);
  };
  audioContext.addEventListener('statechange', resumeAudioContext);

  const source = audioContext.createMediaStreamSource(audioOnlyStream);
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;
  source.connect(analyser);
  resumeAudioContext();

  const samples = new Float32Array(analyser.fftSize);
  let noiseFloor = 0.01;

  let recorder: MediaRecorder | null = null;
  let chunks: Blob[] = [];
  let speaking = false;
  let segmentStartedAt = 0;
  let lastLoudAt = 0;
  /** 지금 조각에서 말소리로 본 횟수. 한 번 튄 충격음은 서버로 보내지 않는다. */
  let segmentLoudTicks = 0;

  /**
   * 이 조각을 올릴 만한지.
   *
   * 전체 조각 대비 비율을 사용하면 짧은 대답이 뒤의 무음에 희석되어 사라진다. 최소 150ms만
   * 발화로 감지되면 조각을 보내고, 실제 전사 가능 여부는 Whisper와 서버 필터가 판단한다.
   */
  const hasMinimumSpeech = () => segmentLoudTicks >= MIN_LOUD_TICKS;

  const setSpeaking = (next: boolean) => {
    if (speaking === next) return;
    speaking = next;
    onSpeakingChange?.(next);
  };

  const upload = async (blob: Blob) => {
    try {
      const response = await transcribeConsultationAudio(consultationId, {
        audio: blob,
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
      const instance = new MediaRecorder(audioOnlyStream, { mimeType, audioBitsPerSecond: 16000 });
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
      // 이 함수를 부른 현재 tick도 이미 loud 판정을 통과했다.
      segmentLoudTicks = 1;
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

    const threshold = Math.max(noiseFloor * SPEECH_RATIO, ABSOLUTE_SPEECH_FLOOR);
    const loud = level > threshold;

    /*
     * 바닥은 **양쪽으로** 움직인다. 조용하면 빨리 내려가고, 시끄러우면 아주 천천히 올라간다.
     *
     * 올라가는 길이 없으면 시끄러운 곳에서 한 번 기준을 넘긴 뒤로는 영영 "말하는 중"이 되어,
     * 침묵을 감지하지 못하고 모든 조각이 최대 길이를 다 채운다. 그 안은 순수 잡음이라 모델이
     * 헛소리를 지어낸다.
     */
    noiseFloor += (level - noiseFloor) * (loud ? NOISE_FLOOR_RISE_ALPHA : NOISE_FLOOR_FALL_ALPHA);

    if (recorder) {
      if (loud) segmentLoudTicks += 1;
    }

    if (loud) {
      lastLoudAt = now;
      setSpeaking(true);
      startSegment();
    }

    if (recorder) {
      const elapsed = now - segmentStartedAt;
      const silentFor = now - lastLoudAt;

      // 4초에는 바로 자르지 않고 단어 사이의 짧은 쉼을 기다린다. 쉼이 전혀 없으면 6초에 자른다.
      if (elapsed >= MAX_SEGMENT_MS) {
        // 여전히 말하는 중이어도 강제 상한에서는 보내 지연과 요청 크기를 제한한다.
        endSegment(hasMinimumSpeech());
        return;
      }
      const silenceRequired =
        elapsed >= TARGET_SEGMENT_MS ? TARGET_SEGMENT_SILENCE_MS : SILENCE_HOLD_MS;
      if (silentFor >= silenceRequired) {
        setSpeaking(false);
        // 역처럼 소음 바닥이 높은 곳에서는 끝 음량이 평균보다 크게 떨어지지 않는다.
        // 발화로 판단한 조각은 끝 모양으로 다시 버리지 않고 Whisper가 판별하게 한다.
        endSegment(elapsed >= MIN_SEGMENT_MS && hasMinimumSpeech());
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
      audioContext.removeEventListener('statechange', resumeAudioContext);
      try {
        source.disconnect();
        void audioContext.close();
      } catch {
        // 이미 닫혔으면 그대로 둔다.
      }
    },
  };
}
