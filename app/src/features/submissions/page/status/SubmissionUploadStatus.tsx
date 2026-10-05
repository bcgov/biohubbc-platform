import { mdiAlertOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { useApi } from 'hooks/useApi';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { SubmissionUploadStatusCard } from './card/SubmissionUploadStatusCard';

interface SubmissionUploadStatusProps {
  submissionId: number;
}

/**
 * Fetches and displays information about a submission upload for administrators.
 *
 * @param {SubmissionUploadStatusProps} props
 * @returns
 */
export const SubmissionUploadStatus = (props: SubmissionUploadStatusProps) => {
  const { submissionId } = props;
  const api = useApi();

  const statusQuery = useQuery({
    queryKey: submissionQueryKeys.uploadStatus(submissionId),
    queryFn: ({ signal }) => api.submissionStatus.getSubmissionUploadStatus(submissionId, { signal })
  });

  const status = statusQuery.data;

  return (
    <LoadingGuard
      isLoading={statusQuery.isPending}
      isLoadingFallback={<SkeletonList numberOfLines={4} />}
      hasNoData={!status && statusQuery.isError}
      hasNoDataFallback={
        <Stack gap={2} minHeight={200} display="flex" alignItems="center" justifyContent="center">
          <Icon path={mdiAlertOutline} size={1.5} />
          <Typography>Failed to get upload status</Typography>
        </Stack>
      }>
      {status && <SubmissionUploadStatusCard status={status} />}
    </LoadingGuard>
  );
};
