import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useNavigationStore } from '@/entities/navigation';
import { useStationStore } from '@/entities/station';
import { ensureUserSession, useUserSessionStore } from '@/entities/user-session';
import {
  canShareConsultScreen,
  captureConsultCamera,
  captureConsultMedia,
  holdConsultCamera,
  holdConsultMedia,
  releaseConsultMedia,
} from '@/features/consult-signaling';
import { ApiError, createConsultation } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import {
  BackLink,
  Button,
  Icon,
  Icon3d,
  Kicker,
  Pill,
  SelectRow,
  Sheet,
  Spring,
  Sub,
  Title,
} from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ConsultPermissionPage.module.css';

const SHARES = [
  {
    key: 'cam',
    icon: 'camera',
    tone: 'coral',
    name: '화면 공유',
    desc: '상담원이 보고 있는 화면을 함께 봐요',
    short: '화면',
  },
  {
    key: 'mic',
    icon: 'mic',
    tone: 'lilac',
    name: '마이크 공유',
    desc: '음성으로 대화할 수 있어요',
    short: '마이크',
  },
] as const;

const GRANTED_CHIP = { bg: '#d9f0df', fg: '#0f5a3e' };
const PENDING_CHIP = { bg: '#fff', fg: '#8b857a' };

const PROBLEM_TYPES = [
  'CANNOT_FIND_LOCATION',
  'CANNOT_FIND_EXIT',
  'WRONG_DIRECTION',
  'OTHER',
] as const;

