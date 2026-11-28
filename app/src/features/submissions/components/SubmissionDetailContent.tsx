import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useArtifactApi.interface';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { ReactNode } from 'react';
import { SubmissionFeatures } from './SubmissionFeatures';

interface SubmissionDetailContentProps {
  isSubmissionLoading: boolean;
  submission?: SubmissionRecordWithSecurity;
  breadcrumbs: ReactNode;
  subheader: ReactNode;
  /** Submission route base that feature links open under. */
  basePath: string;
}

/**
 * Renders a submission's header and its Features section, the same searchable feature results as the public
 * submission page.
 *
 * @param {SubmissionDetailContentProps} props - The submission, its loading state, header content, and route base.
 * @returns {JSX.Element} The submission header and Features section, or their loading and empty states.
 */
export const SubmissionDetailContent = ({
  isSubmissionLoading,
  submission,
  breadcrumbs,
  subheader,
  basePath
}: SubmissionDetailContentProps) => {
  const hasSecuredFeatures =
    submission?.security !== SECURITY_APPLIED_STATUS.UNSECURED &&
    submission?.security !== SECURITY_APPLIED_STATUS.PENDING;

  return (
    <LoadingGuard
      isLoading={isSubmissionLoading}
      isLoadingFallback={<SkeletonPage maxWidth="lg" />}
      hasNoData={!submission}
      hasNoDataFallback={
        <Box display="flex" justifyContent="center" alignItems="center" minHeight={300} p={2}>
          <Typography color="text.secondary">No submission found</Typography>
        </Box>
      }>
      <PageHeader maxWidth="lg" breadcrumbs={breadcrumbs} label={submission?.name ?? ''} subheader={subheader} />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {hasSecuredFeatures && (
          <AlertBanner icon={<Icon path={mdiLock} size={0.9} />} sx={{ my: 3 }}>
            This submission contains secured features.
          </AlertBanner>
        )}

        {submission && (
          <SubmissionFeatures
            submissionId={submission.submission_id}
            basePath={basePath}
            featureTypes={submission.feature_types}
          />
        )}
      </Container>
    </LoadingGuard>
  );
};
