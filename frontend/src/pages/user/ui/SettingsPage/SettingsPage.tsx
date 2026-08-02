import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { usePermissionStore } from '@/entities/permission';
import { useUserSessionStore } from '@/entities/user-session';
import { ConsultCta } from '@/features/consult-request';
import { PERMISSION_CATALOG } from '@/features/permission-request';
import { USER_ROUTES } from '@/shared/config';
import { deleteUserSession } from '@/shared/api';
import {
  BackLink,
  Button,
  Card,
  Kicker,
  PillButton,
  SelectRow,
  Sub,
  Title,
} from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './SettingsPage.module.css';

const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
];

const GRANTED_CHIP = { bg: '#d9f0df', fg: '#0f5a3e' };
const PENDING_CHIP = { bg: '#fff', fg: '#8b857a' };

/** Screen 24 (FR-U-016) — language and permissions. */
export function SettingsPage() {
  const { i18n } = useTranslation();
  const navigate = useNavigate();
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const clearSession = useUserSessionStore((state) => state.clearSession);
  const granted = usePermissionStore((state) => state.granted);
  const togglePermission = usePermissionStore((state) => state.toggle);

  return (
    <PhoneFrame>
      <div className={styles.topSpacer} />
      <BackLink to={USER_ROUTES.STATION}>홈으로</BackLink>
      <Title className={styles.title}>설정</Title>
      <Sub>언어와 권한을 언제든 바꿀 수 있어요.</Sub>

      <Kicker className={styles.sectionLabel}>언어</Kicker>
      <div className={styles.languages}>
        {LANGUAGES.map((language) => (
          <SelectRow
            key={language.code}
            className={styles.language}
            indicator="none"
            selected={i18n.language === language.code}
            onClick={() => void i18n.changeLanguage(language.code)}
          >
            {language.label}
          </SelectRow>
        ))}
      </div>

      <Kicker className={styles.sectionLabel}>권한</Kicker>
      <Card className={styles.list}>
        {PERMISSION_CATALOG.map((permission, index) => {
          const chip = granted[permission.key] ? GRANTED_CHIP : PENDING_CHIP;
          return (
            <div
              key={permission.key}
              className={[styles.row, index === PERMISSION_CATALOG.length - 1 && styles.rowLast]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.rowLabel}>{permission.short}</span>
              <PillButton
                on={granted[permission.key]}
                style={{ background: chip.bg, color: chip.fg, borderColor: chip.bg }}
                onClick={() => togglePermission(permission.key)}
              >
                허용
              </PillButton>
            </div>
          );
        })}
      </Card>

      <Kicker className={styles.sectionLabel}>도움이 필요하신가요?</Kicker>
      <ConsultCta size="sm" className={styles.consult} />
      <Button
        variant="secondary"
        onClick={() => {
          void (async () => {
            if (userSessionId) await deleteUserSession(userSessionId).catch(() => undefined);
            clearSession();
            navigate(USER_ROUTES.SPLASH, { replace: true });
          })();
        }}
      >
        현재 이용 세션 종료
      </Button>
    </PhoneFrame>
  );
}
