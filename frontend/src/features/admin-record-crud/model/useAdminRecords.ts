import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ADMIN_SCHEMA } from './schema';
import type { AdminRecord, AdminTableTab } from './schema';
import { SEED_ID_START, SEED_RECORDS } from './seedRecords';

type Draft = {
  /** null while creating a new record. */
  id: number | null;
  values: Record<string, string>;
};

const TOAST_MS = 2200;

/**
 * CRUD state for one admin tab.
 *
 * Replaces the prototype's `aRows` / `aEdit` / `aDelId` / `aToast` fields,
 * which lived in the single app-wide state object alongside every other screen.
 */
export function useAdminRecords(tab: AdminTableTab) {
  const schema = ADMIN_SCHEMA[tab];

  const [records, setRecords] = useState<Record<AdminTableTab, readonly AdminRecord[]>>(() => ({
    ...SEED_RECORDS,
  }));
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [toast, setToast] = useState('');
  const nextId = useRef(SEED_ID_START);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Switching tabs clears the search box and any open dialog. Adjusted during
  // render rather than in an effect so the reset lands in the same commit —
  // `records` must survive the switch, so remounting on `tab` is not an option.
  const [renderedTab, setRenderedTab] = useState(tab);
  if (renderedTab !== tab) {
    setRenderedTab(tab);
    setQuery('');
    setDraft(null);
    setInvalid(false);
    setDeletingId(null);
  }

  const flash = useCallback((message: string) => {
    clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(''), TOAST_MS);
  }, []);

  const rows = records[tab];

  const visibleRows = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) return rows;
    return rows.filter((row) => Object.values(row).some((v) => String(v).includes(trimmed)));
  }, [rows, query]);

  const startCreate = () => {
    setDraft({ id: null, values: { ...schema.blank } });
    setInvalid(false);
  };

  const startEdit = (id: number) => {
    const row = rows.find((candidate) => candidate.id === id);
    if (!row) return;
    const values = Object.fromEntries(
      Object.entries(row)
        .filter(([key]) => key !== 'id')
        .map(([key, value]) => [key, String(value)]),
    );
    setDraft({ id, values });
    setInvalid(false);
  };

  const changeField = (key: string, value: string) => {
    setDraft((current) =>
      current ? { ...current, values: { ...current.values, [key]: value } } : current,
    );
    setInvalid(false);
  };

  const cancelEdit = () => {
    setDraft(null);
    setInvalid(false);
  };

  const save = () => {
    if (!draft) return;
    if (!draft.values.name?.trim()) {
      setInvalid(true);
      return;
    }
    if (draft.id == null) {
      nextId.current += 1;
      const created = { ...draft.values, id: nextId.current };
      setRecords((current) => ({ ...current, [tab]: [...current[tab], created] }));
      flash('새 항목을 등록했어요');
    } else {
      const { id } = draft;
      setRecords((current) => ({
        ...current,
        [tab]: current[tab].map((row) => (row.id === id ? { ...draft.values, id } : row)),
      }));
      flash('변경 사항을 저장했어요');
    }
    setDraft(null);
  };

  const confirmDelete = () => {
    setRecords((current) => ({
      ...current,
      [tab]: current[tab].filter((row) => row.id !== deletingId),
    }));
    setDeletingId(null);
    flash('항목을 삭제했어요');
  };

  const deletingName =
    deletingId == null ? '' : String(rows.find((r) => r.id === deletingId)?.name ?? '');

  return {
    schema,
    rows: visibleRows,
    query,
    setQuery,
    draft,
    invalid,
    startCreate,
    startEdit,
    changeField,
    cancelEdit,
    save,
    deletingId,
    deletingName,
    askDelete: setDeletingId,
    cancelDelete: () => setDeletingId(null),
    confirmDelete,
    toast,
    flash,
  };
}
