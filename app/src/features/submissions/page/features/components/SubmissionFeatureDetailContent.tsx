import AlertTitle from '@mui/material/AlertTitle';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SubmissionFeatureAbout } from 'components/feature/SubmissionFeatureAbout';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { PageSection } from 'components/section/PageSection';
import { ISubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { PropsWithChildren } from 'react';
import { SubmissionFeatureMap } from './map/SubmissionFeatureMap';

interface SubmissionFeatureDetailContentProps {
  /** Submission feature displayed by the page. */
  feature: ISubmissionFeature;
}

/**
 * Renders the content of a loaded submission feature detail page.
 *
 * Displays the superseded warning, indexed properties, map, and identifying
 * metadata. Loading and missing-data states are handled by the
 * parent page so this component always receives a valid feature.
 *
 * @param {SubmissionFeatureDetailContentProps} props - Feature data and caller-provided property content.
 * @returns {JSX.Element} The loaded submission feature detail content.
 */
export const SubmissionFeatureDetailContent = ({
  feature,
  children
}: PropsWithChildren<SubmissionFeatureDetailContentProps>) => {
  return (
    <Container maxWidth="xl">
      {feature.successor_submission_feature_id && (
        <AlertBanner severity="warning" variant="standard" sx={{ mt: 4 }}>
          <AlertTitle sx={{ mb: 0 }}>This feature has been superseded</AlertTitle>
          <Typography fontSize="0.8rem">This information has been updated with a newer version.</Typography>
        </AlertBanner>
      )}
      <Stack spacing={3} py={4}>
        {children}
        <PageSection id="submission-feature-map" label="Map">
          <SubmissionFeatureMap
            submissionId={feature.submission_id}
            submissionFeatureId={feature.submission_feature_id}
          />
        </PageSection>
        <SubmissionFeatureAbout feature={feature} />
      </Stack>
    </Container>
  );
};
