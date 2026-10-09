import { RECONCILIATION_OUTCOMES } from 'constants/reconciliation';
import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { ISubmissionUploadReconciliationCounts } from 'interfaces/useAdminApi.interface';

interface SubmissionUploadReconciliationTableProps {
  counts: ISubmissionUploadReconciliationCounts;
  onOutcomeClick: (route: string) => void;
}

interface SubmissionUploadReconciliationRow {
  outcome: string;
  route: string;
  count: number;
}

/**
 * Displays reconciliation outcome counts for a submission upload in a data grid.
 *
 * @param {SubmissionUploadReconciliationTableProps} props Reconciliation counts to display.
 * @returns {JSX.Element} Overview section containing the reconciliation outcome table.
 */
export const SubmissionUploadReconciliationTable = ({
  counts,
  onOutcomeClick
}: SubmissionUploadReconciliationTableProps) => {
  const columns: GridColDef<SubmissionUploadReconciliationRow>[] = [
    { field: 'outcome', headerName: 'Outcome', flex: 1 },
    { field: 'count', headerName: 'Count', flex: 1 }
  ];
  const rows: SubmissionUploadReconciliationRow[] = RECONCILIATION_OUTCOMES.map((outcome) => ({
    outcome: outcome.label,
    route: outcome.route,
    count: counts[outcome.reconciliation]
  }));

  return (
    <PageSection id="review-overview" label="Overview">
      <CustomDataGrid
        data-testid="submission-upload-reconciliation-table"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.outcome}
        onRowClick={({ row }) => onOutcomeClick(row.route)}
        onCellKeyDown={({ row }, event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            event.defaultMuiPrevented = true;
            onOutcomeClick(row.route);
          }
        }}
        sx={{ '& .MuiDataGrid-row': { cursor: 'pointer' } }}
        disableRowSelectionOnClick
        disableColumnSelector
        hideFooter
        autoHeight
      />
    </PageSection>
  );
};
