/**
 * 항목 5·6 — 실시간 통화 지연(WebRTC)과 지터·패킷 손실을 측정한다(ITU-T G.114 기준).
 *
 * 상담 연결이 왜 느린지, 붙은 뒤 통화 품질이 괜찮은지를 콘솔에서 바로 확인하기 위한 것이다.
 * 정식 모니터링 지표로 서버에 쌓는 것은 별개 작업이고, 여기서는 상담 화면을 여는 사람이
 * 개발자 도구 콘솔만 열어도 바로 볼 수 있게 하는 것이 목적이다.
 */

const consultMarks: { label: string; t: number }[] = [];

/** 상담 연결 단계마다 시각을 남긴다. 연결이 끝나면 표로 정리해 콘솔에 찍는다. */
export function markConsultPhase(label: string) {
  // 배포 환경 사용자에게는 콘솔 로그를 보여주지 않는다. 개발 빌드에서만 기록한다.
  if (!import.meta.env.DEV) return;
  consultMarks.push({ label, t: performance.now() });
}

/**
 * 항목 1과 무관하게 "상담 수락 → 화면 공유 시작"까지 각 단계가 얼마나 걸렸는지를 표로 남긴다.
 *
 * ICE 서버 조회, signaling 소켓 open, 미디어 캡처, offer 전송, connected까지의 구간별 시간을
 * 한눈에 봐야 어디가 병목인지 알 수 있다. 합계만 봐서는 소켓이 늦게 열린 것인지, 마이크
 * 권한을 오래 기다린 것인지 구분할 수 없다.
 */
export function flushConsultPhaseReport() {
  if (!import.meta.env.DEV) return;
  if (consultMarks.length === 0) return;
  const start = consultMarks[0].t;
  console.table(
    consultMarks.map((m, i) => ({
      단계: m.label,
      '시작부터(ms)': Math.round(m.t - start),
      '직전 단계부터(ms)': i === 0 ? 0 : Math.round(m.t - consultMarks[i - 1].t),
    })),
  );
  consultMarks.length = 0;
}

/** 왕복 시간(RTT)을 편도 지연 목표(150·300·400ms)에 맞춰 등급으로 나눈다. */
function rttGrade(rttMs: number): string {
  const oneWay = rttMs / 2;
  if (oneWay <= 150) return '이상적';
  if (oneWay <= 300) return '자연스러움';
  if (oneWay <= 400) return '어색함 시작';
  return '나쁨';
}

/** 지터를 30ms 기준으로 나눈다. */
function jitterGrade(jitterMs: number): string {
  return jitterMs <= 30 ? '정상' : '주의';
}

/** 패킷 손실률(%)을 1%·3% 기준으로 나눈다. */
function lossGrade(lossPercent: number): string {
  if (lossPercent <= 1) return '정상';
  if (lossPercent <= 3) return '주의';
  return '나쁨(눈에 띄는 저하)';
}

/**
 * RTCPeerConnection의 연결 품질(RTT·지터·패킷 손실)을 주기적으로 콘솔에 남긴다.
 *
 * `peer.connectionState === 'connected'` 가 된 뒤에 시작해야 의미 있는 candidate-pair가
 * 잡혀 있다. 반환한 정리 함수는 연결이 끊기거나 화면을 나갈 때 반드시 불러야 한다 —
 * 그러지 않으면 상담이 끝난 뒤에도 타이머가 계속 돌며 이미 닫힌 peer의 getStats를 부른다.
 */
export function startRtcStatsMonitor(peer: RTCPeerConnection, intervalMs = 5000) {
  // 배포 환경 사용자에게는 콘솔 로그를 보여주지 않는다. 개발 빌드에서만 모니터를 켠다.
  if (!import.meta.env.DEV) return () => {};

  const timer = window.setInterval(async () => {
    if (peer.connectionState !== 'connected') return;
    const stats = await peer.getStats();
    stats.forEach((report) => {
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        const rtt = report.currentRoundTripTime;
        if (rtt !== undefined) {
          const rttMs = rtt * 1000;
          console.log(`[rtc] RTT ${Math.round(rttMs)}ms (편도 약 ${Math.round(rttMs / 2)}ms) · ${rttGrade(rttMs)}`);
        }
      }
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        const jitterMs = (report.jitter ?? 0) * 1000;
        const lossPercent =
          report.packetsLost && report.packetsReceived
            ? (report.packetsLost / (report.packetsLost + report.packetsReceived)) * 100
            : 0;
        console.log(
          `[rtc] jitter ${Math.round(jitterMs)}ms · ${jitterGrade(jitterMs)}, 손실률 ${lossPercent.toFixed(2)}% · ${lossGrade(lossPercent)}`,
        );
      }
    });
  }, intervalMs);
  return () => window.clearInterval(timer);
}
