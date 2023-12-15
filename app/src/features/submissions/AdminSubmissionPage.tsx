import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import SubmissionHeader from 'features/submissions/components/SubmissionHeader';
import { useSubmissionContext } from 'hooks/useSubmissionContext';
import SubmissionDataGrid from './components/SubmissionDataGrid';

/**
 * AdminSubmissionPage component for reviewing submissions.
 *
 * @return {*}
 */
const AdminSubmissionPage = () => {
  const submissionContext = useSubmissionContext();

  const submissionDataLoader = submissionContext.submissionDataLoader;

  const submissionFeatures = submissionDataLoader.data?.submissionFeatures || [];

  return (
    <Box>
      <SubmissionHeader selectedFeatures={[]} />
      <Container maxWidth="xl">
        {submissionFeatures.map((submissionFeature) => {
          return (
            <Box py={2} key={submissionFeature.feature_type_name}>
              <SubmissionDataGrid
                feature_type_display_name={submissionFeature.feature_type_display_name}
                submissionFeatures={submissionFeature.features || []}
              />
            </Box>
          );
        })}
      </Container>
    </Box>
  );
};

export default AdminSubmissionPage;
