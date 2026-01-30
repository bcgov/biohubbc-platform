import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

/**
 * Get details about a specific submission feature
 *
 * @returns
 */
export const SubmissionFeaturePage = () => {
  const biohubApi = useApi();

  // Get submission ID and submission feature ID from the URL
  const { submissionId, submissionFeatureId } = useParams<{ submissionId: string; submissionFeatureId: number }>();

  const featureDataLoader = useDataLoader(() =>
    biohubApi.features.getSubmissionFeatureById(Number(submissionId), Number(submissionFeatureId))
  );

  useEffect(() => {
    featureDataLoader.load();
  }, [featureDataLoader]);

  return (
    <Container maxWidth="xl">
      <Box py={3}>
        <Paper elevation={0}>
          <Box display="flex">
            {featureDataLoader.data ? (
              <pre>{JSON.stringify(featureDataLoader.data, null, 2)}</pre>
            ) : (
              'Loading submission feature...'
            )}
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};
