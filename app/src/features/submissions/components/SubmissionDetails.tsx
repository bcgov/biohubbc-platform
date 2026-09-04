import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useArtifactApi.interface';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { SubmissionAbout } from './SubmissionAbout';
import { SubmissionFeatures } from './SubmissionFeatures';

interface SubmissionDetailsProps {
  /** Submission displayed by the Details tab. */
  submission: SubmissionRecordWithSecurity;
}

/**
 * Renders the loaded content for the submission Details tab.
 *
 * Displays the secured-feature notice, searchable features, and submission metadata.
 *
 * @param {SubmissionDetailsProps} props - Submission displayed by the Details tab.
 * @returns {JSX.Element} The loaded submission Details content.
 */
export const SubmissionDetails = ({ submission }: SubmissionDetailsProps) => {
  const hasSecuredFeatures =
    submission.security !== SECURITY_APPLIED_STATUS.UNSECURED &&
    submission.security !== SECURITY_APPLIED_STATUS.PENDING;

  return (
    <Container maxWidth="xl">
      <Stack spacing={3} py={4}>
        {hasSecuredFeatures && (
          <AlertBanner icon={<Icon path={mdiLock} size={0.9} />}>Some of the features are secured.</AlertBanner>
        )}
        <SubmissionFeatures submissionId={submission.submission_id} featureTypes={submission.feature_types} />
        <SubmissionAbout submission={submission} />
      </Stack>
    </Container>
  );
};
