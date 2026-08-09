import { useTranslation } from 'react-i18next';
import { useUserSessionStore } from '@/entities/user-session';
import { ConsultCta } from '@/features/consult-request';
import { PERMISSION_CATALOG } from '@/features/permission-request';
import { useBrowserPermissionStates } from '@/features/permissions';
import type { BrowserPermissionState } from '@/features/permissions';
import { updateUserSession } from '@/shared/api';
import { USER_ROUTES } from '@/shared/config';
import { BackLink, Card, Kicker, Pill, SelectRow, Sub, Title } from '@/shared/ui';
import { PhoneFrame } from '@/widgets/phone-frame';
import styles from './SettingsPage.module.css';

const LANGUAGES = [
  { code: 'ko', label: '한국어' },
  { code: 'en', label: 'English' },
];

const GRANTED_CHIP = { bg: '#d9f0df', fg: '#0f5a3e' };
const PENDING_CHIP = { bg: '#fff', fg: '#8b857a' };
const BLOCKED_CHIP = { bg: '#fdeaea', fg: '#a33a3a' };

/**
 * 브라우저 권한 상태를 사용자가 읽을 문구로 옮긴다.
 *
 * 조회할 수 없는 브라우저에서는 아무 말도 하지 않는다. 모르는 것을 `허용 안 됨`이라고 적으면
 * 권한이 멀쩡한 사용자에게 문제가 있다고 알리는 셈이다.
 */
function chipOf(state: BrowserPermissionState) {
  if (state === 'granted') return GRANTED_CHIP;
  return state === 'denied' ? BLOCKED_CHIP : PENDING_CHIP;
}

/** Screen 24 (FR-U-016) — language and permissions. */
export function SettingsPage() {
  const { t, i18n } = useTranslation();
  const english = i18n.resolvedLanguage === 'en';
  const userSessionId = useUserSessionStore((state) => state.userSessionId);
  const setLanguage = useUserSessionStore((state) => state.setLanguage);
  const setExpiresAt = useUserSessionStore((state) => state.setExpiresAt);
  /**
   * 브라우저에 직접 묻는다.
   *
   * 이 카드는 상태를 보여 주기만 한다. 권한을 켜고 끄는 것은 브라우저 설정에서만 되는 일이라,
   * 여기에 토글을 두면 눌러도 실제 권한은 그대로인 채 화면만 바뀐다. 사용자는 허용했다고
   * 믿고 다음 화면에서 다시 막힌다.
   */
  const permissionStates = useBrowserPermissionStates();
  const stateOf: Record<string, BrowserPermissionState> = {
    loc: permissionStates.location,
    cam: permissionStates.camera,
    mic: permissionStates.microphone,
  };

  const changeLanguage = async (language: 'ko' | 'en') => {
    // Persist first so an immediate Back/deep-link navigation cannot render
    // the next screen with the previous session language.
    setLanguage(language);
    await i18n.changeLanguage(language);
    if (!userSessionId) return;
    try {
      const session = await updateUserSession(userSessionId, { language });
      if (session.expiresAt) setExpiresAt(session.expiresAt);
    } catch {
      // The local choice remains authoritative and can be synchronized later.
    }
  };

  return (
    <PhoneFrame bodyClassName={styles.body}>
      <div className={styles.topSpacer} />
      <BackLink to={USER_ROUTES.STATION}>{t('user.settings.back')}</BackLink>
      <Title className={styles.title}>{t('user.settings.title')}</Title>
      <Sub>{t('user.settings.description')}</Sub>

      <Kicker className={styles.sectionLabel}>{t('user.settings.language')}</Kicker>
      <div className={styles.languages}>
        {LANGUAGES.map((language) => (
          <SelectRow
            key={language.code}
            className={styles.language}
            indicator="none"
            selected={i18n.language === language.code}
            onClick={() => void changeLanguage(language.code as 'ko' | 'en')}
          >
            {language.label}
          </SelectRow>
        ))}
      </div>

      <Kicker className={styles.sectionLabel}>{t('user.settings.permissions')}</Kicker>
      <Card className={styles.list}>
        {PERMISSION_CATALOG.map((permission, index) => {
          const state = stateOf[permission.key];
          const chip = chipOf(state);
          return (
            <div
              key={permission.key}
              className={[styles.row, index === PERMISSION_CATALOG.length - 1 && styles.rowLast]
                .filter(Boolean)
                .join(' ')}
            >
              <span className={styles.rowLabel}>
                {english ? permission.shortEn : permission.short}
              </span>
              <Pill style={{ background: chip.bg, color: chip.fg, borderColor: chip.bg }}>
                {t(`user.settings.${state}`)}
              </Pill>
            </div>
          );
        })}
      </Card>
      <Sub className={styles.permissionNote} style={{ whiteSpace: 'pre-line' }}>
        {t('user.settings.permissionNote')}
      </Sub>

      <Kicker className={`${styles.sectionLabel} ${styles.helpSectionLabel}`}>
        {t('user.settings.help')}
      </Kicker>
      <ConsultCta size="sm" className={styles.consult} />
    </PhoneFrame>
  );
}
