import { GridColDef } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { ISubmissionUploadReconciliationCounts } from 'interfaces/useAdminApi.interface';

interface SubmissionUploadReconciliationTableProps {
  counts: ISubmissionUploadReconciliationCounts;
}

interface SubmissionUploadReconciliationRow {
  outcome: string;
  count: number;
}

/**
 * Displays reconciliation outcome counts for a submission upload in a data grid.
 *
 * @param {SubmissionUploadReconciliationTableProps} props Reconciliation counts to display.
 * @returns {JSX.Element} Overview section containing the reconciliation outcome table.
 */
export const SubmissionUploadReconciliationTable = ({ counts }: SubmissionUploadReconciliationTableProps) => {
  const columns: GridColDef<SubmissionUploadReconciliationRow>[] = [
    { field: 'outcome', headerName: 'Outcome', flex: 1 },
    { field: 'count', headerName: 'Count', flex: 1 }
  ];
  const rows: SubmissionUploadReconciliationRow[] = [
    { outcome: 'New', count: counts.new },
    { outcome: 'Unmodified', count: counts.unmodified },
    { outcome: 'Modified', count: counts.modified }
  ];

  return (
    <PageSection id="review-overview" label="Overview">
      <CustomDataGrid
        data-testid="submission-upload-reconciliation-table"
        rows={rows}
        columns={columns}
        getRowId={(row) => row.outcome}
        disableRowSelectionOnClick
        disableColumnSelector
        hideFooter
        autoHeight
      />
    </PageSection>
  );
};
