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

  // code for collecting individually selected items
  // const flattenSelectedFeatures = (): number[] => {
  //   let total: number[] = [];
  //   for (const item in selectedFeatures) {
  //     total = [...selectedFeatures[item], ...total];
  //   }
  //   return total;
  // };

  // so this will need to change.
  const getAllSubmissionFeatureIds = (): number[] => {
    const ids = [];
    for (const key in submissionFeatures) {
      ids.push(submissionFeatures[key]);
    }

    // return ids.flat().map((item) => item.);
    return [];
  };

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
