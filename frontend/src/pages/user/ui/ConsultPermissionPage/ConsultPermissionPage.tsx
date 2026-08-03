import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useNavigationStore } from '@/entities/navigation';
import { usePermissionStore } from '@/entities/permission';
import { useStationStore } from '@/entities/station';
import { ensureUserSession, useUserSessionStore } from '@/entities/user-session';
import {
  captureConsultCamera,
  captureConsultMicrophone,
  composeConsultMedia,
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
  Sheet,
  Spring,
  Sub,
  Title,
  Toggle,
} from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ConsultPermissionPage.module.css';

/**
 * 상담자에게 건너가는 것들.
 *
 * 브라우저 권한과는 다른 이야기다. 권한은 이 앱이 장치를 쓸 수 있는가이고, 여기서 묻는 것은
 * 그렇게 얻은 것을 **상담자에게 넘겨도 되는가**다. 브라우저는 이걸 묻지 않으므로 앱이 받아야
 * 한다(비기능_요구사항_명세서 NFR-PR-001).
 *
 * `required`가 아닌 항목만 사용자가 끌 수 있다. 음성 없이는 상담이 성립하지 않고, 위치 없이는
 * 상담자 지도가 빈 화면이라 안내할 수단이 없다. 카메라는 FR-U-015가 "영상 **또는** 음성"을
 * 요구하므로 없어도 상담이 성립한다 — 그래서 여기만 진짜 선택지다.
 *
 * 화면 공유는 없다. `getDisplayMedia`는 데스크톱 브라우저에만 있어 이 서비스가 상대하는
 * 모바일 기기에서는 부를 수조차 없다. 줄 수 없는 것을 필수로 적어 두면 사용자는 허용할 것이
 * 없는 설정을 뒤지다 끝난다. 상담자가 보는 지도는 MAP_SYNC 로 따로 건너가 상담자 화면이
 * 직접 다시 그린다.
 */
const SHARES = [
  {
    key: 'mic',
    icon: 'mic',
    tone: 'lilac',
    name: '음성',
    desc: '상담원과 대화할 수 있어요',
    short: '음성',
    required: true,
  },
  {
    key: 'location',
    icon: 'pin',
    tone: 'mint',
    name: '현재 위치',
    desc: '상담원 지도에 내 위치와 경로가 표시돼요',
    short: '위치',
    required: true,
  },
  {
    key: 'cam',
    icon: 'camera',
    tone: 'sky',
    name: '카메라',
    desc: '상담원이 눈앞 상황을 함께 봐요',
    short: '카메라',
    required: false,
  },
] as const;

/**
 * 브라우저에서 실제로 확보해야 하는 항목.
 *
 * 위치는 빠진다. 요청해서 받아 오는 것이 아니라 이미 갖고 있는 값을 상담자에게 함께 보내는
 * 것이라, 확보에 성공했는지 따질 대상이 아니다.
 */
