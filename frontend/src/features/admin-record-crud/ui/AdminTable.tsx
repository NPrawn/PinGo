import { Button } from '@/shared/ui';
import { badgeTone } from '../model/schema';
import type { AdminRecord, AdminTableSchema } from '../model/schema';
import styles from './AdminTable.module.css';

type AdminTableProps = {
  schema: AdminTableSchema;
  rows: readonly AdminRecord[];
  query: string;
  onQueryChange: (query: string) => void;
  onCreate: () => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  /** Rows this returns true for get an extra approve action. */
  isApprovable?: (row: AdminRecord) => boolean;
  onApprove?: (id: number) => void;
};

/** The searchable CRUD table shared by five of the six admin tabs. */
export function AdminTable({
  schema,
  rows,
  query,
  onQueryChange,
  onCreate,
  onEdit,
  onDelete,
  isApprovable,
  onApprove,
}: AdminTableProps) {
  return (
    <>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>{schema.title}</h2>
          <p className={styles.desc}>{schema.desc}</p>
        </div>
        {schema.newLabel && (
          <Button size="sm" className={styles.newButton} onClick={onCreate}>
            ＋ {schema.newLabel}
          </Button>
        )}
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchWrap}>
          <input
            className={styles.search}
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="이름·유형으로 검색"
            aria-label="목록 검색"
          />
          <span className={styles.searchIcon}>
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden
            >
              <circle cx="11" cy="11" r="7" />
              <path d="M20 20l-3.2-3.2" />
            </svg>
          </span>
        </div>
        <span className={styles.count}>총 {rows.length}건</span>
      </div>

      <div className={styles.table}>
        <div className={styles.thead}>
          {schema.cols.map((col) => (
            <span key={col.k} style={{ flex: col.flex }}>
              {col.label}
            </span>
          ))}
          <span className={styles.actionsHead}>관리</span>
        </div>

        {rows.map((row) => (
          <div key={row.id} className={styles.row}>
            {schema.cols.map((col) => {
              const value = String(row[col.k] ?? '-');
              const tone = col.badge ? badgeTone(value) : null;
              return (
                <span key={col.k} className={styles.cell} style={{ flex: col.flex }}>
                  {tone ? (
                    <span className={styles.badge} style={{ background: tone.bg, color: tone.fg }}>
                      {value}
                    </span>
                  ) : (
                    <span style={{ fontWeight: col.weight ?? 600 }}>{value}</span>
                  )}
                </span>
              );
            })}
            <span className={styles.actions}>
              {onApprove && isApprovable?.(row) && (
                <button type="button" className={styles.approve} onClick={() => onApprove(row.id)}>
                  수락
                </button>
              )}
              <button type="button" className={styles.edit} onClick={() => onEdit(row.id)}>
                수정
              </button>
              <button type="button" className={styles.delete} onClick={() => onDelete(row.id)}>
                삭제
              </button>
            </span>
          </div>
        ))}

        {rows.length === 0 && <div className={styles.empty}>조건에 맞는 항목이 없어요.</div>}
      </div>
    </>
  );
}
