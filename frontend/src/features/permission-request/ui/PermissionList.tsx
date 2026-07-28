import { usePermissionStore } from '@/entities/permission';
import { Icon3d, SelectRow } from '@/shared/ui';
import { PERMISSION_CATALOG } from '../model/permissionCatalog';
import styles from './PermissionList.module.css';

/** The three opt-in permission rows shown during onboarding. */
export function PermissionList() {
  const granted = usePermissionStore((state) => state.granted);
  const toggle = usePermissionStore((state) => state.toggle);

  return (
    <div className={styles.list}>
      {PERMISSION_CATALOG.map((permission) => (
        <SelectRow
          key={permission.key}
          selected={granted[permission.key]}
          onClick={() => toggle(permission.key)}
        >
          <Icon3d name={permission.icon} tone={permission.tone} />
          <span className={styles.labels}>
            <b className={styles.name}>{permission.name}</b>
            <br />
            <span className={styles.desc}>{permission.desc}</span>
          </span>
        </SelectRow>
      ))}
    </div>
  );
}