const CAPTURED_SHARES = SHARES.filter((share) => share.key !== 'location');

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
  const locationConsent = usePermissionStore((state) => state.granted.loc);
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
   * 여기서 묻는 것은 "이 상담에 목소리와 눈앞 상황을 넘기겠는가"라, 앞 화면의 답으로 대신할
   * 수 없다.
   */
  const [shared, setShared] = useState({ mic: false, cam: false });
  /**
   * 카메라를 함께 넘길지. 유일하게 사용자가 정하는 항목이다.
   *
   * 기본은 켜 둔다. 상담자가 눈앞 상황을 보며 안내하는 것이 이 서비스가 그리는 흐름이라,
   * 끄는 쪽을 기본으로 두면 대부분의 상담이 의도와 다르게 시작된다.
   */
  const [cameraConsent, setCameraConsent] = useState(true);

  useEffect(() => {
    if (issue == null) {
      void navigate(USER_ROUTES.CONSULT_REQUEST, { replace: true });
    }
  }, [issue, navigate]);

  const requestConsultation = async (
    readyUserSessionId = userSessionId,
    videoConsent = cameraConsent,
  ) => {
    if (issue == null) {
      void navigate(USER_ROUTES.CONSULT_REQUEST, { replace: true });
      return;
    }
    if (!readyUserSessionId) {
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
        userSessionId: readyUserSessionId,
        stationId,
        problemType: PROBLEM_TYPES[issue],
        currentNodeId: currentNodeId ?? undefined,
        ...completeDestination,
        /*
          카메라는 사용자의 선택과 실제 확보 결과를 그대로 보낸다. 예전에는
          `videoConsent: true`로 박아 두어 카메라를 끈 사용자도 동의한 것으로 기록됐다.

          마이크는 상담에 필요한 필수 항목이라 선택 UI가 없고, 요청 시점에는 확보가 끝난
          상태이므로 `audioConsent: true`로 기록한다.

          위치 공유 동의는 온보딩에서 확인한 브라우저 권한 상태를 함께 기록한다.
        */
        videoConsent,
        audioConsent: true,
        locationConsent,
      });

      if (!consultation.consultationId) {
        throw new Error('상담 요청 ID가 없습니다.');
      }
      setConsultation(consultation.consultationId);
      void navigate(USER_ROUTES.CONSULT_WAITING);
    } catch (error) {
      // 상담으로 이어지지 못했으니 잡아 둔 카메라·마이크를 놓아 준다.
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

  const verifyPermissionsAndConnect = async (readyUserSessionId = userSessionId) => {
    if (requestingPermissions || submitting) return;

    setRequestingPermissions(true);
    setErrorMessage('');
    try {
      /**
       * 장치를 여기서 잡아 둔다.
       *
       * 상담이 연결된 뒤로 미루면 협상이 먼저 끝나 트랙 없는 연결이 맺어지고, 상담자 쪽에
       * 영상과 소리가 한참 동안 뜨지 않는다. 잡아 둔 스트림은 상담 화면이 그대로 이어받는다.
       *
       * 마이크가 먼저다. 목소리가 오가지 않으면 상담이 성립하지 않아, 여기서 실패하면 아래로
       * 내려가지 않는다.
       */
      const microphone = await captureConsultMicrophone();

      /**
       * 카메라는 사용자가 켜 두었을 때만 잡는다.
       *
       * 끄기로 했는데 잡아 두면 표시등만 켜진 채 아무 데도 쓰이지 않는다. 동의하지 않은
       * 장치를 여는 셈이라 문구와 실제 동작이 어긋난다.
       *
       * 켜 두었더라도 확보에 실패하면 상담은 그대로 이어 간다(FR-U-015 는 영상 **또는**
       * 음성을 요구한다). 상담자는 눈앞 상황 대신 MAP_SYNC 로 그린 지도만 보고 안내한다.
       */
      const camera = cameraConsent ? await captureConsultCamera().catch(() => null) : null;
      holdConsultMedia(composeConsultMedia(microphone, camera));
      // 셀프뷰가 읽을 자리에도 같은 카메라를 둔다. 보내는 영상과 어긋나지 않는다.
      if (camera) holdConsultCamera(camera);

      /*
        전역 권한 상태는 건드리지 않는다. 여기서 확보한 것은 이 상담에 넘길 목소리와 영상이지
        브라우저가 준 카메라·마이크 권한이 아니다. 그 둘을 같은 자리에 쓰면 이 화면에서 한 번
        실패한 것이 설정 화면에 "카메라 권한 없음"으로 남는다.
      */
      setShared({ mic: microphone.getAudioTracks().length > 0, cam: camera !== null });

      setReminderOpen(false);
      // 실제로 확보한 영상만 동의한 것으로 기록한다. 켜 두었어도 실패했으면 보내지 않는다.
      await requestConsultation(readyUserSessionId, camera !== null);
    } catch {
      setShared({ mic: false, cam: false });
      setErrorMessage('상담하려면 마이크를 허용해 주세요.');
      setReminderOpen(true);
    } finally {
      setRequestingPermissions(false);
    }
  };

  /** 세션이 없거나 백엔드가 잠시 끊겼어도 한 번의 클릭으로 준비부터 권한 요청까지 잇는다. */
  const prepareAndConnect = async () => {
    if (preparingSession || requestingPermissions || submitting) return;

    let readyUserSessionId = userSessionId;
    if (!readyUserSessionId) {
      setPreparingSession(true);
      setErrorMessage('');
      readyUserSessionId = await ensureUserSession(i18n.language);
      setPreparingSession(false);
    }

    if (!readyUserSessionId) {
      setErrorMessage('상담 연결을 준비하지 못했습니다. 백엔드 연결을 확인한 뒤 다시 시도해 주세요.');
      return;
    }

    await verifyPermissionsAndConnect(readyUserSessionId);
  };

  return (
    <PhoneFrame>
      <div className={styles.topSpacer} />
      <BackLink to={USER_ROUTES.CONSULT_REQUEST}>문제 유형 다시 선택</BackLink>

      <div className={styles.header}>
        <Icon3d name="headset" tone="lilac" iconSize={24} className={styles.headerIcon} />
        <div>
          <Kicker className={styles.kicker}>상담 연결 준비</Kicker>
          <Title className={styles.title}>무엇을 공유할지 정해주세요</Title>
        </div>
      </div>
      <Sub className={styles.lede}>
        상담원이 실시간으로 현재 상황을 보고 안내할 수 있도록 아래 항목이 전달돼요.
      </Sub>

      <div className={styles.options}>
        {SHARES.map((share) =>
          /*
            필수 항목은 끌 수 없으므로 스위치를 두지 않는다. 해제할 수 없는 것에 스위치를
            달면 고르는 시늉만 하게 되고, 사용자는 껐다고 믿은 항목이 그대로 전달되는 것을
            나중에 알게 된다. 대신 무엇이 왜 필요한지 적는다.
          */
          share.required ? (
            <div key={share.key} className={styles.option}>
              <Icon3d name={share.icon} tone={share.tone} />
              <span className={styles.labels}>
                <b className={styles.name}>{share.name}</b>
                <br />
                <span className={styles.desc}>{share.desc}</span>
              </span>
              <Pill className={styles.requiredMark}>필수</Pill>
            </div>
          ) : (
            <div key={share.key} className={styles.option}>
              <Icon3d name={share.icon} tone={share.tone} />
              <span className={styles.labels}>
                <b className={styles.name}>{share.name}</b>
                <br />
                <span className={styles.desc}>{share.desc}</span>
              </span>
              <Toggle
                checked={cameraConsent}
                onCheckedChange={setCameraConsent}
                label={`${share.name} 공유`}
              />
            </div>
          ),
        )}
      </div>

      {/* 저장 정책을 동의 시점에 알린다(비기능_요구사항_명세서 NFR-PR-002). */}
      <Sub className={styles.retention}>상담 영상과 음성은 저장하지 않아요.</Sub>

      <Spring />
      {errorMessage && <p role="alert">{errorMessage}</p>}
      {/* 세션 준비가 실패해도 버튼이 잠기지 않게, 준비를 다시 시도하는 버튼으로 바꾼다. */}
      <Button
        onClick={() => void prepareAndConnect()}
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
          label="음성 공유가 필요해요"
          onDismiss={() => setReminderOpen(false)}
        >
          <div className={styles.panel}>
            <div className={styles.mark}>
              <Icon name="warning" size={28} />
            </div>
            <h2 className={styles.heading}>음성 공유가 필요해요</h2>
            <p className={styles.body}>
              상담원과 이야기하려면
              <br />
              <b>마이크를 허용해주세요.</b>
            </p>
            {/* 위치는 여기 없다. 브라우저에 요청해 확보하는 것이 아니라 늘 함께 가는 값이다. */}
            <div className={styles.chips}>
              {CAPTURED_SHARES.map((share) => {
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
