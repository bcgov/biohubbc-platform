import { Alert, Box, Button, Container, Paper, Typography } from '@mui/material';
import { Formik, FormikProps } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { SecondaryButton } from 'components/button/SecondaryButton';
import DataRequestForm from './form/DataRequestForm';
import {
  IDataRequestFormValues,
  dataRequestFormInitialValues,
  dataRequestFormYupSchema
} from './form/DatatRequestForm.interface';

export const DataRequestPage = () => {
  const api = useApi();
  const dialogContext = useDialogContext();
  const formikRef = useRef<FormikProps<IDataRequestFormValues>>(null);
  const [searchParams] = useSearchParams();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (values: IDataRequestFormValues) => {
    setIsLoading(true);
    try {
      await api.dataRequest.createDataRequest({ reason: values.reason });
      setIsSubmitted(true);
    } catch (error) {
      dialogContext.setErrorDialog({
        dialogTitle: 'An Error Occurred',
        dialogText: (error as APIError).message ?? 'An unexpected error occurred. Please try again.',
        open: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSubmitted) {
    return (
      <Container maxWidth="sm" sx={{ py: 6 }}>
        <Paper sx={{ p: 4 }}>
          <Alert severity="success" sx={{ mb: 2 }}>
            Your request has been submitted. You will be notified when it is approved.
          </Alert>
          <Button variant="outlined" href={`/search/list?${searchParams.toString()}`}>
            Back to search results
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h2" sx={{ mb: 1 }}>
          Data Request
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          You are requesting access to secured records. Please describe why you need access to this data.
        </Typography>

        <Formik
          innerRef={formikRef}
          initialValues={dataRequestFormInitialValues}
          validationSchema={dataRequestFormYupSchema}
          validateOnBlur
          validateOnChange={false}
          onSubmit={handleSubmit}>
          <>
            <DataRequestForm />
            <Box display="flex" gap={1}>
              <PrimaryButton loading={isLoading} onClick={() => formikRef.current?.submitForm()}>
                Submit Request
              </PrimaryButton>
              <SecondaryButton href={`/search/list?${searchParams.toString()}`}>Cancel</SecondaryButton>
            </Box>
          </>
        </Formik>
      </Paper>
    </Container>
  );
};
