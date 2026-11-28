import { mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { PageHeader } from 'components/header/PageHeader';
import { LoadingGuard } from 'components/loading/LoadingGuard';
import { SkeletonPage } from 'components/loading/SkeletonPage';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useArtifactApi.interface';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { PropsWithChildren, ReactNode } from 'react';

interface SubmissionDetailContentProps {
  isSubmissionLoading: boolean;
  submission?: SubmissionRecordWithSecurity;
  breadcrumbs: ReactNode;
  subheader: ReactNode;
  /** Section tabs shown beneath the submission metadata. */
  tabs: ReactNode;
}

/**
 * Layout of a submission's page for its team: the header with the submission's metadata and section tabs, a banner
 * when some of its current features are secured, and the selected section passed as children.
 *
 * @param {PropsWithChildren<SubmissionDetailContentProps>} props - Submission, header content and the selected section.
 * @returns {JSX.Element} The submission page layout.
 */
export const SubmissionDetailContent = ({
  isSubmissionLoading,
  submission,
  breadcrumbs,
  subheader,
  tabs,
  children
}: PropsWithChildren<SubmissionDetailContentProps>) => {
  const hasSecuredFeatures =
    submission?.security === SECURITY_APPLIED_STATUS.SECURED ||
    submission?.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED;

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
      <PageHeader
        maxWidth="lg"
        breadcrumbs={breadcrumbs}
        label={submission?.name ?? ''}
        subheader={subheader}
        tabs={tabs}
      />

      <Container maxWidth="lg" sx={{ py: 4 }}>
        {hasSecuredFeatures && (
          <AlertBanner
            variant="standard"
            icon={<Icon path={mdiLock} size={0.75} style={{ marginTop: '1px' }} />}
            sx={{ mb: 3 }}>
            <AlertTitle sx={{ mb: 0 }}>Some features are secured</AlertTitle>
            <Typography fontSize="0.8rem">
              Some data are secured under the Species and Ecosystems Data & Information Security Policy.
            </Typography>
          </AlertBanner>
        )}

        {children}
      </Container>
    </LoadingGuard>
  );
};
