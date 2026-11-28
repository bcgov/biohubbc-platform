import AlertTitle from '@mui/material/AlertTitle';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { SubmissionFeatureAbout } from 'components/feature/SubmissionFeatureAbout';
import { AlertBanner } from 'components/notifications/AlertBanner';
import { PageSection } from 'components/section/PageSection';
import { ISubmissionFeature } from 'interfaces/useFeaturesApi.interface';
import { PropsWithChildren } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { SubmissionFeatureMap } from './map/SubmissionFeatureMap';
import { CreateSubmissionFeatureTileSession } from './map/useSubmissionFeatureTileSession';

interface SubmissionFeatureDetailContentProps {
  /** Submission feature displayed by the page. */
  feature: ISubmissionFeature;
  /** Builds the detail page path of another feature, used to link to the current version of this one. */
  getFeaturePath: (submissionFeatureId: number) => string;
  /** Requests the feature's map tile session from the endpoint that serves the page. */
  createTileSession: CreateSubmissionFeatureTileSession;
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
  getFeaturePath,
  createTileSession,
  children
}: PropsWithChildren<SubmissionFeatureDetailContentProps>) => {
  const terminalFeatureId = feature.terminal_submission_feature_id;
  const hasTerminalFeature = terminalFeatureId !== null && terminalFeatureId !== feature.submission_feature_id;

  return (
    <Container maxWidth="lg">
      {feature.successor_submission_feature_id && (
        <AlertBanner severity="warning" variant="standard" sx={{ mt: 4 }}>
          <AlertTitle sx={{ mb: 0 }}>This feature has been superseded</AlertTitle>
          <Typography fontSize="0.8rem">
            This information has been updated with a newer version.
            {hasTerminalFeature && (
              <>
                {' '}
                <Link component={RouterLink} to={getFeaturePath(terminalFeatureId)}>
                  View the current version
                </Link>
              </>
            )}
          </Typography>
        </AlertBanner>
      )}
      <Stack spacing={3} py={4}>
        {children}
        <PageSection id="submission-feature-map" label="Map">
          <SubmissionFeatureMap
            submissionFeatureId={feature.submission_feature_id}
            createTileSession={createTileSession}
          />
        </PageSection>
        <SubmissionFeatureAbout feature={feature} />
      </Stack>
    </Container>
  );
};
