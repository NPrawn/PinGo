import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

type ConsultStore = {
  /** Index into `CONSULT_ISSUES`, or null before the user picks one. */
  issue: number | null;
  /** 1–5 star rating collected when the consultation ends. */
  satisfaction: number;
  consultationId: string | null;
  signalingRoomId: string | null;
  /** Signaling WebSocket handshake token issued with the room. */
  signalingAccessToken: string | null;
  /**
   * 상담을 시작한 화면의 경로. 상담이 끝나면 돌아갈 곳을 정한다. (S15P11A206-89)
   *
   * 경로 안내 중에 상담을 받은 사용자는 안내로 돌아가야 한다. 예전에는 어디서 시작했든 역
   * 선택 화면으로 보냈는데, 그러면 걷던 사람이 역 고르기부터 목적지 고르기까지 다시 밟아야
   * 했다. 상담은 안내를 잠시 멈춘 것이지 처음으로 되돌린 것이 아니다.
   *
   * 상담 CTA 가 눌린 자리를 담는다. CTA 를 거치지 않고 상담 화면에 닿은 경우는 null 이며
   * 그때는 역 선택으로 간다 — 돌아갈 자리를 모르는 채 안내 화면으로 보내면 목적지도 경로도
   * 없는 빈 안내가 뜬다.
   */
  entryRoute: string | null;
  selectIssue: (index: number) => void;
  rate: (score: number) => void;
  setConsultation: (consultationId: string) => void;
  setSignalingRoom: (signalingRoomId: string, signalingAccessToken?: string | null) => void;
  /** 상담을 시작한 화면을 기록한다. 상담 CTA 가 부른다. */
  setEntryRoute: (entryRoute: string) => void;
  /** 진행 중인 상담 정보만 비운다. 선택한 문의 유형은 유지한다. */
  clearConsultation: () => void;
  reset: () => void;
};

/**
 * The user's consultation request.
 *
 * Crosses pages: the request screen picks the issue, the permission and waiting
 * screens carry it, and the end screen records satisfaction.
 *
 * The prototype reused its `landmark` field for the issue type, which coupled
 * the consult flow to the location-recognition flow; they are separate here.
 */
export const useConsultStore = create<ConsultStore>()(
  persist(
    (set) => ({
      issue: null,
      satisfaction: 0,
      consultationId: null,
      signalingRoomId: null,
      signalingAccessToken: null,
      entryRoute: null,
      selectIssue: (issue) => set({ issue }),
      rate: (satisfaction) => set({ satisfaction }),
      /**
       * satisfaction도 함께 비운다.
       *
       * 이전 상담에서 매긴 별점이 여기 그대로 남아 있으면, 이번 상담이 끝났을 때 아직
       * 아무것도 누르지 않았는데도 종료 화면에 그 별점이 채워진 채로 보인다. 이 값을 지울
       * 유일한 다른 통로인 `reset()`은 실제 코드 어디에서도 불리지 않는다.
       */
      setConsultation: (consultationId) => set({ consultationId, satisfaction: 0 }),
      setSignalingRoom: (signalingRoomId, signalingAccessToken = null) =>
        set({ signalingRoomId, signalingAccessToken }),
      setEntryRoute: (entryRoute) => set({ entryRoute }),
      /**
       * 진입 지점도 함께 비운다.
       *
       * 남겨 두면 다음 상담이 CTA 를 거치지 않고 시작됐을 때 지난 상담의 자리로 돌아간다.
       * 종료 화면은 이 값을 마운트 시점에 자기 상태로 붙잡으므로 여기서 비워도 늦지 않다.
       */
      clearConsultation: () =>
        set({
          consultationId: null,
          signalingRoomId: null,
          signalingAccessToken: null,
          entryRoute: null,
        }),
      reset: () =>
        set({
          issue: null,
          satisfaction: 0,
          consultationId: null,
          signalingRoomId: null,
          signalingAccessToken: null,
          entryRoute: null,
        }),
    }),
    {
      name: 'pingo.consult',
      storage: createJSONStorage(() => sessionStorage),
      // signaling 토큰은 10분이면 만료된다. 새로고침 뒤에 만료된 토큰으로 접속하면
      // 서버가 handshake를 거절하므로, 저장하지 않고 상담 화면에서 다시 받는다.
      partialize: (state) => ({
        issue: state.issue,
        satisfaction: state.satisfaction,
        consultationId: state.consultationId,
        signalingRoomId: state.signalingRoomId,
        /* 상담 중 새로고침해도 돌아갈 자리를 잃지 않아야 한다. */
        entryRoute: state.entryRoute,
      }),
    },
  ),
);
