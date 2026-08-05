import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router-dom';
import { CONSULT_ISSUES, useConsultStore } from '@/entities/consult';
import { USER_ROUTES } from '@/shared/config';
import {
  BackLink,
  Blob,
  BlobHero,
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
import { useWithdrawAbandonedConsultation } from '../../lib/useWithdrawAbandonedConsultation';
import styles from './ConsultRequestPage.module.css';

/** Screen 17 (FR-U-013) — choose what kind of help is needed. */
export function ConsultRequestPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  /* 대기 화면에서 뒤로가기로 두 칸 되돌아온 경우, 남은 상담을 여기서 거둬들인다. */
  useWithdrawAbandonedConsultation();
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
      <BackLink onClick={goBack}>{t('user.consultRequest.back')}</BackLink>

      <div className={styles.header}>
        <Icon3d name="headset" tone="lilac" iconSize={24} className={styles.headerIcon} />
        <div>
          <Kicker className={styles.kicker}>{t('user.consultRequest.kicker')}</Kicker>
          <Title className={styles.title}>{t('user.consultRequest.title')}</Title>
        </div>
      </div>
      <Sub className={styles.lede}>
        {t('user.consultRequest.description')}
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
            <span className={styles.issueLabel}>{t(`user.consultRequest.issue${index + 1}`)}</span>
          </SelectRow>
        ))}
      </div>

      <Spring />
      <Button onClick={submit}>{t('user.consultRequest.submit')}</Button>

      {reminderOpen && (
        <Sheet
          placement="center"
          label={t('user.consultRequest.reminderTitle')}
          onDismiss={() => setReminderOpen(false)}
        >
          <BlobHero className={styles.warningHero}>
            <Blob tone="coral" slot="main" style={{ width: 76, height: 76 }} />
            <Blob
              tone="lilac"
              slot="a"
              style={{ top: '6%', right: '26%', width: 26, height: 26 }}
            />
            <Blob
              tone="sky"
              slot="c"
              style={{ bottom: '10%', left: '26%', width: 20, height: 20 }}
            />
            <div className={styles.warningHeroIcon}>
              <Icon name="warning" size={28} />
            </div>
          </BlobHero>
          <h2 className={styles.heading}>{t('user.consultRequest.reminderTitle')}</h2>
          <p className={styles.reminderBody}>{t('user.consultRequest.reminderBody')}</p>
          <Button className={styles.confirm} onClick={() => setReminderOpen(false)}>
            {t('user.consultRequest.confirm')}
          </Button>
        </Sheet>
      )}
    </PhoneFrame>
  );
}
