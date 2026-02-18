import { mdiAlertOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Stack, Typography } from '@mui/material';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonList } from 'components/loading/SkeletonLoaders';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect } from 'react';
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

  const dataLoader = useDataLoader((submissionId: number) =>
    api.submissionStatus.getSubmissionUploadStatus(submissionId)
  );

  useEffect(() => {
    dataLoader.load(submissionId);
  }, [submissionId, dataLoader]);

  const status = dataLoader.data;

  return (
    <LoadingGuard
      isLoading={dataLoader.isLoading}
      isLoadingFallback={<SkeletonList numberOfLines={4} />}
      hasNoData={!dataLoader.data && dataLoader.isReady}
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
