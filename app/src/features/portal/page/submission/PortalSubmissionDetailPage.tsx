import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { GridRowParams, MuiEvent } from '@mui/x-data-grid';
import { keepPreviousData, skipToken, useQuery } from '@tanstack/react-query';
import { SECURITY_LABEL } from 'constants/security';
import dayjs from 'dayjs';
import { SubmissionDetailContent } from 'features/submissions/components/SubmissionDetailContent';
import { SubmissionFeatureRow } from 'features/submissions/components/SubmissionFeatureTable.interface';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useMemo } from 'react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
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

  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.record(numericSubmissionId ?? 0),
    queryFn: numericSubmissionId
      ? ({ signal }) => api.submissions.getSubmissionRecordWithSecurity(numericSubmissionId, { signal })
      : skipToken
  });

  const featureGrid = useServerPaginatedGridState({ defaultSort: { field: 'submission_feature_id', sort: 'asc' } });
  const featuresQuery = useQuery({
    queryKey: submissionQueryKeys.features(numericSubmissionId ?? 0, featureGrid.apiPagination),
    queryFn: ({ signal }) =>
      api.submissions.getSubmissionFeatures(numericSubmissionId ?? 0, featureGrid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });
  const featureRows = useMemo(
    () =>
      featuresQuery.data?.features.map((feature) => ({
        submission_feature_id: feature.submission_feature_id,
        feature_type_name: feature.feature_type_name
      })) ?? [],
    [featuresQuery.data]
  );

  const submission = submissionQuery.data;
  const hasSecuredFeatures = featuresQuery.data?.features.some((feature) => feature.secured) ?? false;

  const handleRowClick = (params: GridRowParams<SubmissionFeatureRow>, _event: MuiEvent<React.MouseEvent>) => {
    navigate(`/portal/submission/${submissionId}/feature/${params.row.submission_feature_id}${location.search}`);
  };

  return (
    <SubmissionDetailContent
      isSubmissionLoading={submissionQuery.isFetching}
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
      rows={featureRows}
      rowCount={featuresQuery.data?.pagination.total ?? 0}
      isLoading={featuresQuery.isFetching}
      onRowClick={handleRowClick}
      paginationModel={featureGrid.paginationModel}
      onPaginationModelChange={featureGrid.handlePaginationChange}
      sortModel={featureGrid.sortModel}
      onSortModelChange={featureGrid.handleSortChange}
    />
  );
};
