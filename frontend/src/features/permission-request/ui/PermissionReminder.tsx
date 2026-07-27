import { usePermissionStore } from '@/entities/permission';
import { Button, GhostButton, Icon, Pill, Sheet } from '@/shared/ui';
import { PERMISSION_CATALOG } from '../model/permissionCatalog';
import styles from './PermissionReminder.module.css';

type PermissionReminderProps = {
  /**
   * `incomplete` nudges the user to finish granting; `blocked` explains that
   * the app cannot run without permissions at all.
   */
  variant: 'incomplete' | 'blocked';
  onDismiss: () => void;
  /** Runs after the user grants everything from inside the dialog. */
  onAllowAll: () => void;
};

const GRANTED_CHIP = { bg: '#d9f0df', fg: '#0f5a3e' };
const PENDING_CHIP = { bg: '#fff', fg: '#8b857a' };

/** Prototype's two permission modals on `#s-perm`. */
export function PermissionReminder({ variant, onDismiss, onAllowAll }: PermissionReminderProps) {
  const granted = usePermissionStore((state) => state.granted);
  const grant = usePermissionStore((state) => state.grant);

  const allowAll = () => {
    grant('loc', 'cam', 'mic');
    onAllowAll();
  };

  const incomplete = variant === 'incomplete';

  return (
    <Sheet
      placement="center"
      onDismiss={onDismiss}
      label={incomplete ? '모든 권한이 필요해요' : '권한 없이는 이용할 수 없어요'}
    >
      <div className={styles.panel}>
        <div
          className={[styles.mark, incomplete ? styles.markWarning : styles.markLocked].join(' ')}
        >
          <Icon name={incomplete ? 'warning' : 'lock'} size={28} />
        </div>
        <h2 className={styles.heading}>
          {incomplete ? '모든 권한이 필요해요' : '권한 없이는 이용할 수 없어요'}
        </h2>
        {incomplete ? (
          <p className={styles.body}>
            위치 정보·카메라·마이크 권한을 <b>모두 선택</b>해야 서비스를 시작할 수 있어요.
            <span className={styles.finalLine}>남은 권한을 허용해주세요.</span>
          </p>
        ) : (
          <p className={styles.body}>
            PinGo는 카메라·위치·마이크 권한으로 실내 위치를 찾고 길을 안내해요. 권한을 허용해야
            서비스를 시작할 수 있어요.
          </p>
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
                  {permission.short}
                </Pill>
              );
            })}
          </div>
        )}

        <Button className={styles.primary} onClick={allowAll}>
          {incomplete ? '모두 허용하기' : '권한 허용하기'}
        </Button>
        <GhostButton className={styles.secondary} onClick={onDismiss}>
          {incomplete ? '직접 선택할게요' : '돌아가기'}
        </GhostButton>
      </div>
    </Sheet>
  );
}
