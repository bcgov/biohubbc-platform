import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { GridRowParams, MuiEvent } from '@mui/x-data-grid';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonTable } from 'components/loading/SkeletonLoaders';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useEffect, useMemo } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { SubmissionFeatureRow } from './components/SubmissionFeatureTable.interface';
import { SubmissionFeatureTable } from './components/SubmissionFeatureTable';

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
    fetcher: (_search, pagination) => api.submissions.getSubmissionFeatures(Number(submissionId), pagination),
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
    <LoadingGuard
      isLoading={submissionDataLoader.isLoading}
      isLoadingFallback={<SkeletonTable numberOfLines={6} />}
      hasNoData={!submission}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No submission found</Typography>
        </Box>
      }>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs aria-label="breadcrumb">
            <Link component={RouterLink} to={`/search/list${location.search}`} underline="hover" color="inherit">
              Search
            </Link>
            <Typography color="text.primary">{submission?.name}</Typography>
          </Breadcrumbs>
        }
        label={submission?.name ?? ''}
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
      />

      <Container maxWidth="xl">
        {hasSecuredFeatures && (
          <AlertBanner icon={<Icon path={mdiLock} size={0.9} />} sx={{ my: 3 }}>
            This submission contains secured features.
          </AlertBanner>
        )}

        <SubmissionFeatureTable
          rows={featureGrid.rows}
          rowCount={featureGrid.rowCount}
          isLoading={featureGrid.isLoading}
          onRowClick={handleRowClick}
          paginationModel={featureGrid.paginationModel}
          onPaginationModelChange={featureGrid.handlePaginationChange}
          sortModel={featureGrid.sortModel}
          onSortModelChange={featureGrid.handleSortChange}
        />
      </Container>
    </LoadingGuard>
  );
};
