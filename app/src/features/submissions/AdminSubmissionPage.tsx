import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import SubmissionHeader from 'features/submissions/components/SubmissionHeader';
import { useSubmissionContext } from 'hooks/useSubmissionContext';
import SubmissionDataGrid from './components/SubmissionDataGrid';

const AdminSubmissionPage = () => {
  const submissionContext = useSubmissionContext();

  const submissionDataLoader = submissionContext.submissionDataLoader;
  const features = submissionDataLoader.data?.features;

  const dataset = features?.dataset;
  const sampleSites = features?.sampleSites;
  const animals = features?.animals;
  const observations = features?.observations;

  return (
    <Box>
      <SubmissionHeader selectedFeatures={[]} />
      <Container maxWidth="xl">
        <Box py={2}>
          <SubmissionDataGrid submissionFeatures={dataset || []} title="DATASET FEATURES" />
        </Box>
        <Box py={2}>
          <SubmissionDataGrid submissionFeatures={sampleSites || []} title="SAMPLE SITE FEATURES" />
        </Box>
        <Box py={2}>
          <SubmissionDataGrid submissionFeatures={animals || []} title="ANIMAL FEATURES" />
        </Box>
        <Box py={2}>
          <SubmissionDataGrid submissionFeatures={observations || []} title="OBSERVATIONS FEATURES" />
        </Box>
      </Container>
    </Box>
  );
};

export default AdminSubmissionPage;
