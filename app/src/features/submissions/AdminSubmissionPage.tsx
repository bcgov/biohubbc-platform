import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { SubmissionContext } from 'contexts/submissionContext';
import { useContext, useState } from 'react';
import CompleteReviewDialog from './components/CompleteReviewDialog';
import SubmissionDataGrid from './components/SubmissionDataGrid';
import SubmissionHeader from './components/SubmissionHeader';

interface ISelectedFeatureType {
  [key: string]: number[];
}

const AdminSubmissionPage = () => {
  const submissionContext = useContext(SubmissionContext);

  const submissionDataLoader = submissionContext.submissionDataLoader;
  const features = submissionDataLoader.data?.features;

  const dataset = features?.dataset;
  const sampleSites = features?.sampleSites;
  const animals = features?.animals;
  const observations = features?.observations;

  const [openSecurityReasonsDialog, setOpenSecurityReasonsDialog] = useState(false);
  const [openCompleteReviewDialog, setOpenCompleteReviewDialog] = useState(false);
  const [selectedFeatures, setSelectedFeatures] = useState<ISelectedFeatureType>({});

  const submitSecurity = async (values: any) => {
    console.log('values', values);
  };

  const handleRowSelection = (type: string, ids: number[]) => {
    selectedFeatures[type] = ids;
    setSelectedFeatures({ ...selectedFeatures });
  };

  const flattenSelectedFeatures = (): number[] => {
    let total: number[] = [];
    for (const item in selectedFeatures) {
      total = [...selectedFeatures[item], ...total];
    }
    return total;
  };

  console.log(openSecurityReasonsDialog);
  return (
    <Box>
      <CompleteReviewDialog
        open={openCompleteReviewDialog}
        onClose={() => setOpenCompleteReviewDialog(false)}
        onSubmit={async (values) => {
          setOpenCompleteReviewDialog(false);
          submitSecurity(values);
        }}
        submissionSuccessDialogTitle="Submission Completed"
        submissionSuccessDialogText="Submission has been completed successfully."
        noSubmissionDataDialogTitle="No Submission Data"
        noSubmissionDataDialogText="No submission data found."
      />
      <SubmissionHeader
        openCompleteReviewDialog={(open: boolean) => {
          setOpenCompleteReviewDialog(open);
        }}
        selectedFeatures={flattenSelectedFeatures()}
      />
      <Container maxWidth="xl">
        <Box py={2}>
          <SubmissionDataGrid
            submissionFeatures={dataset || []}
            title="DATASET FEATURES"
            onRowSelection={(ids) => {
              handleRowSelection('dataset', ids);
            }}
          />
        </Box>
        <Box py={2}>
          <SubmissionDataGrid
            submissionFeatures={sampleSites || []}
            title="SAMPLE SITE FEATURES"
            onRowSelection={(ids) => {
              handleRowSelection('sample-sites', ids);
            }}
          />
        </Box>
        <Box py={2}>
          <SubmissionDataGrid
            submissionFeatures={animals || []}
            title="ANIMAL FEATURES"
            onRowSelection={(ids) => {
              handleRowSelection('animals', ids);
            }}
          />
        </Box>
        <Box py={2}>
          <SubmissionDataGrid
            submissionFeatures={observations || []}
            title="OBSERVATIONS FEATURES"
            onRowSelection={(ids) => {
              handleRowSelection('observations', ids);
            }}
          />
        </Box>
      </Container>
    </Box>
  );
};

export default AdminSubmissionPage;
