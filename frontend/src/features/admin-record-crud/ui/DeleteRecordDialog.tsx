import { Button } from '@/shared/ui';
import styles from './DeleteRecordDialog.module.css';

type DeleteRecordDialogProps = {
  name: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function DeleteRecordDialog({ name, onCancel, onConfirm }: DeleteRecordDialogProps) {
  return (
    <div className={styles.scrim} onClick={onCancel}>
      <div
        className={styles.dialog}
        role="alertdialog"
        aria-modal="true"
        aria-label="삭제 확인"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={styles.title}>삭제할까요?</div>
        <p className={styles.body}>
          <b>{name}</b> 항목이 목록에서 제거돼요. 되돌릴 수 없어요.
        </p>
        <div className={styles.actions}>
          <Button size="sm" variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button size="sm" className={styles.destructive} onClick={onConfirm}>
            삭제
          </Button>
        </div>
      </div>
    </div>
  );
}
