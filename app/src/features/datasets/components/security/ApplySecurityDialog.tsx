import { mdiInformationOutline, mdiLock } from '@mdi/js';
import Icon from '@mdi/react';
import LoadingButton from '@mui/lab/LoadingButton';
import { Box, Divider, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import YesNoDialog from 'components/dialog/YesNoDialog';
import { ApplySecurityRulesI18N } from 'constants/i18n';
import { DialogContext, ISnackbarProps } from 'contexts/dialogContext';
import { Formik, FormikProps } from 'formik';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IArtifact, IPersecutionAndHarmRule } from 'interfaces/useDatasetApi.interface';
import React, { useContext, useRef, useState } from 'react';
import { pluralize as p } from 'utils/Utils';
import yup from 'utils/YupSchema';
import { ISecurityReason } from './SecurityReasonCategory';
import SecurityReasonSelector from './SecurityReasonSelector';
import SelectedDocumentsDataset from './SelectedDocumentsDataset';

export interface IApplySecurityDialog {
  selectedArtifacts: IArtifact[];
  open: boolean;
  onClose: () => void;
}

export interface ISelectSecurityReasonForm {
  securityReasons: ISecurityReason[];
}

export const SecurityReasonsYupSchema = yup.object().shape({
  securityReasons: yup.array().of(
    yup.object().shape({
      name: yup.string(),
      description: yup.string(),
      category: yup.string(),
      id: yup.number(),
      type_id: yup.number(),
      wldtaxonomic_units_id: yup.number()
    })
  )
});

/**
 * Publish button.
 *
 * @return {*}
 */
