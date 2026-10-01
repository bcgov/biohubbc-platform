import { Paper } from '@mui/material';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import BaseHeader from 'components/layout/header/BaseHeader';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useMemo } from 'react';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { SecurityReviewFeatures } from '../features/SecurityReviewFeatures';
import { FeatureRow } from '../features/table/SecurityReviewFeaturesTable.interface';
import { SubmissionUploadStatus } from '../page/status/SubmissionUploadStatus';
import SubmissionHeaderSecurityStatus from './SubmissionHeaderSecurityStatus';

interface AdminSubmissionPageContentProps {
  submissionId: number;
}

/**
 * Displays submission features and upload status without submission-wide security editing.
 *
 * @param {AdminSubmissionPageContentProps} props The submission to show.
 * @returns {JSX.Element | null} Read-only submission overview when loaded.
 */
export const AdminSubmissionPageContent = ({ submissionId }: AdminSubmissionPageContentProps) => {
  const api = useApi();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'submission_feature_id', sort: 'asc' } });

  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.record(submissionId),
    queryFn: ({ signal }) => api.submissions.getSubmissionRecordWithSecurity(submissionId, { signal })
  });
  const featuresQuery = useQuery({
    queryKey: submissionQueryKeys.adminFeatures(submissionId, grid.apiPagination),
    queryFn: ({ signal }) => api.admin.getSubmissionFeatures(submissionId, grid.apiPagination, { signal }),
    placeholderData: keepPreviousData
  });

  const submission = submissionQuery.data;

  const rows: FeatureRow[] = useMemo(() => {
    return (
      featuresQuery.data?.features.map((feature) => ({
        id: feature.submission_feature_id,
        submission_feature_id: feature.submission_feature_id,
        feature_type_name: feature.feature_type_name,
        secured: feature.secured
      })) ?? []
    );
  }, [featuresQuery.data]);

  const rowCount = featuresQuery.data?.pagination.total ?? 0;

  if (!submission) {
    return null;
  }

  return (
    <>
      <BaseHeader
        title={submission.name}
        subTitle={
          <Stack direction="row" alignItems="center" gap={0.25} mt={1} mb={0.25}>
            <SubmissionHeaderSecurityStatus submission={submission} />
          </Stack>
        }
      />

      <Container maxWidth="xl">
        <Paper sx={{ my: 3 }}>
          <SubmissionUploadStatus submissionId={submission.submission_id} />
        </Paper>

        <Paper sx={{ my: 3 }}>
          <SecurityReviewFeatures
            rows={rows}
            rowCount={rowCount}
            paginationModel={grid.paginationModel}
            setPaginationModel={grid.handlePaginationChange}
            sortModel={grid.sortModel}
            setSortModel={grid.handleSortChange}
          />
        </Paper>
      </Container>
    </>
  );
};
