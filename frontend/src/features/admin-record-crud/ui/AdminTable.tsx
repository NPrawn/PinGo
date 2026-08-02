import { Button } from '@/shared/ui';
import { badgeTone } from '../model/schema';
import type { AdminRecord, AdminTableSchema } from '../model/schema';
import styles from './AdminTable.module.css';

type AdminTableProps = {
  schema: AdminTableSchema;
  rows: readonly AdminRecord[];
  /** 첫 조회가 끝나기 전. 빈 목록과 구분해서 보여준다. */
  isLoading?: boolean;
  /** 조회 실패 사유. null이면 실패하지 않은 것이다. */
  loadError?: string | null;
  /** 일부 역만 실패해 목록이 불완전할 때의 안내. 표는 그대로 보여준다. */
  partialWarning?: string | null;
  onRetry?: () => void;
  query: string;
  onQueryChange: (query: string) => void;
  onCreate: () => void;
  onEdit: (id: number) => void;
  onDelete: (id: number) => void;
  /** Rows this returns true for get an extra approve action. */
  isApprovable?: (row: AdminRecord) => boolean;
  onApprove?: (id: number) => void;
  /** Label of the destructive action. Defaults to 삭제. */
  deleteLabel?: string;
  /** Hides the destructive action for rows this returns false for. */
  isDeletable?: (row: AdminRecord) => boolean;
};

/** The searchable CRUD table shared by five of the six admin tabs. */
export function AdminTable({
  schema,
  rows,
  isLoading = false,
  loadError = null,
  partialWarning = null,
  onRetry,
  query,
  onQueryChange,
  onCreate,
  onEdit,
  onDelete,
  isApprovable,
  onApprove,
  deleteLabel = '삭제',
  isDeletable,
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
        <span className={styles.count}>
          {loadError ? '불러오지 못함' : isLoading ? '불러오는 중' : `총 ${rows.length}건`}
        </span>
      </div>

      {/* 목록은 보여주되 불완전하다는 사실을 함께 알린다. 조용히 일부만 띄우면
          관리자가 "그 역에는 없다"로 잘못 읽는다. */}
      {partialWarning && (
        <div className={styles.warning} role="status">
          <span className={styles.warningDot} aria-hidden />
          {partialWarning}
          {onRetry && (
            <button type="button" className={styles.warningRetry} onClick={onRetry}>
              다시 시도
            </button>
          )}
        </div>
      )}

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
              {(isDeletable?.(row) ?? true) && (
                <button type="button" className={styles.delete} onClick={() => onDelete(row.id)}>
                  {deleteLabel}
                </button>
              )}
            </span>
          </div>
        ))}

        {/* 실패·로딩·빈 목록은 서로 다른 상태다. 셋 다 빈 표로 보이면 관리자가
            "등록된 게 없구나"로 잘못 읽는다. */}
        {loadError ? (
          <div className={styles.error} role="alert">
            <p className={styles.errorText}>{loadError}</p>
            {onRetry && (
              <button type="button" className={styles.retry} onClick={onRetry}>
                다시 시도
              </button>
            )}
          </div>
        ) : isLoading ? (
          <div className={styles.empty}>목록을 불러오는 중이에요.</div>
        ) : (
          rows.length === 0 && <div className={styles.empty}>조건에 맞는 항목이 없어요.</div>
        )}
      </div>
    </>
  );
}
