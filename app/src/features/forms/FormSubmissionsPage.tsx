import { mdiPlus } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageSection } from 'components/section/PageSection';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { IFormSubmissionListItem } from 'interfaces/useFormsApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';
import { getFormattedDate } from 'utils/Utils';

/**
 * Format a nullable date for the table.
 *
 * @param {string | null} value Date, or null.
 * @returns {string} Formatted date, or an empty string.
 */
const formatDate = (value: string | null) => (value ? getFormattedDate(DATE_FORMAT.ShortMediumDateFormat, value) : '');

const columns: GridColDef<IFormSubmissionListItem>[] = [
  { field: 'submitted_by_identifier', headerName: 'Submitter', flex: 1, minWidth: 180, sortable: false },
  {
    field: 'status',
    headerName: 'Status',
    width: 130,
    sortable: false,
    renderCell: (params) => (
      <Chip
        label={params.row.status === 'draft' ? 'Draft' : 'Submitted'}
        size="small"
        color={params.row.status === 'draft' ? 'default' : 'primary'}
        sx={{ fontWeight: 700 }}
      />
    )
  },
  { field: 'upload_status', headerName: 'Processing', width: 140, sortable: false },
  { field: 'upload_decision', headerName: 'Decision', width: 130, sortable: false },
  { field: 'submitted_date', headerName: 'Submitted', width: 160, valueFormatter: formatDate },
  { field: 'create_date', headerName: 'Started', width: 160, valueFormatter: formatDate }
];

/**
 * A form's submissions: every submission for a member of the form administration team, and the user's own otherwise.
 * Each opens its submission page, and "New Submission" starts another.
 *
 * @returns {JSX.Element} Form submissions page.
 */
export const FormSubmissionsPage = () => {
  const { slug } = useParams<{ slug: string }>();
  const biohubApi = useApi();
  const navigate = useNavigate();

  const grid = useServerPaginatedGridState({ defaultSort: { field: 'create_date', sort: 'desc' } });
  const formQuery = useQuery({
    queryKey: formQueryKeys.slug(slug ?? ''),
    queryFn: slug ? ({ signal }) => biohubApi.forms.getFormBySlug(slug, { signal }) : skipToken
  });
  const submissionsQuery = useQuery({
    queryKey: formQueryKeys.submissionList(slug ?? '', grid.apiPagination),
    queryFn: slug
      ? ({ signal }) => biohubApi.forms.getFormSubmissions(slug, grid.apiPagination, { signal })
      : skipToken,
    placeholderData: keepPreviousData
  });
  const apiError = (formQuery.error ?? submissionsQuery.error) as APIError | null;
  const rowCount = submissionsQuery.data?.pagination.total ?? 0;

  if (apiError?.status === 404) {
    return <Navigate to="/page-not-found" replace />;
  }

  if (apiError?.status === 403) {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <AdminPageLayout
      title={formQuery.data?.form.name ?? 'Form'}
      breadcrumbs={null}
      buttons={
        <Button
          variant="contained"
          startIcon={<Icon path={mdiPlus} size={0.8} />}
          onClick={() => navigate(`/forms/${slug}`)}>
          New Submission
        </Button>
      }
      tabs={[
        { value: 'submissions', label: 'Submissions', id: 'form-submissions', ariaControls: 'form-submissions-panel' }
      ]}
      activeTab="submissions"
      onTabChange={() => undefined}>
      <QueryErrorDialog error={formQuery.error ?? submissionsQuery.error} label="form submissions" />
      <Box id="form-submissions-panel" role="tabpanel" aria-labelledby="form-submissions">
        <PageSection
          id="form-submissions"
          label={
            <>
              {submissionsQuery.data?.is_form_admin ? 'All Submissions' : 'My Submissions'}{' '}
              <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
                ({rowCount})
              </Typography>
            </>
          }>
          <ServerPaginatedDataGrid<IFormSubmissionListItem>
            dataTestId="form-submissions-table"
            rows={submissionsQuery.data?.form_submissions ?? []}
            columns={columns}
            getRowId={(row) => row.uuid}
            noRowsMessage="No Submissions"
            rowCount={rowCount}
            paginationModel={grid.paginationModel}
            setPaginationModel={grid.handlePaginationChange}
            sortModel={grid.sortModel}
            setSortModel={grid.handleSortChange}
            onRowClick={(row) => navigate(`/forms/${slug}/submissions/${row.uuid}`)}
          />
        </PageSection>
      </Box>
    </AdminPageLayout>
  );
};
