export { useConsultSignaling } from './model/useConsultSignaling';
export { useCaptionTranslation } from './model/useCaptionTranslation';
export { useTranslatedSpeech } from './model/useTranslatedSpeech';
export { DEMO_PHARMACY_DRAW_DELAY_MS } from './model/demoCaptions';
export { describeRemoteCaptionTrouble } from './model/captionTrouble';
export type { CaptionTrouble } from './model/captionTrouble';
export {
  captureConsultCamera,
  captureConsultMicrophone,
  composeConsultMedia,
  holdConsultCamera,
  holdConsultMedia,
  peekConsultCamera,
  releaseConsultMedia,
  /*
    `swapConsultVideoTrack` 은 더 이상 내보내지 않는다.

    트랙 교체는 `useConsultSignaling` 의 `replaceLocalVideoTrack` 하나로 들어간다 — 그 함수가
    연결과 맡겨 둔 스트림을 함께 바꾼다. 밖으로 열어 두면 한쪽만 바꾸는 길이 다시 생기고, 그때
    나타나는 증상("재연결하면 검은 화면")은 원인을 찾기 어렵다. (S15P11A206-89 리뷰)
  */
} from './model/consultMedia';
