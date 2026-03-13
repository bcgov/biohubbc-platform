import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { GridColDef, GridPaginationModel, GridRowParams, GridSortModel, MuiEvent } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonTable } from 'components/loading/SkeletonLoaders';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import {
  ISubmissionFeatureForReviewResponse,
  SubmissionRecordWithSecurity
} from 'interfaces/useSubmissionsApi.interface';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useNavigate, useParams } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { toApiPagination } from 'utils/pagination';

type SubmissionRow = {
  id: number;
  submission_feature_id: number;
  feature_type_name: string;
};

const columns: GridColDef[] = [
  { field: 'submission_feature_id', headerName: 'ID', width: 120, sortable: true },
  { field: 'feature_type_name', headerName: 'Feature Type', flex: 1, sortable: true }
];

/**
 * Public-facing submission detail page.
 * Displays unsecured features in a paginated table and indicates when secured features exist.
 */
export const SubmissionDetailPage = () => {
  const navigate = useNavigate();
  const { submissionId } = useParams<{ submissionId: string }>();
  const api = useApi();

  const [paginationModel, setPaginationModel] = useState<GridPaginationModel>({ page: 0, pageSize: 10 });
  const [sortModel, setSortModel] = useState<GridSortModel>([{ field: 'submission_feature_id', sort: 'asc' }]);

  const paginationOptions: ApiPaginationRequestOptions = useMemo(() => {
    return toApiPagination(paginationModel, sortModel);
  }, [paginationModel, sortModel]);

  const submissionDataLoader = useDataLoader((id: number) => api.submissions.getSubmissionRecordWithSecurity(id));

  const featureDataLoader = useDataLoader((id: number, pagination: ApiPaginationRequestOptions) =>
    api.submissions.getSubmissionFeatures(id, pagination)
  );

  useEffect(() => {
    if (!submissionId) {
      return;
    }
    submissionDataLoader.load(Number(submissionId));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId]);

  useEffect(() => {
    if (!submissionId) {
      return;
    }
    featureDataLoader.load(Number(submissionId), paginationOptions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId, paginationOptions]);

  const submission: SubmissionRecordWithSecurity | undefined = submissionDataLoader.data;
  const featureResponse: ISubmissionFeatureForReviewResponse | undefined = featureDataLoader.data;

  const rows = useMemo(
    () =>
      featureResponse?.features
        .filter((f) => !f.secured)
        .map((f) => ({
          id: f.submission_feature_id,
          submission_feature_id: f.submission_feature_id,
          feature_type_name: f.feature_type_name
        })) ?? [],
    [featureResponse]
  );

  const rowCount = featureResponse?.pagination.total ?? 0;
  const hasSecuredFeatures = featureResponse?.features.some((f) => f.secured) ?? false;

  const handleRowClick = (params: GridRowParams<SubmissionRow>, _event: MuiEvent<React.MouseEvent>) => {
    const featureId = params.row.submission_feature_id;
    navigate(`/submission/${submissionId}/feature/${featureId}`);
    return;
  };

  return (
    <Box>
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
              <Link component={RouterLink} to="/search" underline="hover" color="inherit">
                Search
              </Link>
              <Typography color="text.primary">{submission?.name}</Typography>
            </Breadcrumbs>
          }
          label={submission?.name ?? ''}
          subheader={
            <Box display="flex" flexDirection="column" gap={1}>
              {submission?.description && (
                <Typography variant="body1" color="text.secondary">
                  {submission.description}
                </Typography>
              )}
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
              This submission contains secured features that are not displayed.
            </AlertBanner>
          )}

          <Paper sx={{ my: 3 }}>
            <Stack gap={2} py={2}>
              <Box px={2}>
                <Typography variant="h4">
                  Features{' '}
                  <Typography component="span" color="textSecondary">
                    ({rowCount})
                  </Typography>
                </Typography>
              </Box>

              <CustomDataGrid
                autoHeight
                rows={rows}
                rowCount={rowCount}
                onRowClick={handleRowClick}
                columns={columns}
                getRowId={(row) => row.submission_feature_id}
                loading={featureDataLoader.isLoading}
                pageSizeOptions={[10, 25, 50]}
                noRowsMessage="No features found for this submission."
                paginationMode="server"
                paginationModel={paginationModel}
                onPaginationModelChange={setPaginationModel}
                sortingMode="server"
                sortModel={sortModel}
                onSortModelChange={setSortModel}
              />
            </Stack>
          </Paper>
        </Container>
      </LoadingGuard>
    </Box>
  );
};
