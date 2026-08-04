import { useTranslation } from 'react-i18next';
import type { PermissionKey } from '@/entities/permission';
import { Icon, Icon3d } from '@/shared/ui';
import { PERMISSION_CATALOG } from '../model/permissionCatalog';
import styles from './PermissionList.module.css';

/**
 * How one permission row reads on screen.
 *
 * Only the browser can grant a permission, so a row reports rather than
 * toggles: `granted` fills the circle, `blocked` marks it in red (denied,
 * unsupported or failed — all of them keep the user out), `idle` leaves it
 * empty. The caller resolves which one applies.
 */
export type PermissionRowState = 'idle' | 'granted' | 'blocked';

type PermissionListProps = {
  /** State per permission. Missing entries fall back to `idle`. */
  states?: Partial<Record<PermissionKey, PermissionRowState>>;
};

const indicatorClass: Record<PermissionRowState, string> = {
  idle: styles.indicatorIdle,
  granted: styles.indicatorGranted,
  blocked: styles.indicatorBlocked,
};

/**
 * The three permission rows shown during onboarding.
 *
 * The screen's single [권한 허용] button drives the browser prompts; each row
 * fills in as its permission comes back.
 */
export function PermissionList({ states }: PermissionListProps) {
  const { t, i18n } = useTranslation();
  const english = i18n.resolvedLanguage === 'en';
  return (
    <ul className={styles.list}>
      {PERMISSION_CATALOG.map((permission) => {
        const state = states?.[permission.key] ?? 'idle';

        return (
          <li key={permission.key} className={styles.row}>
            <Icon3d name={permission.icon} tone={permission.tone} />
            <span className={styles.labels}>
              <b className={styles.name}>{english ? permission.nameEn : permission.name}</b>
              <br />
              <span className={styles.desc}>{english ? permission.descEn : permission.desc}</span>
            </span>
            <span className={[styles.indicator, indicatorClass[state]].join(' ')}>
              {state === 'granted' && <Icon name="check" size={13} />}
              {state === 'blocked' && <Icon name="x" size={13} />}
              <span className="sr-only">{t(`user.permission.state.${state}`)}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
