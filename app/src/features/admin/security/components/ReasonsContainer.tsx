import { mdiDotsVertical, mdiMagnify, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Chip from '@mui/material/Chip';
import Container from '@mui/material/Container';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { GridColDef } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISecurityReasonWithFeatureCount } from 'interfaces/useSecurityApi.interface';
import { IServerPaginationProps } from 'types/pagination';
import { useState } from 'react';
import { IAddReasonFormValues } from './AddReasonForm';
import { AddReasonFormInitialValues, ReasonDialog } from './ReasonDialog';

export interface IReasonsContainerProps extends IServerPaginationProps {
  reasons: ISecurityReasonWithFeatureCount[];
  /** Callback to refresh the reasons list after create/update/delete */
  refresh: () => void;
  /** Callback to refresh categories so rule_count stays in sync */
  refreshCategories: () => void;
  searchTerm: string;
  onSearch: (term: string) => void;
}

/**
 * Container component for managing security reasons.
 *
 * Provides functionality to:
 * - View reasons in a searchable, paginated table
 * - Create new reasons via ReasonDialog (EditDialog + Formik)
 * - Edit existing reasons via ReasonDialog
 * - Delete reasons with confirmation
 *
 * @param {IReasonsContainerProps} props
 * @returns {React.ReactElement}
 */
