import { mdiDotsVertical, mdiMagnify, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { EditDialog } from 'components/dialog/EditDialog';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { useState } from 'react';
import { IServerPaginationProps } from 'types/pagination';
import { transformApiToPolicyJson, transformPolicyJsonToApi } from '../utils/policyTransform';
import {
  AddPolicyForm,
  AddPolicyFormInitialValues,
  AddPolicyFormYupSchema,
  IAddPolicyFormValues
} from './AddPolicyForm';

/**
 * Props for the PoliciesContainer component.
 */
export interface IPoliciesContainerProps extends IServerPaginationProps {
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
 * @param {IPoliciesContainerProps} props - Component props
 * @returns {React.ReactElement} The policies list component
 */
export const PoliciesContainer = (props: IPoliciesContainerProps) => {
  const biohubApi = useApi();
  const { policies, rowCount, paginationModel, setPaginationModel, sortModel, setSortModel } = props;

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

  const showApiErrorDialog = (title: string, text: string, error: unknown) => {
    const apiError = error as APIError;
    dialogContext.setErrorDialog({
      open: true,
      dialogTitle: title,
      dialogText: text,
      dialogError: apiError.message,
      dialogErrorDetails: apiError.errors,
      onClose: () => {
        dialogContext.setErrorDialog({ open: false });
      },
      onOk: () => {
        dialogContext.setErrorDialog({ open: false });
      }
    });
  };

  const closeDeletePolicyDialog = () => {
    dialogContext.setYesNoDialog({ open: false });
  };

  /**
   * Open a confirmation dialog to delete a policy.
   *
   * @param {IPolicy} row - The policy to delete
   */
  const handleDeletePolicyClick = (row: IPolicy) => {
    const handleConfirmDelete = () => {
      deletePolicy(row);
      closeDeletePolicyDialog();
    };

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
      onClose: closeDeletePolicyDialog,
      onNo: closeDeletePolicyDialog,
      open: true,
      onYes: handleConfirmDelete
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
        snackbarMessage: 'Deleted policy'
      });

      props.refresh();
    } catch (error) {
      showApiErrorDialog('Error Deleting Policy', 'An error occurred while deleting the policy.', error);
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
        snackbarMessage: 'Created policy'
      });
    } catch (error) {
      showApiErrorDialog('Failed to Create Policy', 'An error occurred while creating the policy.', error);
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
        snackbarMessage: 'Updated policy'
      });
    } catch (error) {
      showApiErrorDialog('Failed to Update Policy', 'An error occurred while updating the policy.', error);
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
        <PageSection
          id="policies"
          label={
            <>
              Active Policies{' '}
              <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
                ({rowCount})
              </Typography>
            </>
          }
          onAdd={() => setOpenAddPolicyDialog(true)}
          headerContent={
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
            </Stack>
          }>
          <ServerPaginatedDataGrid<IPolicy>
            dataTestId="active-policies-table"
            rows={policies}
            columns={columns}
            getRowId={(row) => row.policy_id}
            noRowsMessage="No Policies"
            rowCount={rowCount}
            paginationModel={paginationModel}
            setPaginationModel={setPaginationModel}
            sortModel={sortModel}
            setSortModel={setSortModel}
          />
        </PageSection>
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
