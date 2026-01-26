import { mdiDotsVertical, mdiMagnify, mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { DataGrid, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import EditDialog from 'components/dialog/EditDialog';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { IServerPaginationProps } from 'types/pagination';
import { useState } from 'react';
import {
  AddPolicyForm,
  AddPolicyFormInitialValues,
  AddPolicyFormYupSchema,
  IAddPolicyFormValues
} from './AddPolicyForm';
import { transformApiToPolicyJson, transformPolicyJsonToApi } from '../utils/policyTransform';

/**
 * Props for the ActivePoliciesList component.
 */
export interface IActivePoliciesListProps extends IServerPaginationProps {
  /** Array of policies to display in the table */
  policies: IPolicy[];
  /** Callback to refresh the policies list after create/update/delete */
  refresh: () => void;
  /** Current search term for filtering policies */
  searchTerm: string;
  /** Callback when search term changes */
  onSearch: (term: string) => void;
  /** Currently selected policy ID for filtering team-policy assignments */
  selectedPolicyId: string | null;
  /** Callback when a policy row is selected/deselected */
  onSelectPolicy: (policyId: string | null) => void;
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
  const biohubApi = useApi();
  const {
    policies,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    selectedPolicyId,
    onSelectPolicy
  } = props;

  /**
   * Handle row selection changes in the DataGrid.
   * Extracts the selected policy ID and calls the parent callback.
   *
   * @param {GridRowSelectionModel} model - The new selection model from DataGrid
   */
  const handleRowSelectionChange = (model: GridRowSelectionModel) => {
    const ids = model && 'ids' in model ? Array.from(model.ids) : [];
    const newSelectedId = (ids[0] as string) || null;
    onSelectPolicy(newSelectedId);
  };

  // Convert selectedPolicyId to DataGrid selection model format
  const rowSelectionModel: GridRowSelectionModel = {
    type: 'include',
    ids: selectedPolicyId ? new Set([selectedPolicyId]) : new Set()
  };

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

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Create Policy',
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

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Update Policy',
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

  const columns: GridColDef<IPolicy>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 1,
      minWidth: 200,
      valueGetter: (value) => value || '-'
    },
    {
      field: 'statements',
      headerName: 'Statements',
      flex: 2,
      minWidth: 300,
      sortable: false,
      renderCell: (params) => (
        <Box display="flex" gap={1} flexWrap="wrap" alignItems="center" height="100%">
          {params.row.statements.length === 0 && '-'}
          {params.row.statements.map((statement) => (
            <Chip
              key={statement.policy_statement_id}
              size="small"
              label={`${statement.effect}: ${statement.submission_feature_urn}`}
              color={statement.effect === 'allow' ? 'success' : 'error'}
              variant="outlined"
            />
          ))}
        </Box>
      )
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 100,
      sortable: false,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <CustomMenuIconButton
          buttonTitle="Actions"
          buttonIcon={<Icon path={mdiDotsVertical} size={1} />}
          menuItems={[
            {
              menuIcon: <Icon path={mdiPencilOutline} size={0.875} />,
              menuLabel: 'Edit policy',
              menuOnClick: () => handleEditPolicyClick(params.row)
            },
            {
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuLabel: 'Delete policy',
              menuOnClick: () => handleDeletePolicyClick(params.row)
            }
          ]}
        />
      )
    }
  ];

  return (
    <>
      <Container maxWidth="xl">
        <Box mb={6}>
          <Typography variant="h1">Manage Policies</Typography>
        </Box>
        <Paper>
          <Toolbar disableGutters sx={{ px: 2 }}>
            <Typography variant="h4" component="h2" flexGrow={1}>
              Active Policies{' '}
              <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
                ({rowCount})
              </Typography>
            </Typography>
            <Stack gap={1} direction="row" alignItems="center">
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
                sx={{ width: 250 }}
              />
              <Button
                variant="contained"
                color="primary"
                data-testid="add-policy-button"
                startIcon={<Icon path={mdiPlus} size={0.8} />}
                onClick={() => setOpenAddPolicyDialog(true)}>
                Add
              </Button>
            </Stack>
          </Toolbar>

          <Divider flexItem />

          <DataGrid
            data-testid="active-policies-table"
            rows={policies}
            columns={columns}
            getRowId={(row) => row.policy_id}
            paginationMode="server"
            paginationModel={paginationModel}
            onPaginationModelChange={setPaginationModel}
            pageSizeOptions={[10, 25, 50]}
            sortingMode="server"
            sortingOrder={['asc', 'desc']}
            sortModel={sortModel}
            onSortModelChange={setSortModel}
            rowCount={rowCount}
            rowSelectionModel={rowSelectionModel}
            onRowSelectionModelChange={handleRowSelectionChange}
            checkboxSelection
            disableMultipleRowSelection
            disableColumnSelector
            disableColumnMenu
            localeText={{ noRowsLabel: 'No Policies' }}
            sx={{
              border: 'none',
              '& .MuiDataGrid-columnHeaderTitle': {
                fontWeight: 700,
                textTransform: 'uppercase'
              },
              '& .MuiDataGrid-row.Mui-selected': {
                backgroundColor: 'action.selected'
              },
              '& .MuiDataGrid-row.Mui-selected:hover': {
                backgroundColor: 'action.selected'
              }
            }}
          />
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
