import { useTranslation } from 'react-i18next';
import { usePermissionStore, type PermissionKey } from '@/entities/permission';
import { Button, GhostButton, Icon, Pill, Sheet } from '@/shared/ui';
import { PERMISSION_CATALOG, permissionNamesOf } from '../model/permissionCatalog';
import styles from './PermissionReminder.module.css';

type PermissionReminderProps = {
  /**
   * `incomplete` nudges the user to finish granting; `blocked` explains that
   * the app cannot run without permissions at all.
   */
  variant: 'incomplete' | 'blocked';
  /**
   * 권한을 덜 받은 이유가 거부가 아닐 때 대신 보여 줄 안내.
   *
   * 브라우저가 응답하지 않아 시간이 다 된 경우가 그렇다. "남은 권한을 허용해주세요"라고
   * 하면 사용자는 허용할 것이 없는 설정 화면만 뒤지게 된다.
   */
  reason?: string;
  /**
   * 브라우저가 거부로 기억하고 있어 이 화면에서는 물어볼 수 없는 권한.
   *
   * 비어 있지 않으면 안내가 통째로 바뀐다. [모두 허용하기]를 눌러도 팝업이 뜨지 않아
   * 같은 대화상자가 다시 열릴 뿐이므로, 대신 브라우저 설정에서 켜는 방법을 알려 준다.
   */
  blockedKeys?: readonly PermissionKey[];
  /** 요청하면 팝업이 뜨는 권한이 남아 있는지. 없으면 허용 버튼을 두지 않는다. */
  canPrompt?: boolean;
  onDismiss: () => void;
  /**
   * Runs when the user asks for the permissions from inside the dialog. The
   * caller re-runs the browser prompts — the dialog cannot grant anything
   * itself.
   */
  onAllowAll: () => void;
};

const GRANTED_CHIP = { bg: '#d9f0df', fg: '#0f5a3e' };
const PENDING_CHIP = { bg: '#fff', fg: '#8b857a' };

/** Prototype's two permission modals on `#s-perm`. */
export function PermissionReminder({
  variant,
  reason,
  blockedKeys = [],
  canPrompt = true,
  onDismiss,
  onAllowAll,
}: PermissionReminderProps) {
  const { t, i18n } = useTranslation();
  const english = i18n.resolvedLanguage === 'en';
  const granted = usePermissionStore((state) => state.granted);

  const incomplete = variant === 'incomplete';
  /**
   * 브라우저 설정으로만 풀 수 있는 상태.
   *
   * 이 화면에서 할 수 있는 일이 없다는 뜻이라, 안내도 버튼도 전부 달라진다.
   */
  const settingsOnly = blockedKeys.length > 0;
  const blockedNames = permissionNamesOf(blockedKeys, english ? 'en' : 'ko');
  const heading = settingsOnly
    ? t('user.permission.reminder.settingsTitle')
    : incomplete
      ? t('user.permission.reminder.allTitle')
      : t('user.permission.reminder.requiredTitle');

  return (
    <Sheet placement="center" onDismiss={onDismiss} label={heading}>
      <div className={styles.panel}>
        <div
          className={[
            styles.mark,
            incomplete && !settingsOnly ? styles.markWarning : styles.markLocked,
          ].join(' ')}
        >
          <Icon name={incomplete && !settingsOnly ? 'warning' : 'lock'} size={28} />
        </div>
        <h2 className={styles.heading}>{heading}</h2>
        {settingsOnly ? (
          /*
            거부된 권한은 페이지가 다시 물어볼 수 없다. 브라우저가 그 오리진을 차단으로
            기억하고 팝업 없이 즉시 거절하기 때문이다. 그래서 여기서는 허용을 조르지 않고
            사용자가 실제로 할 수 있는 일 하나만 알려 준다.

            설정을 바꾸면 화면이 알아서 넘어간다 — 훅이 권한 변화를 구독하고 있다. 새로고침을
            시키지 않는 이유는, 되돌아온 자리가 이 화면이 아닐 수 있어서다.
          */
          <p className={styles.body} style={{ whiteSpace: 'pre-line' }}>
            {t('user.permission.reminder.blockedBody', { permissions: blockedNames })}
          </p>
        ) : reason ? (
          <p className={styles.body}>{reason}</p>
        ) : incomplete ? (
          <p className={styles.body}>{t('user.permission.reminder.incompleteBody')}</p>
        ) : (
          <p className={styles.body}>{t('user.permission.reminder.requiredBody')}</p>
        )}

        {incomplete && (
          <div className={styles.chips}>
            {PERMISSION_CATALOG.map((permission) => {
              const chip = granted[permission.key] ? GRANTED_CHIP : PENDING_CHIP;
              return (
                <Pill
                  key={permission.key}
                  style={{ background: chip.bg, color: chip.fg, borderColor: chip.bg }}
                >
                  <Icon name={permission.icon} size={14} />
                  {english ? permission.shortEn : permission.short}
                </Pill>
              );
            })}
          </div>
        )}

        {/*
          물어볼 수 있는 권한이 남아 있을 때만 허용 버튼을 둔다.

          전부 차단된 상태에서 이 버튼을 두면 눌러도 팝업이 뜨지 않고 같은 대화상자가 다시
          열린다. 사용자는 버튼이 고장 났다고 읽거나, 될 때까지 계속 누르게 된다.
        */}
        {canPrompt && (
          <Button className={styles.primary} onClick={onAllowAll}>
            {settingsOnly
              ? t('user.permission.reminder.allowRemaining')
              : incomplete
                ? t('user.permission.reminder.allowAll')
                : t('user.permission.reminder.allow')}
          </Button>
        )}
        {/*
          권한을 덜 허용한 상태에서는 되돌아갈 곳이 없다. 세 권한이 모두 있어야 서비스가
          시작되므로, 개별 선택을 권하는 대신 다시 허용하도록 둔다.

          단 사용자가 해야 할 일이 이 대화상자 밖에 있으면 이야기가 다르다. 브라우저가 답을
          주지 않았거나(`reason`) 권한이 차단돼 설정을 열어야 하는 경우(`settingsOnly`)가
          그렇다. 닫을 수 없으면 안내를 읽고도 따를 수가 없다.
        */}
        {(!incomplete || reason || settingsOnly) && (
          <GhostButton className={styles.secondary} onClick={onDismiss}>
            {incomplete
              ? t('user.permission.reminder.close')
              : t('user.permission.reminder.back')}
          </GhostButton>
        )}
      </div>
    </Sheet>
  );
}
