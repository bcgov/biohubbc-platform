import { mdiDotsVertical, mdiMagnify, mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import EditDialog from 'components/dialog/EditDialog';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { useState } from 'react';
import { handleChangePage, handleChangeRowsPerPage } from 'utils/tablePaginationUtils';
import {
  AddPolicyForm,
  AddPolicyFormInitialValues,
  AddPolicyFormYupSchema,
  IAddPolicyFormValues
} from './AddPolicyForm';
import { parsePolicyError } from '../utils/policyErrorParser';
import { transformApiToPolicyJson, transformPolicyJsonToApi } from '../utils/policyTransform';

const useStyles = () => {
  return {
    table: {
      '& td': {
        verticalAlign: 'middle'
      }
    }
  };
};

/**
 * Props for the ActivePoliciesList component.
 */
export interface IActivePoliciesListProps {
  /** Array of policies to display in the table */
  policies: IPolicy[];
  /** Callback to refresh the policies list after create/update/delete */
  refresh: () => void;
  /** Current search term for filtering policies */
  searchTerm: string;
  /** Callback when search term changes */
  onSearch: (term: string) => void;
}

/**
 * Table component to display and manage a list of policies.
 *
 * Provides functionality to:
 * - View policies in a paginated table
 * - Search policies by name
 * - Create new policies via dialog
 * - Edit existing policies via dialog
 * - Delete policies with confirmation
 *
 * @param {IActivePoliciesListProps} props - Component props
 * @returns {React.ReactElement} The policies list component
 */
export const ActivePoliciesList: React.FC<React.PropsWithChildren<IActivePoliciesListProps>> = (props) => {
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

  /**
   * Display a snackbar notification with the given props.
   *
   * @param {Partial<ISnackbarProps>} [textDialogProps] - Optional snackbar configuration
   */
  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  /**
   * Open a confirmation dialog to delete a policy.
   *
   * @param {IPolicy} row - The policy to delete
   */
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

  /**
   * Delete a policy via API and show success/error feedback.
   *
   * @param {IPolicy} policy - The policy to delete
   * @returns {Promise<void>}
   */
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

  /**
   * Open the edit dialog for a policy.
   *
   * @param {IPolicy} row - The policy to edit
   */
  const handleEditPolicyClick = (row: IPolicy) => {
    setEditingPolicy(row);
    setOpenEditPolicyDialog(true);
  };

  /**
   * Handle saving a new policy from the add dialog.
   *
   * Transforms the form values to API format and creates the policy.
   * Shows success snackbar or error dialog based on result.
   *
   * @param {IAddPolicyFormValues} values - Form values from the add policy dialog
   * @returns {Promise<void>}
   */
  const handleAddPolicySave = async (values: IAddPolicyFormValues) => {
    setIsLoading(true);

    try {
      const statements = transformPolicyJsonToApi(values.policy_json);

      await biohubApi.policies.createPolicy({
        name: values.name,
        description: values.description || undefined,
        statements
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
      const parsedError = parsePolicyError(apiError);

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: parsedError.title,
        dialogText: parsedError.message,
        dialogError: parsedError.suggestion,
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

  /**
   * Handle saving an edited policy from the edit dialog.
   *
   * Transforms the form values to API format and updates the policy.
   * Shows success snackbar or error dialog based on result.
   *
   * @param {IAddPolicyFormValues} values - Form values from the edit policy dialog
   * @returns {Promise<void>}
   */
  const handleEditPolicySave = async (values: IAddPolicyFormValues) => {
    if (!editingPolicy) {
      return;
    }

    setIsLoading(true);

    try {
      const statements = transformPolicyJsonToApi(values.policy_json);

      await biohubApi.policies.updatePolicy(editingPolicy.policy_id, {
        name: values.name,
        description: values.description || undefined,
        statements
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
      const parsedError = parsePolicyError(apiError);

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: parsedError.title,
        dialogText: parsedError.message,
        dialogError: parsedError.suggestion,
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

  /**
   * Get initial form values for the edit policy dialog.
   *
   * Transforms the policy's API format to form format for editing.
   *
   * @returns {IAddPolicyFormValues} Form values pre-populated with the editing policy's data
   */
  const getEditPolicyInitialValues = (): IAddPolicyFormValues => {
    if (!editingPolicy) {
      return AddPolicyFormInitialValues;
    }
    return {
      name: editingPolicy.name,
      description: editingPolicy.description || '',
      policy_json: transformApiToPolicyJson(editingPolicy.statements)
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
              pr: { xs: 1, sm: 1 },
              display: 'flex',
              justifyContent: 'space-between'
            }}>
            <Typography variant="h4" component="h2">
              Active Policies{' '}
              <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
                ({policies?.length || 0})
              </Typography>
            </Typography>
            <TextField
              size="small"
              placeholder="Search by policy name"
              value={props.searchTerm}
              onChange={(e) => props.onSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <Icon path={mdiMagnify} size={0.875} />
                    </InputAdornment>
                  )
                }
              }}
              sx={{ width: 300 }}
            />
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
