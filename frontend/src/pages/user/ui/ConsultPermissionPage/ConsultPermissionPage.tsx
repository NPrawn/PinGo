import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useNavigationStore } from '@/entities/navigation';
import { usePermissionStore } from '@/entities/permission';
import { useStationStore } from '@/entities/station';
import { ensureUserSession, useUserSessionStore } from '@/entities/user-session';
import { requestMediaPermissions, stopMediaStream } from '@/features/permissions';
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
    name: '카메라 화면 공유',
    desc: '상담원이 주변 환경을 함께 봐요',
    short: '카메라',
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
  const granted = usePermissionStore((state) => state.granted);
  const syncPermissions = usePermissionStore((state) => state.sync);
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

    setRequestingPermissions(true);
    setErrorMessage('');
    try {
      const result = await requestMediaPermissions();
      stopMediaStream(result.stream);

      const cameraGranted = result.camera.status === 'granted';
      const microphoneGranted = result.microphone.status === 'granted';
      syncPermissions({
        loc: granted.loc,
        cam: cameraGranted,
        mic: microphoneGranted,
      });

      if (!cameraGranted || !microphoneGranted) {
        setErrorMessage('카메라와 마이크 권한을 모두 허용해 주세요.');
        setReminderOpen(true);
        return;
      }

      setReminderOpen(false);
      await requestConsultation();
    } catch {
      setErrorMessage('카메라와 마이크 권한을 확인하지 못했습니다.');
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
          <SelectRow key={share.key} selected={granted[share.key]} disabled>
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
                const chip = granted[share.key] ? GRANTED_CHIP : PENDING_CHIP;
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
