import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { GridRowParams, MuiEvent } from '@mui/x-data-grid';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useEffect, useMemo } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SubmissionDetailContent } from './components/SubmissionDetailContent';
import { SubmissionFeatureRow } from './components/SubmissionFeatureTable.interface';

/**
 * Public-facing submission detail page.
 * Displays submission features in a paginated table and indicates when secured features exist.
 */
export const SubmissionDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { submissionId } = useParams<{ submissionId: string }>();
  const api = useApi();

  const submissionDataLoader = useDataLoader((submissionId: number) =>
    api.submissions.getSubmissionRecordWithSecurity(submissionId)
  );

  const featureGrid = useServerPaginatedDataGrid({
    fetcher: (search, pagination) =>
      api.submissions.getSubmissionFeatures(Number(submissionId), {
        search,
        ...pagination
      }),
    extractData: (response) =>
      response.features.map((f) => ({
        submission_feature_id: f.submission_feature_id,
        feature_type_name: f.feature_type_name
      })),
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'submission_feature_id', sort: 'asc' }
  });

  useEffect(() => {
    if (!submissionId) {
      return;
    }
    submissionDataLoader.load(Number(submissionId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  const submission: SubmissionRecordWithSecurity | undefined = useMemo(
    () => submissionDataLoader.data,
    [submissionDataLoader]
  );
  const hasSecuredFeatures = featureGrid.response?.features.some((f) => f.secured) ?? false;

  const handleRowClick = (params: GridRowParams<SubmissionFeatureRow>, _event: MuiEvent<React.MouseEvent>) => {
    const featureId = params.row.submission_feature_id;
    navigate(`/submission/${submissionId}/feature/${featureId}${location.search}`);
  };

  return (
    <SubmissionDetailContent
      isSubmissionLoading={submissionDataLoader.isLoading}
      submission={submission}
      breadcrumbs={
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to={`/search/${location.search}`} underline="hover" color="inherit">
            Search
          </Link>
          <Typography color="text.primary">{submission?.name}</Typography>
        </Breadcrumbs>
      }
      subheader={
        <Box display="flex" flexDirection="column" gap={1}>
          {submission?.description && <Typography color="text.secondary">{submission.description}</Typography>}
          {hasSecuredFeatures && (
            <Box display="flex" gap={1}>
              <Chip icon={<Icon path={mdiLock} size={0.625} />} label="Contains secured features" size="small" />
            </Box>
          )}
        </Box>
      }
      hasSecuredFeatures={hasSecuredFeatures}
      rows={featureGrid.rows}
      rowCount={featureGrid.rowCount}
      isLoading={featureGrid.isLoading}
      searchTerm={featureGrid.searchTerm}
      onSearch={featureGrid.handleSearch}
      onRowClick={handleRowClick}
      paginationModel={featureGrid.paginationModel}
      onPaginationModelChange={featureGrid.handlePaginationChange}
      sortModel={featureGrid.sortModel}
      onSortModelChange={featureGrid.handleSortChange}
    />
  );
};
