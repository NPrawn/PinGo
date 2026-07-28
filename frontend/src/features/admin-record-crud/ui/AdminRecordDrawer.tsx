import { Button } from '@/shared/ui';
import type { AdminTableSchema } from '../model/schema';
import styles from './AdminRecordDrawer.module.css';

type AdminRecordDrawerProps = {
  schema: AdminTableSchema;
  /** null id means "creating a new record". */
  editingId: number | null;
  values: Record<string, string>;
  invalid: boolean;
  onChange: (key: string, value: string) => void;
  onCancel: () => void;
  onSave: () => void;
};

/** Side drawer for creating and editing an admin record. */
export function AdminRecordDrawer({
  schema,
  editingId,
  values,
  invalid,
  onChange,
  onCancel,
  onSave,
}: AdminRecordDrawerProps) {
  const editing = editingId != null;

  return (
    <div className={styles.scrim} onClick={onCancel}>
      <div
        className={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-label={editing ? '항목 수정' : '새 항목 추가'}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.head}>
          <div className={styles.eyebrow}>{schema.title}</div>
          <div className={styles.title}>{editing ? '항목 수정' : '새 항목 추가'}</div>
        </div>

        <div className={styles.body}>
          {schema.fields.map((field) => (
            <label key={field.k} className={styles.label}>
              <span className={styles.labelText}>{field.label}</span>
              {field.type === 'text' ? (
                <input
                  className={styles.input}
                  value={values[field.k] ?? ''}
                  placeholder={field.ph ?? ''}
                  onChange={(event) => onChange(field.k, event.target.value)}
                />
              ) : (
                <select
                  className={styles.select}
                  value={values[field.k] ?? ''}
                  onChange={(event) => onChange(field.k, event.target.value)}
                >
                  {field.opts.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
            </label>
          ))}
          {invalid && <div className={styles.error}>이름은 비워둘 수 없어요.</div>}
        </div>

        <div className={styles.foot}>
          <Button size="sm" variant="secondary" className={styles.cancel} onClick={onCancel}>
            취소
          </Button>
          <Button size="sm" className={styles.save} onClick={onSave}>
            {editing ? '변경 사항 저장' : '등록하기'}
          </Button>
        </div>
      </div>
    </div>
  );
}
