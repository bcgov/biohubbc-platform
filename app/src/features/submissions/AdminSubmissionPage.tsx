import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import { SubmissionContext } from 'contexts/submissionContext';
import { useContext, useState } from 'react';
import CompleteReviewDialog from './components/CompleteReviewDialog';
import ManageSecurityReasonsDialog from './components/ManageSecurityReasonsDialog';
import SubmissionDataGrid from './components/SubmissionDataGrid';
import SubmissionHeader from './components/SubmissionHeader';

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

  const submitSecurity = async (values: any) => {
    console.log('values', values);
  };

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
      <ManageSecurityReasonsDialog
        open={openSecurityReasonsDialog}
        onClose={() => setOpenSecurityReasonsDialog(false)}
        onSubmit={async (values) => {
          setOpenSecurityReasonsDialog(false);
          submitSecurity(values);
        }}
        submissionSuccessDialogTitle="Submission Security Review Submitted"
        submissionSuccessDialogText="Submission security review has been submitted successfully."
        noSubmissionDataDialogTitle="No Submission Data"
        noSubmissionDataDialogText="No submission data found."
      />
      {/* <UnsecureRecordsDialog /> TODO: create unsecure dialog */}
      <SubmissionHeader
        openSecureRecordsDialog={(open: boolean) => {
          setOpenSecurityReasonsDialog(open);
        }}
        openCompleteReviewDialog={(open: boolean) => {
          setOpenCompleteReviewDialog(open);
        }}
        openUnsecureRecordsDialog={(open: boolean) => {
          setOpenSecurityReasonsDialog(open);
        }}
      />
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
