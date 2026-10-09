import { GridColDef } from '@mui/x-data-grid';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { SubmissionFeatureError, SubmissionUploadScope } from 'interfaces/useAdminApi.interface';
import { useEffect, useMemo, useState } from 'react';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';
import { adminSubmissionUploadQueryKeys } from '../../submission-upload-query-keys';

interface AdminSubmissionUploadErrorsProps {
  scope: SubmissionUploadScope;
}

/**
 * Display the server-paginated ingestion errors recorded for a single submission upload.
 *
 * @param {AdminSubmissionUploadErrorsProps} props Submission and upload whose errors are listed.
 * @returns {JSX.Element} Errors section with pagination and sorting.
 */
export const AdminSubmissionUploadErrors = ({ scope }: AdminSubmissionUploadErrorsProps) => {
  const api = useApi();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'count', sort: 'desc' } });
  const query = useQuery({
    queryKey: adminSubmissionUploadQueryKeys.errors(scope, grid.apiPagination),
    queryFn: ({ signal }) => api.admin.listSubmissionFeatureErrors(scope, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });
  const [rowCount, setRowCount] = useState(0);
  const columns = useMemo<GridColDef<SubmissionFeatureError>[]>(
    () => [
      { field: 'error_code', headerName: 'Error', minWidth: 200, flex: 0.8 },
      {
        field: 'feature_type_name',
        headerName: 'Feature type',
        minWidth: 160,
        flex: 0.6,
        valueFormatter: (value: string | null) => (value ? getFeatureTypeDisplayLabel(value) : '')
      },
      { field: 'property_name', headerName: 'Property', minWidth: 160, flex: 0.6 },
      { field: 'error_message', headerName: 'Message', minWidth: 240, flex: 1.6, sortable: false },
      { field: 'count', headerName: 'Count', type: 'number', minWidth: 110, flex: 0.4 }
    ],
    []
  );

  // Preserve pagination when a later page fails to load.
  useEffect(() => {
    if (query.data) {
      setRowCount(query.data.pagination.total);
    }
  }, [query.data]);

  return (
    <PageSection id="submission-upload-errors" label="Errors">
      <CustomDataGrid
        autoHeight
        rows={query.data?.errors ?? []}
        columns={columns}
        getRowId={(row) => row.submission_feature_error_id}
        rowCount={query.data?.pagination.total ?? rowCount}
        loading={query.isPending}
        paginationMode="server"
        sortingMode="server"
        paginationModel={grid.paginationModel}
        onPaginationModelChange={grid.handlePaginationChange}
        sortModel={grid.sortModel}
        onSortModelChange={grid.handleSortChange}
        pageSizeOptions={[10, 25, 50]}
        rowSelection={false}
        disableColumnSelector
        noRowsMessage={query.isError ? 'Unable to load errors.' : 'No errors found.'}
      />
    </PageSection>
  );
};
