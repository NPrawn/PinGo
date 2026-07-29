import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CONSULT_ISSUES, useConsultStore } from '@/entities/consult';
import { USER_ROUTES } from '@/shared/config';
import {
  BackLink,
  Button,
  Icon,
  Icon3d,
  Kicker,
  SelectRow,
  Sheet,
  Spring,
  Sub,
  Title,
} from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './ConsultRequestPage.module.css';

/** Screen 17 (FR-U-013) — choose what kind of help is needed. */
export function ConsultRequestPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const issue = useConsultStore((state) => state.issue);
  const selectIssue = useConsultStore((state) => state.selectIssue);
  const [reminderOpen, setReminderOpen] = useState(false);

  const submit = () => {
    if (issue == null) {
      setReminderOpen(true);
      return;
    }
    void navigate(USER_ROUTES.CONSULT_PERMISSION);
  };

  const goBack = () => {
    if (location.key === 'default') {
      void navigate(USER_ROUTES.STATION, { replace: true });
      return;
    }

    void navigate(-1);
  };

  return (
    <PhoneFrame>
      <div className={styles.topSpacer} />
      <BackLink onClick={goBack}>돌아가기</BackLink>

      <div className={styles.header}>
        <Icon3d name="headset" tone="lilac" iconSize={24} className={styles.headerIcon} />
        <div>
          <Kicker className={styles.kicker}>상담 요청</Kicker>
          <Title className={styles.title}>어떤 도움이 필요해요?</Title>
        </div>
      </div>
      <Sub className={styles.lede}>
        문제 유형을 선택하면 현재 역·위치·목적지가 상담원에게 자동으로 전달돼요.
      </Sub>

      <div className={styles.issues}>
        {CONSULT_ISSUES.map((option, index) => (
          <SelectRow
            key={option.label}
            className={styles.issue}
            selected={issue === index}
            onClick={() => selectIssue(index)}
          >
            <Icon3d
              name={option.icon}
              tone={option.tone}
              iconSize={17}
              className={styles.issueIcon}
            />
            <span className={styles.issueLabel}>{option.label}</span>
          </SelectRow>
        ))}
      </div>

      <Spring />
      <Button onClick={submit}>상담 요청하기</Button>

      {reminderOpen && (
        <Sheet
          placement="center"
          label="문제 유형을 선택해주세요"
          onDismiss={() => setReminderOpen(false)}
        >
          <div className={styles.panel}>
            <div className={styles.mark}>
              <Icon name="warning" size={28} />
            </div>
            <h2 className={styles.heading}>문제 유형을 선택해주세요</h2>
            <p className={styles.body}>
              상담원이 상황을 빠르게 파악할 수 있도록
              <br />
              <b>하나 이상의 문제 유형</b>을 선택한 뒤 요청해주세요.
            </p>
            <Button className={styles.confirm} onClick={() => setReminderOpen(false)}>
              확인
            </Button>
          </div>
        </Sheet>
      )}
    </PhoneFrame>
  );
}
