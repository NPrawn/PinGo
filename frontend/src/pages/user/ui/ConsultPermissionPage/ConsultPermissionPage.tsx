import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useConsultStore } from '@/entities/consult';
import { useNavigationStore } from '@/entities/navigation';
import { usePermissionStore } from '@/entities/permission';
import { useStationStore } from '@/entities/station';
import { useUserSessionStore } from '@/entities/user-session';
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
  const granted = usePermissionStore((state) => state.granted);
  const toggle = usePermissionStore((state) => state.toggle);
  const grant = usePermissionStore((state) => state.grant);
  const hasAll = usePermissionStore((state) => state.hasAll);
  const issue = useConsultStore((state) => state.issue);
  const setConsultation = useConsultStore((state) => state.setConsultation);
  const stationId = useStationStore((state) => state.stationId);
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const destinationId = useNavigationStore((state) => state.destinationId);
  const destinationType = useNavigationStore((state) => state.destinationType);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const requestConsultation = async () => {
    if (!userSessionId || issue == null) {
      setErrorMessage('사용자 세션 또는 상담 유형을 확인해 주세요.');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');
    try {
      const consultation = await createConsultation({
        userSessionId,
        stationId,
        problemType: PROBLEM_TYPES[issue],
        destinationId: destinationId ?? undefined,
        destinationType: destinationType ?? undefined,
        videoConsent: true,
        audioConsent: true,
      });

      if (!consultation.consultationId) {
        throw new Error('상담 요청 ID가 없습니다.');
      }
      setConsultation(consultation.consultationId);
      void navigate(USER_ROUTES.CONSULT_WAITING);
    } catch (error) {
      setErrorMessage(error instanceof ApiError ? error.message : '상담 요청을 보내지 못했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const connect = () => {
    if (hasAll('cam', 'mic')) {
      void requestConsultation();
      return;
    }
    setReminderOpen(true);
  };

  const allowAll = () => {
    grant('cam', 'mic');
    setReminderOpen(false);
    void requestConsultation();
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
          <SelectRow
            key={share.key}
            selected={granted[share.key]}
            onClick={() => toggle(share.key)}
          >
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
      <Button onClick={connect} disabled={submitting}>
        {submitting ? '요청 중…' : '동의하고 상담 연결'}
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
            <Button className={styles.primary} onClick={allowAll}>
              모두 동의하고 연결
            </Button>
          </div>
        </Sheet>
      )}
    </PhoneFrame>
  );
}
