import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
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
import { AdminSubmissionUploadListItem } from 'interfaces/useSubmissionsApi.interface';
import { useNavigate } from 'react-router-dom';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { getFormattedDate } from 'utils/Utils';

const columns: GridColDef<AdminSubmissionUploadListItem>[] = [
  {
    field: 'submission_name',
    headerName: 'Submission',
    flex: 2,
    minWidth: 250
  },
  {
    field: 'status',
    headerName: 'Status',
    width: 150,
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
  {
    field: 'decision',
    headerName: 'Decision',
    width: 150,
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
    field: 'submitted_by_identifier',
    headerName: 'Submitted By',
    flex: 1,
    minWidth: 160,
    sortable: false
  },
  {
    field: 'create_date',
    headerName: 'Created',
    width: 200,
    valueFormatter: (value: string) => getFormattedDate(DATE_FORMAT.ShortMediumDateTimeFormat, value)
  }
];

/**
 * Uploads tab of the administrative submissions page: the uploads of every submission, with the submission each
 * belongs to, its processing status, review decision, submitter and creation time. Each upload opens its own page
 * within its submission. The table keeps its page, sort and search as local state and loads the matching page through
 * a query.
 *
 * @returns {JSX.Element} Uploads table.
 */
export const AdminSubmissionsUploadsContent = () => {
  const biohubApi = useApi();
  const navigate = useNavigate();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'create_date', sort: 'desc' } });
  const filters = { search: grid.debouncedSearchTerm };
  const uploadsQuery = useQuery({
    queryKey: submissionQueryKeys.adminSubmissionUploadList(filters, grid.apiPagination),
    queryFn: ({ signal }) =>
      biohubApi.submissions.getAdminSubmissionUploadList(filters, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });
  const rowCount = uploadsQuery.data?.pagination.total ?? 0;

  return (
    <>
      <QueryErrorDialog error={uploadsQuery.error} label="uploads" />
      <PageSection
        id="admin-submission-uploads"
        label={
          <>
            Uploads{' '}
            <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
              ({rowCount})
            </Typography>
          </>
        }
        headerContent={
          <TextField
            size="small"
            placeholder="Search by submission name"
            value={grid.searchTerm}
            onChange={(event) => grid.handleSearch(event.target.value)}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <Icon path={mdiMagnify} size={0.875} />
                  </InputAdornment>
                )
              }
            }}
            sx={{ width: 250 }}
          />
        }>
        <ServerPaginatedDataGrid<AdminSubmissionUploadListItem>
          dataTestId="admin-submission-uploads-table"
          rows={uploadsQuery.data?.uploads ?? []}
          columns={columns}
          getRowId={(row) => row.submission_upload_id}
          noRowsMessage="No Uploads"
          rowCount={rowCount}
          paginationModel={grid.paginationModel}
          setPaginationModel={grid.handlePaginationChange}
          sortModel={grid.sortModel}
          setSortModel={grid.handleSortChange}
          onRowClick={(row) => navigate(`/admin/submissions/${row.submission_id}/uploads/${row.submission_upload_id}`)}
        />
      </PageSection>
    </>
  );
};
