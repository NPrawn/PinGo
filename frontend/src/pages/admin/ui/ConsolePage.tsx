import { useParams } from 'react-router-dom';
import {
  AdminRecordDrawer,
  AdminTable,
  DeleteRecordDialog,
  isTableTab,
  useAdminRecords,
} from '@/features/admin-record-crud';
import type { AdminTableTab } from '@/features/admin-record-crud';
import { ADMIN_TABS } from '@/shared/config';
import type { AdminTab } from '@/shared/config';
import { AdminConsoleShell, IndoorMapPanel } from '@/widgets/admin-console';
import styles from './ConsolePage.module.css';

const DEFAULT_TAB: AdminTableTab = 'facility';

function resolveTab(param: string | undefined): AdminTab {
  return ADMIN_TABS.find((tab) => tab === param) ?? DEFAULT_TAB;
}

/**
 * Screens 33–37 (FR-A-002 ~ 006) — the admin console.
 *
 * The prototype packed all six tabs into a single screen driven by an `aTab`
 * field. Each tab is a route here, so the sections are linkable and the browser
 * back button works.
 */
export function ConsolePage() {
  const { tab } = useParams<{ tab: string }>();
  const activeTab = resolveTab(tab);
  // The map tab has no records; fall back to a table schema to keep the hook
  // unconditional, and render the map panel instead.
  const records = useAdminRecords(isTableTab(activeTab) ? activeTab : DEFAULT_TAB);

  return (
    <AdminConsoleShell activeTab={activeTab}>
      {isTableTab(activeTab) ? (
        <AdminTable
          schema={records.schema}
          rows={records.rows}
          query={records.query}
          onQueryChange={records.setQuery}
          onCreate={records.startCreate}
          onEdit={records.startEdit}
          onDelete={records.askDelete}
          isApprovable={records.isApprovable}
          onApprove={(id) => void records.approve(id)}
          deleteLabel={records.deleteLabel}
          isDeletable={records.isDeletable}
        />
      ) : (
        <IndoorMapPanel onFlash={records.flash} />
      )}

      {records.draft && (
        <AdminRecordDrawer
          schema={records.schema}
          editingId={records.draft.id}
          values={records.draft.values}
          invalid={records.invalid}
          onChange={records.changeField}
          onCancel={records.cancelEdit}
          onSave={records.save}
        />
      )}

      {records.deletingId != null && (
        <DeleteRecordDialog
          name={records.deletingName}
          actionLabel={records.deleteLabel}
          description={records.deleteDescription}
          onCancel={records.cancelDelete}
          onConfirm={records.confirmDelete}
        />
      )}

      {records.toast && (
        <div className={styles.toast} role="status" aria-live="polite">
          <span className={styles.toastDot} aria-hidden />
          {records.toast}
        </div>
      )}
    </AdminConsoleShell>
  );
}
