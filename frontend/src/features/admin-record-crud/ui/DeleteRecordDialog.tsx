import { Button } from '@/shared/ui';
import styles from './DeleteRecordDialog.module.css';

type DeleteRecordDialogProps = {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
  /** Wording of the destructive action. Defaults to 삭제. */
  actionLabel?: string;
  /** Overrides the default "removed for good" copy. */
  description?: string;
};

export function DeleteRecordDialog({
  name,
  onCancel,
  onConfirm,
  actionLabel = '삭제',
  description,
}: DeleteRecordDialogProps) {
  return (
    <div className={styles.scrim} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label={`${actionLabel} 확인`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.title}>{actionLabel}할까요?</div>
        <p className={styles.body}>
          {description ? (
            <>
              <b>{name}</b> {description}
            </>
          ) : (
            <>
              <b>{name}</b> 항목이 목록에서 제거돼요. 되돌릴 수 없어요.
            </>
          )}
        </p>
        <div className={styles.actions}>
          <Button size="sm" variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button size="sm" className={styles.destructive} onClick={onConfirm}>
            {actionLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
