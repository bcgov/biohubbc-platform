import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import SubmissionHeader from 'features/submissions/components/SubmissionHeader';
import { useSubmissionContext } from 'hooks/useContext';
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
      ids.push(submissionFeatures[key].features);
    }

    return ids.flat().map((item) => item.submission_feature_id);
  };

  return (
    <>
      <SubmissionHeader selectedFeatures={getAllSubmissionFeatureIds()} />
      <Container maxWidth="xl">
        <Stack gap={3} sx={{ py: 4 }}>
          {submissionFeatures.map((submissionFeature) => {
            return (
              <Box key={submissionFeature.feature_type_name}>
                <SubmissionDataGrid
                  feature_type_display_name={submissionFeature.feature_type_display_name}
                  feature_type_name={submissionFeature.feature_type_name}
                  submissionFeatures={submissionFeature.features || []}
                />
              </Box>
            );
          })}
        </Stack>
      </Container>
    </>
  );
};

export default AdminSubmissionPage;
