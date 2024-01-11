import { Skeleton } from '@mui/material';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Stack from '@mui/material/Stack';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import BaseHeader from 'components/layout/header/BaseHeader';
import SubmissionHeaderToolbar from 'features/submissions/components/SubmissionHeaderToolbar';
import { useSubmissionContext } from 'hooks/useContext';
import { IGetSubmissionGroupedFeatureResponse } from 'interfaces/useSubmissionsApi.interface';
import { useState } from 'react';
import SubmissionDataGrid from './components/SubmissionDataGrid';
import SubmissionHeaderSecurityStatus from './components/SubmissionHeaderSecurityStatus';

type GroupedSubmissionFeatureSelection = Record<
  IGetSubmissionGroupedFeatureResponse['feature_type_name'],
  GridRowSelectionModel
>;

const SubmissionHeader = (props: { submissionFeatureIds: GridRowSelectionModel }) => {
  const submissionContext = useSubmissionContext();
  const submission = submissionContext.submissionRecordDataLoader.data;

  if (!submission) {
    return <></>; // <CircularProgress className="pageProgress" size={40} />; // TODO makes no sense to show a spinner inside a header
  }

  return (
    <BaseHeader
      title={submission.name} // TODO
      subTitle={
        <Stack flexDirection="row" alignItems="center" gap={0.25} mt={1} mb={0.25}>
          {submission ? (
            <SubmissionHeaderSecurityStatus submission={submission} />
          ) : (
            <Skeleton variant="rectangular" /> // TODO
          )}
        </Stack>
      }
      buttonJSX={<SubmissionHeaderToolbar submissionFeatureIds={props.submissionFeatureIds} />}
    />
  );
};

/**
 * AdminSubmissionPage component for reviewing submissions.
 *
 * @return {*}
 */
const AdminSubmissionPage = () => {
  const [groupedSubmissionFeatureSelection, setGroupedSubmissionFeatureSelection] =
    useState<GroupedSubmissionFeatureSelection>({});

  const submissionContext = useSubmissionContext();

  const { submissionFeatureGroupsDataLoader } = submissionContext;
  const submissionFeatureGroups = submissionFeatureGroupsDataLoader.data || [];

  const onRowSelectionModelChange = (
    featureTypeName: IGetSubmissionGroupedFeatureResponse['feature_type_name'],
    rowSelectionModel: GridRowSelectionModel
  ) => {
    setGroupedSubmissionFeatureSelection((prev) => ({
      ...prev,
      [featureTypeName]: rowSelectionModel
    }));
  };

  const submissionFeatureIds: GridRowSelectionModel = Object.values(groupedSubmissionFeatureSelection).reduce(
    (acc: GridRowSelectionModel, featureIds: GridRowSelectionModel) => {
      return acc.concat(featureIds);
    },
    []
  );

  const allSubmissionFeatureIds = submissionFeatureGroups.reduce(
    (acc: number[], submissionFeatureGroup: IGetSubmissionGroupedFeatureResponse) => {
      return acc.concat(submissionFeatureGroup.features.map((feature) => feature.submission_feature_id));
    },
    []
  );

  return (
    <>
      <SubmissionHeader
        submissionFeatureIds={submissionFeatureIds.length ? submissionFeatureIds : allSubmissionFeatureIds}
      />
      <Container maxWidth="xl">
        <Stack gap={3} sx={{ py: 4 }}>
          {submissionFeatureGroups.map((submissionFeatureGroup) => {
            const featureTypeName = submissionFeatureGroup.feature_type_name;
            const rowSelectionModel = groupedSubmissionFeatureSelection[submissionFeatureGroup.feature_type_name];

            return (
              <Box key={featureTypeName}>
                <SubmissionDataGrid
                  feature_type_display_name={submissionFeatureGroup.feature_type_display_name}
                  feature_type_name={featureTypeName}
                  submissionFeatures={submissionFeatureGroup.features || []}
                  onRowSelectionModelChange={(model) => onRowSelectionModelChange(featureTypeName, model)}
                  rowSelectionModel={rowSelectionModel}
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
