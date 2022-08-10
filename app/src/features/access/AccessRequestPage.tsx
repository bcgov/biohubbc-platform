import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import { makeStyles } from '@mui/styles';
import Typography from '@mui/material/Typography';
import { IErrorDialogProps } from 'components/dialog/ErrorDialog';
import { AccessRequestI18N } from 'constants/i18n';
import { AuthStateContext } from 'contexts/authStateContext';
import { DialogContext } from 'contexts/dialogContext';
import { Formik } from 'formik';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { SYSTEM_IDENTITY_SOURCE } from 'hooks/useKeycloakWrapper';
import { IGetRoles } from 'interfaces/useAdminApi.interface';
import React, { useContext, useState } from 'react';
import { Redirect, useHistory } from 'react-router';
import BCeIDRequestForm, { BCeIDRequestFormInitialValues, BCeIDRequestFormYupSchema } from './BCeIDRequestForm';
import IDIRRequestForm, { IDIRRequestFormInitialValues, IDIRRequestFormYupSchema } from './IDIRRequestForm';

const useStyles = makeStyles(() => ({
  actionButton: {
    minWidth: '6rem',
    '& + button': {
      marginLeft: '0.5rem'
    }
  }
}));

interface IAccessRequestForm {
  role: number;
  comments: string;
}

/**
 * Access Request form
 *
 * @return {*}
 */
export const AccessRequestPage: React.FC<React.PropsWithChildren> = () => {
  const classes = useStyles();
  const biohubApi = useApi();
  const history = useHistory();

  const { keycloakWrapper } = useContext(AuthStateContext);

  const dialogContext = useContext(DialogContext);

  const rolesDataLoader = useDataLoader(() => {
    return biohubApi.user.getRoles();
  });

  rolesDataLoader.load();

  let systemRoles: IGetRoles[] = [];
  if (rolesDataLoader.data) {
    systemRoles = rolesDataLoader.data;
  }

  const defaultErrorDialogProps = {
    dialogTitle: AccessRequestI18N.requestTitle,
    dialogText: AccessRequestI18N.requestText,
    open: false,
    onClose: () => {
      dialogContext.setErrorDialog({ open: false });
    },
    onOk: () => {
      dialogContext.setErrorDialog({ open: false });
    }
  };

  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  const showAccessRequestErrorDialog = (textDialogProps?: Partial<IErrorDialogProps>) => {
    dialogContext.setErrorDialog({
      ...defaultErrorDialogProps,
      dialogTitle: AccessRequestI18N.requestTitle,
      dialogText: AccessRequestI18N.requestText,
      ...textDialogProps,
      open: true
    });
  };

  const handleSubmitAccessRequest = async (values: IAccessRequestForm) => {
    try {
      const response = await biohubApi.admin.createAdministrativeActivity({
        ...values,
        name: keycloakWrapper?.displayName,
        username: keycloakWrapper?.getUserIdentifier(),
        email: keycloakWrapper?.email,
        identitySource: keycloakWrapper?.getIdentitySource()
      });

      if (!response?.id) {
        showAccessRequestErrorDialog({
          dialogError: 'The response from the server was null.'
        });
        return;
      }
      setIsSubmittingRequest(false);

      keycloakWrapper?.refresh();

      history.push('/request-submitted');
    } catch (error) {
      const apiError = error as APIError;

      showAccessRequestErrorDialog({
        dialogError: apiError?.message,
        dialogErrorDetails: apiError?.errors
      });

      setIsSubmittingRequest(false);
    }
  };

  if (!keycloakWrapper?.keycloak?.authenticated) {
    // User is not logged in
    return <Redirect to={{ pathname: '/' }} />;
  }

  if (!keycloakWrapper.hasLoadedAllUserInfo) {
    // User data has not been loaded, can not yet determine if they have a role
    return <CircularProgress className="pageProgress" />;
  }

  if (keycloakWrapper?.hasAccessRequest) {
    // User already has a pending access request
    return <Redirect to={{ pathname: '/request-submitted' }} />;
  }

  let initialValues: any;
  let validationSchema: any;
  let requestForm: any;
  if (keycloakWrapper?.getIdentitySource() === SYSTEM_IDENTITY_SOURCE.BCEID) {
    initialValues = BCeIDRequestFormInitialValues;
    validationSchema = BCeIDRequestFormYupSchema;
    requestForm = <BCeIDRequestForm />;
  } else {
    initialValues = IDIRRequestFormInitialValues;
    validationSchema = IDIRRequestFormYupSchema;
    requestForm = <IDIRRequestForm roles={systemRoles} />;
  }

  return (
    <Box p={4}>
      <Container maxWidth="md">
        <Formik
          initialValues={initialValues}
          validationSchema={validationSchema}
          validateOnBlur={true}
          validateOnChange={false}
          onSubmit={(values) => {
            setIsSubmittingRequest(true);
            handleSubmitAccessRequest(values);
          }}>
          {({ handleSubmit }) => (
            <Box component={Paper} p={3}>
              <Typography variant="h1">Request Access</Typography>
              <Box mt={3}>
                <Typography variant="body1" color="textSecondary">
                  You will need to provide some additional details before accessing this application.
                </Typography>
              </Box>
              <Box mt={4}>
                <form onSubmit={handleSubmit}>
                  {requestForm}
                  <Box mt={4} display="flex" justifyContent="flex-end">
                    <Box className="buttonWrapper" mr={1}>
                      <Button
                        type="submit"
                        variant="contained"
                        color="primary"
                        className={classes.actionButton}
                        disabled={isSubmittingRequest}>
                        <strong>Submit Request</strong>
                      </Button>
                      {isSubmittingRequest && (
                        <CircularProgress
                          className="buttonProgress"
                          variant="indeterminate"
                          size={20}
                          color="primary"
                        />
                      )}
                    </Box>
                    {/*
                      CircularProgress styling examples:
                      https://codesandbox.io/s/wonderful-cartwright-e18nc?file=/demo.tsx:895-1013
                      https://menubar.io/creating-a-material-ui-button-with-spinner-that-reflects-loading-state
                    */}
                    <Button
                      variant="outlined"
                      color="primary"
                      onClick={() => {
                        history.push('/logout');
                      }}
                      className={classes.actionButton}
                      data-testid="logout-button">
                      Log out
                    </Button>
                  </Box>
                </form>
              </Box>
            </Box>
          )}
        </Formik>
      </Container>
    </Box>
  );
};

export default AccessRequestPage;
