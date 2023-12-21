import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import SubmissionHeader from 'features/submissions/components/SubmissionHeader';
import { useSubmissionContext } from 'hooks/useContext';
import SubmissionDataGrid from './components/SubmissionDataGrid';
import { IGetSubmissionGroupedFeatureResponse } from 'interfaces/useSubmissionsApi.interface';

/**
 * AdminSubmissionPage component for reviewing submissions.
 *
 * @return {*}
 */
const AdminSubmissionPage = () => {
  const submissionContext = useSubmissionContext();

  const { submissionFeatureGroupsDataLoader } = submissionContext;
  const submissionFeatureGroups = submissionFeatureGroupsDataLoader.data || [];

  const allSubmissionFeatureIds = submissionFeatureGroups
      .reduce((acc: number[], submissionFeatureGroup: IGetSubmissionGroupedFeatureResponse) => {
        return acc.concat(submissionFeatureGroup.features.map((feature) => feature.submission_feature_id));
      }, []);

  return (
    <>
      <SubmissionHeader selectedFeatures={allSubmissionFeatureIds} />
      <Container maxWidth="xl">
        <Stack gap={3} sx={{ py: 4 }}>
          {submissionFeatureGroups.map((submissionFeatureGroup) => {
            return (
              <Box key={submissionFeatureGroup.feature_type_name}>
                <SubmissionDataGrid
                  feature_type_display_name={submissionFeatureGroup.feature_type_display_name}
                  feature_type_name={submissionFeatureGroup.feature_type_name}
                  submissionFeatures={submissionFeatureGroup.features || []}
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
