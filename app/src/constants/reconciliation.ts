import { ReconciliationType } from 'interfaces/useAdminApi.interface';

/** Review labels and URL segments mapped to the persisted classifications. */
export const RECONCILIATION_OUTCOMES: { route: string; label: string; reconciliation: ReconciliationType }[] = [
  { route: 'new', label: 'New', reconciliation: 'new' },
  { route: 'unchanged', label: 'Unchanged', reconciliation: 'unmodified' },
  { route: 'changed', label: 'Changed', reconciliation: 'modified' }
];
