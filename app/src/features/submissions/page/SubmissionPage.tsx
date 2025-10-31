import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect } from 'react';
import { useParams } from 'react-router';

/**
 * Get details about a specific submission feature
 * @returns
 */
const SubmissionPage = () => {
  const biohubApi = useApi();

  const { submissionId } = useParams<{ submissionId: string }>();

  const featureDataLoader = useDataLoader(() => biohubApi.submissions.getSubmissionFeatureGroups(Number(submissionId)));

  useEffect(() => {
    featureDataLoader.load();
  }, [featureDataLoader]);

  return (
    <Container maxWidth="xl">
      <Box py={3}>
        <Paper elevation={0}>
          <Box display="flex">TBD</Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default SubmissionPage;
