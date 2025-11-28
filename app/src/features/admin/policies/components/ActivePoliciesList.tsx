import { mdiDotsVertical, mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import EditDialog from 'components/dialog/EditDialog';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IAddPolicyFormValues, IPolicy } from 'interfaces/usePoliciesApi.interface';
import { useState } from 'react';
import { handleChangePage, handleChangeRowsPerPage } from 'utils/tablePaginationUtils';
import { v4 as uuidv4 } from 'uuid';
import AddPolicyForm, { AddPolicyFormInitialValues, AddPolicyFormYupSchema } from './AddPolicyForm';

const useStyles = () => {
  return {
    table: {
      '& td': {
        verticalAlign: 'middle'
      }
    }
  };
};

export interface IActivePoliciesListProps {
  policies: IPolicy[];
  refresh: () => void;
}

/**
 * Table to display a list of policies.
 *
 * @param {*} props
 * @return {*}
 */
const ActivePoliciesList: React.FC<React.PropsWithChildren<IActivePoliciesListProps>> = (props) => {
  const classes = useStyles();
  const biohubApi = useApi();
  const { policies } = props;

  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [page, setPage] = useState(0);
  const dialogContext = useDialogContext();

  const [openAddPolicyDialog, setOpenAddPolicyDialog] = useState(false);
  const [openEditPolicyDialog, setOpenEditPolicyDialog] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<IPolicy | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  const handleDeletePolicyClick = (row: IPolicy) => {
    dialogContext.setYesNoDialog({
      dialogTitle: 'Delete policy?',
      dialogContent: (
        <Typography variant="body1" component="div" color="textSecondary">
          Deleting policy <strong>{row.name}</strong> will remove it permanently. Are you sure you want to proceed?
        </Typography>
      ),
      yesButtonLabel: 'Delete Policy',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      open: true,
      onYes: () => {
        deletePolicy(row).then(() => {
          dialogContext.setYesNoDialog({ open: false });
        });
      }
    });
  };

  const deletePolicy = async (policy: IPolicy) => {
    if (!policy?.policy_id) {
      return;
    }
    try {
      await biohubApi.policies.deletePolicy(policy.policy_id);

      showSnackBar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Policy <strong>{policy.name}</strong> deleted.
          </Typography>
        ),
        open: true
      });

      props.refresh();
    } catch (error) {
      const apiError = error as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Error Deleting Policy',
        dialogText: 'An error occurred while deleting the policy.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => {
          dialogContext.setErrorDialog({ open: false });
        },
        onOk: () => {
          dialogContext.setErrorDialog({ open: false });
        }
      });
    }
  };

  const handleEditPolicyClick = (row: IPolicy) => {
    setEditingPolicy(row);
    setOpenEditPolicyDialog(true);
  };

  const handleAddPolicySave = async (values: IAddPolicyFormValues) => {
    setIsLoading(true);

    try {
      await biohubApi.policies.createPolicy({
        name: values.name,
        description: values.description || undefined,
        statements: values.statements
      });

      setOpenAddPolicyDialog(false);
      props.refresh();

      showSnackBar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Policy <strong>{values.name}</strong> created.
          </Typography>
        )
      });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Error Creating Policy',
        dialogText: 'An error occurred while creating the policy.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => {
          dialogContext.setErrorDialog({ open: false });
        },
        onOk: () => {
          dialogContext.setErrorDialog({ open: false });
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditPolicySave = async (values: IAddPolicyFormValues) => {
    if (!editingPolicy) {
      return;
    }

    setIsLoading(true);

    try {
      await biohubApi.policies.updatePolicy(editingPolicy.policy_id, {
        name: values.name,
        description: values.description || undefined,
        statements: values.statements
      });

      setOpenEditPolicyDialog(false);
      setEditingPolicy(null);
      props.refresh();

      showSnackBar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Policy <strong>{values.name}</strong> updated.
          </Typography>
        )
      });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Error Updating Policy',
        dialogText: 'An error occurred while updating the policy.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => {
          dialogContext.setErrorDialog({ open: false });
        },
        onOk: () => {
          dialogContext.setErrorDialog({ open: false });
        }
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getEditPolicyInitialValues = (): IAddPolicyFormValues => {
    if (!editingPolicy) {
      return AddPolicyFormInitialValues;
    }
    return {
      name: editingPolicy.name,
      description: editingPolicy.description || '',
      statements: editingPolicy.statements.map((s) => ({
        _key: uuidv4(),
        effect: s.effect,
        submission_feature_urn: s.submission_feature_urn
      }))
    };
  };

  return (
    <>
      <Container maxWidth="xl">
        <Box mb={6} display="flex" justifyContent="space-between" alignItems="center">
          <Typography
            variant="h1"
            sx={{
              mt: -2
            }}>
            Manage Policies
          </Typography>
          <Button
            size="large"
            color="primary"
            variant="contained"
            data-testid="add-policy-button"
            aria-label={'Add Policy'}
            startIcon={<Icon path={mdiPlus} size={1} />}
            onClick={() => setOpenAddPolicyDialog(true)}
            sx={{
              mt: -2,
              fontWeight: 700
            }}>
            Add Policy
          </Button>
        </Box>
        <Paper>
          <Toolbar
            sx={{
              pl: { sm: 2 },
              pr: { xs: 1, sm: 1 }
            }}>
            <Typography variant="h4" component="h2">
              Active Policies{' '}
              <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
                ({policies?.length || 0})
              </Typography>
            </Typography>
          </Toolbar>
          <TableContainer>
            <Table sx={classes.table}>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Statements</TableCell>
                  <TableCell align="center" width="100">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody data-testid="active-policies-table">
                {!policies?.length && (
                  <TableRow data-testid={'active-policies-row-0'}>
                    <TableCell colSpan={4} style={{ textAlign: 'center' }}>
                      No Policies
                    </TableCell>
                  </TableRow>
                )}
                {policies.length > 0 &&
                  policies.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((row, index) => (
                    <TableRow data-testid={`active-policy-row-${index}`} key={row.policy_id}>
                      <TableCell>{row.name}</TableCell>
                      <TableCell>{row.description || '-'}</TableCell>
                      <TableCell>
                        <Box display="flex" gap={1} flexWrap="wrap">
                          {row.statements.length === 0 && '-'}
                          {row.statements.map((statement) => (
                            <Chip
                              key={statement.policy_statement_id}
                              size="small"
                              label={`${statement.effect}: ${statement.submission_feature_urn}`}
                              color={statement.effect === 'allow' ? 'success' : 'error'}
                              variant="outlined"
                            />
                          ))}
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Box>
                          <CustomMenuIconButton
                            buttonTitle="Actions"
                            buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
                            menuItems={[
                              {
                                menuIcon: <Icon path={mdiPencilOutline} size={0.875} />,
                                menuLabel: 'Edit policy',
                                menuOnClick: () => handleEditPolicyClick(row)
                              },
                              {
                                menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
                                menuLabel: 'Delete policy',
                                menuOnClick: () => handleDeletePolicyClick(row)
                              }
                            ]}
                          />
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </TableContainer>
          {policies?.length > 0 && (
            <TablePagination
              rowsPerPageOptions={[50, 100, 200]}
              component="div"
              count={policies.length}
              rowsPerPage={rowsPerPage}
              page={page}
              onPageChange={(event: unknown, newPage: number) => handleChangePage(event, newPage, setPage)}
              onRowsPerPageChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                handleChangeRowsPerPage(event, setPage, setRowsPerPage)
              }
            />
          )}
        </Paper>
      </Container>

      <EditDialog
        isLoading={isLoading}
        dialogTitle={'Add Policy'}
        open={openAddPolicyDialog}
        dialogSaveButtonLabel={'Create'}
        component={{
          element: <AddPolicyForm />,
          initialValues: AddPolicyFormInitialValues,
          validationSchema: AddPolicyFormYupSchema
        }}
        onCancel={() => setOpenAddPolicyDialog(false)}
        onSave={handleAddPolicySave}
      />

      <EditDialog
        isLoading={isLoading}
        dialogTitle={'Edit Policy'}
        open={openEditPolicyDialog}
        dialogSaveButtonLabel={'Save'}
        component={{
          element: <AddPolicyForm />,
          initialValues: getEditPolicyInitialValues(),
          validationSchema: AddPolicyFormYupSchema
        }}
        onCancel={() => {
          setOpenEditPolicyDialog(false);
          setEditingPolicy(null);
        }}
        onSave={handleEditPolicySave}
      />
    </>
  );
};

export default ActivePoliciesList;
