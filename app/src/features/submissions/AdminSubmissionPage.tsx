import { Paper } from '@mui/material';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import BaseHeader from 'components/layout/header/BaseHeader';
import { useSubmissionContext } from 'hooks/useContext';
import { useMemo } from 'react';
import SubmissionHeaderSecurityStatus from './components/SubmissionHeaderSecurityStatus';
import { SecurityReviewFeatures } from './features/SecurityReviewFeatures';
import { FeatureRow } from './features/table/SecurityReviewFeaturesTable.interface';
import { SubmissionUploadStatus } from './page/status/SubmissionUploadStatus';

/**
 * Displays submission features and upload status without submission-wide security editing.
 *
 * @returns {JSX.Element | null} Read-only submission overview when loaded.
 */
export const AdminSubmissionPage = () => {
  const { submissionDataLoader, featureDataLoader, paginationModel, setPaginationModel, sortModel, setSortModel } =
    useSubmissionContext();

  const submission = submissionDataLoader.data;

  const rows: FeatureRow[] = useMemo(() => {
    return (
      featureDataLoader.data?.features.map((feature) => ({
        id: feature.submission_feature_id,
        submission_feature_id: feature.submission_feature_id,
        feature_type_name: feature.feature_type_name,
        secured: feature.secured
      })) ?? []
    );
  }, [featureDataLoader.data]);

  const rowCount = featureDataLoader.data?.pagination.total ?? 0;

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
            paginationModel={paginationModel}
            setPaginationModel={setPaginationModel}
            sortModel={sortModel}
            setSortModel={setSortModel}
          />
        </Paper>
      </Container>
    </>
  );
};