/** Screen 18 (FR-U-013) — consent to share camera and microphone. */
export function ConsultPermissionPage() {
  const navigate = useNavigate();
  const { i18n } = useTranslation();
  const issue = useConsultStore((state) => state.issue);
  const setConsultation = useConsultStore((state) => state.setConsultation);
  const stationId = useStationStore((state) => state.stationId);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const currentNodeId = useNavigationStore((state) => state.currentNodeId);
  const destinationId = useNavigationStore((state) => state.destinationId);
  const destinationType = useNavigationStore((state) => state.destinationType);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [requestingPermissions, setRequestingPermissions] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [preparingSession, setPreparingSession] = useState(false);
  /**
   * 이 화면에서 실제로 확보한 공유 대상.
   *
   * 온보딩에서 받은 카메라·마이크 권한(`usePermissionStore`)과는 다른 것이다. 그쪽을 그대로
   * 읽었더니 사용자가 아직 아무것도 동의하지 않았는데 두 줄에 초록 체크가 먼저 켜져 있었다.
   * 여기서 묻는 것은 "이 상담에 화면과 목소리를 넘기겠는가"라, 앞 화면의 답으로 대신할 수 없다.
   */
  const [shared, setShared] = useState({ cam: false, mic: false });

  /** 자동 준비가 실패했을 때 사용자가 직접 다시 시도하는 경로. */
  const prepareSession = async () => {
    setPreparingSession(true);
    setErrorMessage('');
    const ready = await ensureUserSession(i18n.language);
    setPreparingSession(false);
    if (!ready) setErrorMessage('상담 연결을 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.');
  };

  useEffect(() => {
    if (issue == null) {
      void navigate(USER_ROUTES.CONSULT_REQUEST, { replace: true });
    }
  }, [issue, navigate]);

  const requestConsultation = async () => {
    if (issue == null) {
      void navigate(USER_ROUTES.CONSULT_REQUEST, { replace: true });
      return;
    }
    if (!userSessionId) {
      return;
    }
    // 상담은 역 단위로 배정된다. 등록되지 않은 역이면 보낼 상담자가 없다.
    if (stationId == null) {
      setErrorMessage('이 역은 아직 상담을 지원하지 않습니다.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const completeDestination =
        destinationId != null && destinationType ? { destinationId, destinationType } : {};
      const consultation = await createConsultation({
        userSessionId,
        stationId,
        problemType: PROBLEM_TYPES[issue],
        currentNodeId: currentNodeId ?? undefined,
        ...completeDestination,
        videoConsent: true,
        audioConsent: true,
      });

      if (!consultation.consultationId) {
        throw new Error('상담 요청 ID가 없습니다.');
      }
      setConsultation(consultation.consultationId);
      void navigate(USER_ROUTES.CONSULT_WAITING);
    } catch (error) {
      // 상담으로 이어지지 못했으니 잡아 둔 화면·마이크를 놓아 준다.
      releaseConsultMedia();
      setErrorMessage(
        error instanceof ApiError && error.code === 'CONSULTATION_ALREADY_IN_PROGRESS'
          ? '이미 진행 중인 상담이 있습니다.'
          : '상담 요청을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.',
      );
    } finally {
      setSubmitting(false);
    }
  };

  const verifyPermissionsAndConnect = async () => {
    if (requestingPermissions || submitting) return;

    /*
      거절한 것과 애초에 할 수 없는 것을 구분한다.

      모바일 브라우저에는 화면 공유가 없다. 그 사실을 "동의해주세요"라고 말하면 사용자는
      허용할 것이 없는 설정을 뒤지다 끝난다.
    */
    if (!canShareConsultScreen()) {
      setErrorMessage('이 기기의 브라우저는 화면 공유를 지원하지 않아요.');
      return;
    }

    setRequestingPermissions(true);
    setErrorMessage('');
    try {
      /**
       * 화면 선택 창을 여기서 연다.
       *
       * 브라우저는 사용자가 버튼을 누른 직후에만 이 창을 열어 준다. 상담이 연결된 뒤로
       * 미루면 조작 흔적이 사라져 거절되고, 사용자는 대기 화면만 보게 된다. 잡아 둔
       * 스트림은 상담 화면이 그대로 이어받아 곧바로 상담자에게 보낸다.
       */
      const display = await captureConsultMedia();
      holdConsultMedia(display);

      /**
       * 카메라도 여기서 함께 잡는다.
       *
       * 예전에는 잡지도 않고 `cam: true`로 기록만 해 두어, 상담 화면에 카메라가 켜진 적이
       * 없는데도 권한이 허용된 것처럼 보였다. 카메라는 상담자에게 따로 보내지 않고 사용자
       * 화면 위 셀프뷰로 띄운다 — 화면 전체가 공유 대상이라 그 안에 담겨 함께 건너간다.
       *
       * 카메라를 거절해도 상담은 이어 간다. 길 안내에 꼭 필요한 것은 화면과 목소리다.
       */
      const camera = await captureConsultCamera().catch(() => null);
      if (camera) holdConsultCamera(camera);

      /*
        전역 권한 상태는 건드리지 않는다. 여기서 확보한 것은 이 상담에 넘길 화면과 목소리이지
        브라우저가 준 카메라·마이크 권한이 아니다. 그 둘을 같은 자리에 쓰면 화면 공유를 한 번
        거절한 것이 설정 화면에 "카메라 권한 없음"으로 남는다.
      */
      setShared({ cam: true, mic: display.getAudioTracks().length > 0 });

      setReminderOpen(false);
      await requestConsultation();
    } catch {
      setShared({ cam: false, mic: false });
      setErrorMessage('화면 공유와 마이크를 모두 허용해 주세요.');
      setReminderOpen(true);
    } finally {
      setRequestingPermissions(false);
    }
  };

  return (
    <PhoneFrame>
      <div className={styles.topSpacer} />
      <BackLink to={USER_ROUTES.CONSULT_REQUEST}>문제 유형 다시 선택</BackLink>

      <div className={styles.header}>
        <Icon3d name="headset" tone="lilac" iconSize={24} className={styles.headerIcon} />
        <div>
          <Kicker className={styles.kicker}>상담 연결 준비</Kicker>
          <Title className={styles.title}>화면·음성을 공유해요</Title>
        </div>
      </div>
      <Sub className={styles.lede}>
        상담원이 실시간으로 현재 상황을 보고 안내할 수 있도록 아래 공유에 동의해 주세요.
      </Sub>

      <div className={styles.options}>
        {SHARES.map((share) => (
          <SelectRow key={share.key} selected={shared[share.key]} disabled>
            <Icon3d name={share.icon} tone={share.tone} />
            <span className={styles.labels}>
              <b className={styles.name}>{share.name}</b>
              <br />
              <span className={styles.desc}>{share.desc}</span>
            </span>
          </SelectRow>
        ))}
      </div>

      <Spring />
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {/* 세션 준비가 실패해도 버튼이 잠기지 않게, 준비를 다시 시도하는 버튼으로 바꾼다. */}
      <Button
        onClick={() => (userSessionId ? void verifyPermissionsAndConnect() : void prepareSession())}
        disabled={preparingSession || requestingPermissions || submitting}
      >
        {!userSessionId
          ? preparingSession
            ? '상담 연결 준비 중…'
            : '상담 연결 준비하기'
          : requestingPermissions
            ? '권한 확인 중…'
            : submitting
              ? '요청 중…'
              : '동의하고 상담 연결'}
      </Button>

      {reminderOpen && (
        <Sheet
          placement="center"
          label="화면·음성 공유가 필요해요"
          onDismiss={() => setReminderOpen(false)}
        >
          <div className={styles.panel}>
            <div className={styles.mark}>
              <Icon name="warning" size={28} />
            </div>
            <h2 className={styles.heading}>화면·음성 공유가 필요해요</h2>
            <p className={styles.body}>
              상담원이 주변 상황을 확인하고
              <br />
              안내할 수 있도록 카메라와 마이크에
              <br />
              <b>모두 동의해주세요.</b>
            </p>
            <div className={styles.chips}>
              {SHARES.map((share) => {
                const chip = shared[share.key] ? GRANTED_CHIP : PENDING_CHIP;
                return (
                  <Pill
                    key={share.key}
                    style={{ background: chip.bg, color: chip.fg, borderColor: chip.bg }}
                  >
                    <Icon name={share.icon} size={14} />
                    {share.short}
                  </Pill>
                );
              })}
            </div>
            <Button
              className={styles.primary}
              onClick={() => void verifyPermissionsAndConnect()}
              disabled={!userSessionId || requestingPermissions || submitting}
            >
              {!userSessionId
                ? '상담 연결 준비 중…'
                : requestingPermissions
                  ? '권한 확인 중…'
                  : '모두 동의하고 연결'}
            </Button>
          </div>
        </Sheet>
      )}
    </PhoneFrame>
  );
}
