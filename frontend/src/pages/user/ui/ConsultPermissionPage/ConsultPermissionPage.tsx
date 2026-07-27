import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissionStore } from '@/entities/permission';
import { USER_ROUTES } from '@/shared/config';
import {
  BackLink,
  Button,
  GhostButton,
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

/** Screen 18 (FR-U-013) — consent to share camera and microphone. */
export function ConsultPermissionPage() {
  const navigate = useNavigate();
  const granted = usePermissionStore((state) => state.granted);
  const toggle = usePermissionStore((state) => state.toggle);
  const grant = usePermissionStore((state) => state.grant);
  const hasAll = usePermissionStore((state) => state.hasAll);
  const [reminderOpen, setReminderOpen] = useState(false);

  const connect = () => {
    if (hasAll('cam', 'mic')) {
      void navigate(USER_ROUTES.CONSULT_WAITING);
      return;
    }
    setReminderOpen(true);
  };

  const allowAll = () => {
    grant('cam', 'mic');
    setReminderOpen(false);
    void navigate(USER_ROUTES.CONSULT_WAITING);
  };

  return (
    <PhoneFrame>
      <div className={styles.topSpacer} />
      <BackLink to={USER_ROUTES.CONSULT_REQUEST}>문제 유형 다시 선택</BackLink>

      <div className={styles.header}>
        <Icon3d name="headset" tone="lilac" iconSize={24} className={styles.headerIcon} />
        <div>
          <Kicker className={styles.kicker}>상담 연결 준비</Kicker>
          <Title className={styles.title}>
            화면·음성 공유가
            <br />
            필요해요
          </Title>
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
      <Button onClick={connect}>동의하고 상담 연결</Button>

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
            <GhostButton className={styles.secondary} onClick={() => setReminderOpen(false)}>
              직접 선택할게요
            </GhostButton>
          </div>
        </Sheet>
      )}
    </PhoneFrame>
  );
}
