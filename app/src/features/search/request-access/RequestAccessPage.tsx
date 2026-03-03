import { Alert, Box, Button, Container, Paper, Typography } from '@mui/material';
import { Formik, FormikProps } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { URL_PARAMS } from 'constants/query-params';
import { PrimaryButton } from 'components/button/PrimaryButton';
import { SecondaryButton } from 'components/button/SecondaryButton';
import RequestAccessForm, {
  IRequestAccessFormValues,
  requestAccessFormInitialValues,
  requestAccessFormYupSchema
} from './RequestAccessForm';

export const RequestAccessPage = () => {
  const api = useApi();
  const formikRef = useRef<FormikProps<IRequestAccessFormValues>>(null);
  const [searchParams] = useSearchParams();
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (values: IRequestAccessFormValues) => {
    setIsLoading(true);
    setSubmitError(null);
    try {
      await api.dataRequest.createDataRequest({ reason: values.reason });
      setIsSubmitted(true);
    } catch (error) {
      setSubmitError((error as APIError).message ?? 'An unexpected error occurred. Please try again.');
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
        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }} onClose={() => setSubmitError(null)}>
            {submitError}
          </Alert>
        )}
        <Typography variant="h2" sx={{ mb: 1 }}>
          Request Access
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
          You are requesting access to secured records. Please describe why you need access to this data.
        </Typography>

        <Formik
          innerRef={formikRef}
          initialValues={requestAccessFormInitialValues}
          validationSchema={requestAccessFormYupSchema}
          validateOnBlur
          validateOnChange={false}
          onSubmit={handleSubmit}>
          <>
            <RequestAccessForm />
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
