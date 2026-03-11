import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import { AlertBanner } from 'components/notifications/AlertBanner';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { GridColDef, GridPaginationModel, GridRowParams, GridSortModel, MuiEvent } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import BaseHeader from 'components/layout/header/BaseHeader';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import {
  ISubmissionFeatureForReviewResponse,
  SubmissionRecordWithSecurity
} from 'interfaces/useSubmissionsApi.interface';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { firstOrNull } from 'utils/Utils';

type SubmissionRow = {
  id: number;
  submission_feature_id: number;
  feature_type_name: string;
}

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
    const sort = firstOrNull(sortModel);
    return {
      page: paginationModel.page + 1,
      limit: paginationModel.pageSize,
      sort: sort?.field,
      order: sort?.sort as 'asc' | 'desc' | undefined
    };
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
    navigate(`submissions/${submissionId}/features/${featureId}`);
    return;
  };

  if (!submission && !submissionDataLoader.isLoading) {
    return null;
  }

  return (
    <>
      <BaseHeader
        title={submission?.name ?? 'Loading...'}
        subTitle={
          submission?.description ? (
            <Typography variant="body1" color="textSecondary">
              {submission.description}
            </Typography>
          ) : undefined
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
    </>
  );
};
