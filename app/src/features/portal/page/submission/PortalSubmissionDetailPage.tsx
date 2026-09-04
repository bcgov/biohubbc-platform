import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { GridRowParams, MuiEvent } from '@mui/x-data-grid';
import { SECURITY_LABEL } from 'constants/security';
import dayjs from 'dayjs';
import { SubmissionDetailContent } from 'features/submissions/components/SubmissionDetailContent';
import { SubmissionFeatureRow } from 'features/submissions/components/SubmissionFeatureTable.interface';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useServerPaginatedDataGrid } from 'hooks/useServerPaginatedDataGrid';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useEffect, useMemo } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { getDaysSinceDate } from 'utils/Utils';

/**
 * Portal submission detail page for the current user's submission.
 *
 * @returns {JSX.Element}
 */
export const PortalSubmissionDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { submissionId } = useParams<{ submissionId: string }>();
  const numericSubmissionId = submissionId ? Number(submissionId) : undefined;
  const api = useApi();

  const submissionDataLoader = useDataLoader((submissionId: number) =>
    api.submissions.getSubmissionRecordWithSecurity(submissionId)
  );

  const featureGrid = useServerPaginatedDataGrid({
    fetcher: (_search, pagination) => api.submissions.getSubmissionFeatures(numericSubmissionId ?? 0, pagination),
    extractData: (response) =>
      response.features.map((feature) => ({
        submission_feature_id: feature.submission_feature_id,
        feature_type_name: feature.feature_type_name
      })),
    extractTotal: (response) => response.pagination.total,
    defaultSort: { field: 'submission_feature_id', sort: 'asc' }
  });

  useEffect(() => {
    if (!numericSubmissionId) {
      return;
    }

    submissionDataLoader.load(numericSubmissionId);
  }, [numericSubmissionId, submissionDataLoader]);

  const submission: SubmissionRecordWithSecurity | undefined = useMemo(
    () => submissionDataLoader.data,
    [submissionDataLoader.data]
  );
  const hasSecuredFeatures = featureGrid.response?.features.some((feature) => feature.secured) ?? false;

  const handleRowClick = (params: GridRowParams<SubmissionFeatureRow>, _event: MuiEvent<React.MouseEvent>) => {
    navigate(`/portal/submission/${submissionId}/feature/${params.row.submission_feature_id}${location.search}`);
  };

  return (
    <SubmissionDetailContent
      isSubmissionLoading={submissionDataLoader.isLoading}
      submission={submission}
      breadcrumbs={
        <Breadcrumbs aria-label="breadcrumb">
          <Link component={RouterLink} to="/portal/submission" underline="hover" color="inherit">
            Portal
          </Link>
          <Typography color="text.primary">{submission?.name}</Typography>
        </Breadcrumbs>
      }
      subheader={
        <Stack gap={1}>
          {submission?.description && <Typography color="text.secondary">{submission.description}</Typography>}
          <Stack direction="row" gap={1} flexWrap="wrap">
            <Chip
              label={SECURITY_LABEL[submission?.security ?? ''] ?? submission?.security ?? 'Unknown'}
              size="small"
            />
            {submission?.submitted_timestamp && (
              <Chip label={`Submitted ${getDaysSinceDate(dayjs(submission.submitted_timestamp))}`} size="small" />
            )}
          </Stack>
        </Stack>
      }
      hasSecuredFeatures={hasSecuredFeatures}
      rows={featureGrid.rows}
      rowCount={featureGrid.rowCount}
      isLoading={featureGrid.isLoading}
      onRowClick={handleRowClick}
      paginationModel={featureGrid.paginationModel}
      onPaginationModelChange={featureGrid.handlePaginationChange}
      sortModel={featureGrid.sortModel}
      onSortModelChange={featureGrid.handleSortChange}
    />
  );
};
