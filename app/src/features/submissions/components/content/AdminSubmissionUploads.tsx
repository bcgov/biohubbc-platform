import Chip from '@mui/material/Chip';
import { GridColDef } from '@mui/x-data-grid';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import {
  SUBMISSION_UPLOAD_ACTIVE_JOB_STATUS_CHIP_COLOR,
  SUBMISSION_UPLOAD_DECISION_CHIP_COLORS,
  SUBMISSION_UPLOAD_DECISION_LABELS,
  SUBMISSION_UPLOAD_JOB_STATUS_LABELS,
  SUBMISSION_UPLOAD_TERMINAL_JOB_STATUS_CHIP_COLORS
} from 'constants/submission-upload-status';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { AdminSubmissionUpload } from 'interfaces/useSubmissionsApi.interface';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFormattedDate } from 'utils/Utils';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';

/**
 * Display server-paginated uploads scoped to a single submission.
 *
 * @param props Submission whose active uploads are listed.
 * @returns {JSX.Element} Upload section with pagination and sorting.
 */
export const AdminSubmissionUploads = ({ submissionId }: { submissionId: number }) => {
  const api = useApi();
  const navigate = useNavigate();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'create_date', sort: 'desc' } });
  const query = useQuery({
    queryKey: submissionQueryKeys.adminUploads(submissionId, grid.apiPagination),
    queryFn: ({ signal }) => api.submissions.listAdminSubmissionUploads(submissionId, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });
  const [rowCount, setRowCount] = useState(0);
  const columns = useMemo<GridColDef<AdminSubmissionUpload>[]>(
    () => [
      { field: 'submission_upload_id', headerName: 'Upload ID', minWidth: 220, flex: 1, sortable: false },
      {
        field: 'status',
        headerName: 'Status',
        minWidth: 130,
        flex: 0.6,
        renderCell: ({ row }) => (
          <Chip
            label={SUBMISSION_UPLOAD_JOB_STATUS_LABELS[row.status]}
            size="small"
            color={
              SUBMISSION_UPLOAD_TERMINAL_JOB_STATUS_CHIP_COLORS[row.status] ??
              SUBMISSION_UPLOAD_ACTIVE_JOB_STATUS_CHIP_COLOR
            }
            sx={{ fontWeight: 700 }}
          />
        )
      },
      { field: 'comment', headerName: 'Comment', minWidth: 180, flex: 1, sortable: false },
      {
        field: 'decision',
        headerName: 'Decision',
        minWidth: 130,
        flex: 0.6,
        renderCell: ({ row }) => (
          <Chip
            label={SUBMISSION_UPLOAD_DECISION_LABELS[row.decision]}
            size="small"
            color={SUBMISSION_UPLOAD_DECISION_CHIP_COLORS[row.decision]}
            sx={{ fontWeight: 700 }}
          />
        )
      },
      {
        field: 'create_date',
        headerName: 'Created',
        minWidth: 180,
        flex: 1,
        valueFormatter: (value: string) => getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, value)
      }
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
    <PageSection id="submission-uploads" label="Uploads">
      <CustomDataGrid
        autoHeight
        rows={query.data?.uploads ?? []}
        columns={columns}
        getRowId={(row) => row.submission_upload_id}
        onRowClick={({ row }) => navigate(`/admin/submissions/${submissionId}/uploads/${row.submission_upload_id}`)}
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
        noRowsMessage="No uploads found."
      />
    </PageSection>
  );
};
