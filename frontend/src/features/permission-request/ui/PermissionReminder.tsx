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
  /**
   * 권한을 덜 받은 이유가 거부가 아닐 때 대신 보여 줄 안내.
   *
   * 브라우저가 응답하지 않아 시간이 다 된 경우가 그렇다. "남은 권한을 허용해주세요"라고
   * 하면 사용자는 허용할 것이 없는 설정 화면만 뒤지게 된다.
   */
  reason?: string;
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
  onDismiss,
  onAllowAll,
}: PermissionReminderProps) {
  const granted = usePermissionStore((state) => state.granted);

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
        {reason ? (
          <p className={styles.body}>{reason}</p>
        ) : incomplete ? (
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

        <Button className={styles.primary} onClick={onAllowAll}>
          {incomplete ? '모두 허용하기' : '권한 허용하기'}
        </Button>
        {/*
          권한을 덜 허용한 상태에서는 되돌아갈 곳이 없다. 세 권한이 모두 있어야 서비스가
          시작되므로, 개별 선택을 권하는 대신 다시 허용하도록 둔다.

          단 `reason`이 있으면 이야기가 다르다. 거부가 아니라 브라우저가 답을 주지 않은
          경우라, 사용자가 해야 할 일이 이 대화상자 밖에 있다 — 주소창의 권한 아이콘을
          눌러야 한다. 닫을 수 없으면 안내를 읽고도 따를 수가 없다.
        */}
        {(!incomplete || reason) && (
          <GhostButton className={styles.secondary} onClick={onDismiss}>
            {incomplete ? '닫기' : '돌아가기'}
          </GhostButton>
        )}
      </div>
    </Sheet>
  );
}