export const ReasonsContainer = (props: IReasonsContainerProps) => {
  const {
    reasons,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    refresh,
    refreshCategories,
    searchTerm,
    onSearch
  } = props;

  const biohubApi = useApi();
  const dialogContext = useDialogContext();

  /**
   * Refresh reasons and categories tables after a reason mutation.
   */
  const refreshTables = () => {
    refresh();
    refreshCategories();
  };

  const [openAddReasonDialog, setOpenAddReasonDialog] = useState(false);
  const [openEditReasonDialog, setOpenEditReasonDialog] = useState(false);
  const [editingReason, setEditingReason] = useState<ISecurityReasonWithFeatureCount | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  /**
   * Display API or load errors via the shared error dialog.
   *
   * @param {string} title
   * @param {string} text
   * @param {unknown} error
   */
  const showLoadError = (title: string, text: string, error: unknown) => {
    const apiError = error as APIError;
    dialogContext.setErrorDialog({
      open: true,
      dialogTitle: title,
      dialogText: text,
      dialogError: apiError.message,
      dialogErrorDetails: apiError.errors,
      onClose: () => dialogContext.setErrorDialog({ open: false }),
      onOk: () => dialogContext.setErrorDialog({ open: false })
    });
  };

  /**
   * Open confirmation dialog to delete a security reason.
   *
   * @param {ISecurityReasonWithFeatureCount} reason
   */
  const handleDeleteReasonClick = (reason: ISecurityReasonWithFeatureCount) => {
    dialogContext.setYesNoDialog({
      dialogTitle: 'Delete reason?',
      dialogContent: (
        <Typography variant="body1" component="div" color="textSecondary">
          Deleting reason <strong>{reason.name}</strong> will remove it permanently. Are you sure you want to proceed?
        </Typography>
      ),
      yesButtonLabel: 'Delete Reason',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: () => dialogContext.setYesNoDialog({ open: false }),
      onNo: () => dialogContext.setYesNoDialog({ open: false }),
      open: true,
      onYes: () => {
        dialogContext.setYesNoDialog({ open: false });
        deleteReason(reason);
      }
    });
  };

  /**
   * Delete a security reason via API.
   *
   * @param {ISecurityReasonWithFeatureCount} reason
   * @returns {Promise<void>}
   */
  const deleteReason = async (reason: ISecurityReasonWithFeatureCount) => {
    try {
      await biohubApi.security.deleteSecurityReason(reason.security_rule_id);
      showSnackBar({ snackbarMessage: 'Deleted reason' });
      refreshTables();
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Error Deleting Reason',
        dialogText: 'An error occurred while deleting the reason.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        onOk: () => dialogContext.setErrorDialog({ open: false })
      });
    }
  };

  /**
   * Open the edit dialog for a security reason.
   *
   * @param {ISecurityReasonWithFeatureCount} reason
   */
  const handleEditReasonClick = (reason: ISecurityReasonWithFeatureCount) => {
    setEditingReason(reason);
    setOpenEditReasonDialog(true);
  };

  /**
   * Handle saving a new security reason from the add dialog.
   *
   * @param {IAddReasonFormValues} values
   * @returns {Promise<void>}
   */
  const handleAddReasonSave = async (values: IAddReasonFormValues) => {
    if (!values.security_category_id) {
      return;
    }

    setIsLoading(true);

    try {
      await biohubApi.security.createSecurityReason({
        name: values.name,
        description: values.description,
        security_category_id: values.security_category_id,
        is_active: values.is_active
      });

      setOpenAddReasonDialog(false);
      refreshTables();
      showSnackBar({ snackbarMessage: 'Created reason' });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Create Reason',
        dialogText: 'An error occurred while creating the reason.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        onOk: () => dialogContext.setErrorDialog({ open: false })
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle saving an edited security reason.
   *
   * @param {IAddReasonFormValues} values
   * @returns {Promise<void>}
   */
  const handleEditReasonSave = async (values: IAddReasonFormValues) => {
    if (!editingReason || !values.security_category_id) {
      return;
    }

    setIsLoading(true);

    try {
      await biohubApi.security.updateSecurityReason(editingReason.security_rule_id, {
        name: values.name,
        description: values.description,
        security_category_id: values.security_category_id,
        is_active: values.is_active
      });

      setOpenEditReasonDialog(false);
      setEditingReason(null);
      refreshTables();
      showSnackBar({ snackbarMessage: 'Updated reason' });
    } catch (error) {
      const apiError = error as APIError;
      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Update Reason',
        dialogText: 'An error occurred while updating the reason.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        onOk: () => dialogContext.setErrorDialog({ open: false })
      });
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Get initial form values for the edit dialog.
   *
   * @returns {IAddReasonFormValues}
   */
  const getEditReasonInitialValues = (): IAddReasonFormValues => {
    if (!editingReason) {
      return AddReasonFormInitialValues;
    }

    return {
      name: editingReason.name,
      description: editingReason.description || '',
      security_category_id: editingReason.security_category_id,
      is_active: editingReason.is_active
    };
  };

  const columns: GridColDef<ISecurityReasonWithFeatureCount>[] = [
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'description',
      headerName: 'Description',
      flex: 2,
      minWidth: 200
    },
    {
      field: 'category_name',
      headerName: 'Category',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'is_active',
      headerName: 'Status',
      width: 120,
      align: 'center',
      headerAlign: 'center',
      renderCell: (params) => (
        <Chip
          label={params.value ? 'Active' : 'Inactive'}
          size="small"
          color={params.value ? 'success' : 'default'}
          sx={{ fontWeight: 700 }}
        />
      )
    },
    {
      field: 'feature_count',
      headerName: 'Features',
      width: 120,
      align: 'center',
      headerAlign: 'center'
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
              menuLabel: 'Edit reason',
              menuOnClick: () => handleEditReasonClick(params.row)
            },
            {
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuLabel: 'Delete reason',
              menuOnClick: () => handleDeleteReasonClick(params.row)
            }
          ]}
        />
      )
    }
  ];

  return (
    <Container maxWidth="xl">
      <PageSection
        id="reasons"
        label={
          <>
            Reasons{' '}
            <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setOpenAddReasonDialog(true)}
        headerContent={
          <Stack gap={1} direction="row" alignItems="center">
            <TextField
              size="small"
              placeholder="Search by reason name"
              value={searchTerm}
              onChange={(e) => onSearch(e.target.value)}
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
        <ServerPaginatedDataGrid<ISecurityReasonWithFeatureCount>
          dataTestId="reasons-table"
          rows={reasons}
          columns={columns}
          getRowId={(row) => row.security_rule_id}
          noRowsMessage="No Reasons"
          rowCount={rowCount}
          paginationModel={paginationModel}
          setPaginationModel={setPaginationModel}
          sortModel={sortModel}
          setSortModel={setSortModel}
        />
      </PageSection>

      <ReasonDialog
        open={openAddReasonDialog}
        isLoading={isLoading}
        dialogTitle="Add Reason"
        dialogSaveButtonLabel="Create"
        initialValues={AddReasonFormInitialValues}
        onLoadError={showLoadError}
        onCancel={() => setOpenAddReasonDialog(false)}
        onSave={handleAddReasonSave}
      />

      <ReasonDialog
        open={openEditReasonDialog}
        isLoading={isLoading}
        dialogTitle="Edit Reason"
        dialogSaveButtonLabel="Save"
        initialValues={getEditReasonInitialValues()}
        onLoadError={showLoadError}
        onCancel={() => {
          setOpenEditReasonDialog(false);
          setEditingReason(null);
        }}
        onSave={handleEditReasonSave}
      />
    </Container>
  );
};