const ApplySecurityDialog: React.FC<IApplySecurityDialog> = (props) => {
  const { selectedArtifacts, open, onClose } = props;

  const [yesNoDialogOpen, setYesNoDialogOpen] = useState<boolean>(false);
  const [isPendingApplySecurity, setIsPendingApplySecurity] = useState<boolean>(false);
  const [isPendingUnapplySecurity, setIsPendingUnapplySecurity] = useState<boolean>(false);
  const [formikRef] = useState(useRef<FormikProps<any>>(null));

  const biohubApi = useApi();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down('xl'));
  const dialogContext = useContext(DialogContext);

  const persecutionHarmDataLoader = useDataLoader(() => biohubApi.security.listPersecutionHarmRules());
  persecutionHarmDataLoader.load();

  const persecutionHarmRules: ISecurityReason[] = (persecutionHarmDataLoader.data ?? []).map((rule) => {
    return {
      category: 'Persecution or Harm',
      name: rule.name,
      description: rule.description,
      id: rule.persecution_or_harm_id,
      type_id: rule.persecution_or_harm_type_id,
      wldtaxonomic_units_id: rule.wldtaxonomic_units_id
    };
  });

  const initialSecurityReasons: ISecurityReason[] = props.selectedArtifacts
    // Find IDs of all applied security reasons
    .reduce((securityRuleIds: number[], artifact: IArtifact) => {
      const appliedSecurityReasons = artifact.supplementaryData.persecutionAndHarmRules.map(
        (rule: IPersecutionAndHarmRule) => rule.persecution_or_harm_id
      );

      return [...securityRuleIds, ...appliedSecurityReasons];
    }, [])

    // Filter duplicate IDs
    .filter((value, index, array) => array.indexOf(value) === index)

    // Map IDs to security rules
    .map((securityRuleId: number) => {
      return persecutionHarmRules.find((persecutionAndHarmRule) => persecutionAndHarmRule.id === securityRuleId);
    })

    // Filter missing security rules
    .filter((value): value is ISecurityReason => Boolean(value));

  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  const handleSubmit = async (values: { securityReasons: ISecurityReason[] }) => {
    if (values.securityReasons.length > 0) {
      setIsPendingApplySecurity(true);
    } else {
      setIsPendingUnapplySecurity(true);
    }

    return biohubApi.security.applySecurityReasonsToArtifacts(selectedArtifacts, values.securityReasons).finally(() => {
      setIsPendingApplySecurity(false);
      setIsPendingUnapplySecurity(false);
    });
  };

  const handleShowSnackBar = (message: string) => {
    showSnackBar({
      snackbarMessage: (
        <>
          <Typography variant="body2" component="div">
            {message}
          </Typography>
        </>
      ),
      open: true
    });
  };

  return (
    <>
      <Dialog
        fullScreen={fullScreen}
        maxWidth="xl"
        open={open}
        aria-labelledby="component-dialog-title"
        aria-describedby="component-dialog-description"
        PaperProps={{
          sx: {
            width: '100%',
            height: '100%'
          }
        }}>
        <Formik<ISelectSecurityReasonForm>
          innerRef={formikRef}
          initialValues={{
            securityReasons: initialSecurityReasons
          }}
          validationSchema={SecurityReasonsYupSchema}
          validateOnBlur={true}
          validateOnChange={false}
          onSubmit={async (values) => {
            return handleSubmit(values)
              .then(() => {
                handleShowSnackBar(
                  `You successfully applied security reasons to ${selectedArtifacts.length} ${p(
                    selectedArtifacts.length,
                    'file'
                  )}.`
                );
                onClose();
              })
              .catch((apiError) => {
                dialogContext.setErrorDialog({
                  open: true,
                  dialogTitle: ApplySecurityRulesI18N.applySecurityRulesErrorTitle,
                  dialogText: ApplySecurityRulesI18N.applySecurityRulesErrorText,
                  dialogError: apiError.message,
                  dialogErrorDetails: apiError.errors,
                  onClose: () => {
                    dialogContext.setErrorDialog({ open: false });
                  },
                  onOk: () => {
                    dialogContext.setErrorDialog({ open: false });
                  }
                });
              });
          }}>
          {(formikProps) => (
            <>
              <YesNoDialog
                open={yesNoDialogOpen}
                onClose={() => setYesNoDialogOpen(false)}
                onYes={() => {
                  handleSubmit({ securityReasons: [] })
                    .then(() => {
                      handleShowSnackBar(
                        `You successfully unsecured ${selectedArtifacts.length} ${p(selectedArtifacts.length, 'file')}.`
                      );
                      onClose();
                    })
                    .catch((apiError) => {
                      dialogContext.setErrorDialog({
                        open: true,
                        dialogTitle: ApplySecurityRulesI18N.unapplySecurityRulesErrorTitle,
                        dialogText: ApplySecurityRulesI18N.unapplySecurityRulesErrorText,
                        dialogError: apiError.message,
                        dialogErrorDetails: apiError.errors,
                        onClose: () => {
                          dialogContext.setErrorDialog({ open: false });
                        },
                        onOk: () => {
                          dialogContext.setErrorDialog({ open: false });
                        }
                      });
                    })
                    .finally(() => {
                      setYesNoDialogOpen(false);
                    });
                }}
                yesButtonProps={{ loading: isPendingUnapplySecurity }}
                onNo={() => setYesNoDialogOpen(false)}
                dialogTitle=""
                dialogText=""
                dialogContent={
                  <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column', alignContent: 'center' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'row', justifyContent: 'center' }}>
                      <Icon path={mdiInformationOutline} size={5} color={'#a12622'} />
                    </Box>
                    <DialogTitle id="component-dialog-title" align={'center'}>
                      Warning
                    </DialogTitle>
                    <DialogContentText id="alert-dialog-description" align={'center'} sx={{ py: 2 }}>
                      You are going to make this document available to the public. This document can be downloaded.
                      Also, if there are any security reasons, they will be removed.
                    </DialogContentText>
                    <DialogContentText id="alert-dialog-description" align={'center'}>
                      <strong>Are you sure you would like to proceed?</strong>
                    </DialogContentText>
                  </Box>
                }
              />

              <DialogTitle id="component-dialog-title">Apply Security Reasons</DialogTitle>
              <DialogContent sx={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <DialogContentText id="alert-dialog-description">
                  {`Search for the security reasons and apply them to the selected ${p(
                    selectedArtifacts.length,
                    'document'
                  )}`}
                </DialogContentText>

                <SelectedDocumentsDataset selectedArtifacts={selectedArtifacts} />

                <SecurityReasonSelector securityReasons={persecutionHarmRules} />
              </DialogContent>
              <Divider />
              <DialogActions>
                <LoadingButton
                  loading={isPendingApplySecurity}
                  title="Apply Security Rules"
                  variant="contained"
                  color="primary"
                  disabled={formikProps.values.securityReasons.length === 0}
                  startIcon={<Icon path={mdiLock} size={1} />}
                  onClick={formikProps.submitForm}>
                  Apply Security
                </LoadingButton>

                <Button
                  title="No Security Required"
                  variant="contained"
                  color="primary"
                  startIcon={<Icon path={mdiLock} size={1} />}
                  onClick={() => {
                    setYesNoDialogOpen(true);
                  }}
                  disabled={isPendingApplySecurity}>
                  No Security Required
                </Button>
                <Button
                  onClick={onClose}
                  color="primary"
                  variant="outlined"
                  autoFocus
                  disabled={isPendingApplySecurity}>
                  Cancel
                </Button>
              </DialogActions>
            </>
          )}
        </Formik>
      </Dialog>
    </>
  );
};

export default ApplySecurityDialog;
