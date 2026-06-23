import { mdiDotsVertical, mdiMagnify, mdiPencilOutline, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
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
import { IAvailableUser, ITeam } from 'interfaces/useTeamsApi.interface';
import { useState } from 'react';
import { IServerPaginationProps } from 'types/pagination';
import { AddTeamForm, AddTeamFormInitialValues, AddTeamFormYupSchema, IAddTeamFormValues } from './AddTeamForm';

/**
 * Props for the TeamsContainer component.
 */
export interface ITeamsContainerProps extends IServerPaginationProps {
  /** Array of teams to display in the table */
  teams: ITeam[];
  /** Callback to refresh the teams list after create/update/delete */
  refresh: () => void;
  /** Current search term for filtering teams */
  searchTerm: string;
  /** Callback when search term changes */
  onSearch: (term: string) => void;
}

/**
 * Container component for managing teams.
 *
 * Provides functionality to:
 * - View teams in a searchable, paginated table
 * - Create new teams via dialog
 * - Edit existing teams via dialog
 * - Delete teams with confirmation
 *
 * @param {ITeamsContainerProps} props - Component props
 * @returns {React.ReactElement} The teams container component
 */
export const TeamsContainer = (props: ITeamsContainerProps) => {
  const {
    teams,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    refresh,
    searchTerm,
    onSearch
  } = props;

  const biohubApi = useApi();
  const dialogContext = useDialogContext();

  // Dialog state
  const [openAddTeamDialog, setOpenAddTeamDialog] = useState(false);
  const [openEditTeamDialog, setOpenEditTeamDialog] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ITeam | null>(null);
  const [editingTeamMembers, setEditingTeamMembers] = useState<IAvailableUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Display a snackbar notification.
   *
   * @param {Partial<ISnackbarProps>} [textDialogProps] - Optional snackbar configuration
   */
  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  /**
   * Open confirmation dialog to delete a team.
   *
   * @param {ITeam} team - The team to delete
   */
  const handleDeleteTeamClick = (team: ITeam) => {
    const handleConfirmDelete = () => {
      deleteTeam(team);
      dialogContext.setYesNoDialog({ open: false });
    };

    dialogContext.setYesNoDialog({
      dialogTitle: 'Delete team?',
      dialogContent: (
        <Typography variant="body1" component="div" color="textSecondary">
          Deleting team <strong>{team.name}</strong> will remove it permanently. Are you sure you want to proceed?
        </Typography>
      ),
      yesButtonLabel: 'Delete Team',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      open: true,
      onYes: handleConfirmDelete
    });
  };

  /**
   * Delete a team via API.
   *
   * @param {ITeam} team - The team to delete
   * @returns {Promise<void>}
   */
  const deleteTeam = async (team: ITeam) => {
    if (!team?.team_id) {
      return;
    }
    try {
      await biohubApi.teams.deleteTeam(team.team_id);

      showSnackBar({
        snackbarMessage: 'Deleted team',
        open: true
      });
      refresh();
    } catch (error) {
      const apiError = error as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Error Deleting Team',
        dialogText: 'An error occurred while deleting the team.',
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
   * Open the edit dialog for a team.
   *
   * @param {ITeam} team - The team to edit
   */
  const handleEditTeamClick = async (team: ITeam) => {
    setEditingTeam(team);

    try {
      const { members } = await biohubApi.teams.getTeamMembers(team.team_id);
      setEditingTeamMembers(
        members.map((m) => ({ system_user_id: m.system_user_id, user_identifier: m.user_identifier }))
      );
    } catch (error) {
      const apiError = error as APIError;

      setEditingTeam(null);

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Error Loading Team Members',
        dialogText: 'An error occurred while loading team members.',
        dialogError: apiError.message,
        dialogErrorDetails: apiError.errors,
        onClose: () => dialogContext.setErrorDialog({ open: false }),
        onOk: () => dialogContext.setErrorDialog({ open: false })
      });

      return;
    }

    setOpenEditTeamDialog(true);
  };

  /**
   * Handle saving a new team from the add dialog.
   *
   * @param {IAddTeamFormValues} values - Form values from the add team dialog
   * @returns {Promise<void>}
   */
  const handleAddTeamSave = async (values: IAddTeamFormValues) => {
    setIsLoading(true);

    try {
      await biohubApi.teams.createTeam({
        name: values.name,
        description: values.description || undefined,
        system_user_ids: values.system_users.map((u) => u.system_user_id)
      });

      setOpenAddTeamDialog(false);
      refresh();

      showSnackBar({
        snackbarMessage: 'Created team'
      });
    } catch (error) {
      const apiError = error as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Create Team',
        dialogText: 'An error occurred while creating the team.',
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
   * Handle saving an edited team.
   *
   * @param {IAddTeamFormValues} values - Form values from the edit team dialog
   * @returns {Promise<void>}
   */
  const handleEditTeamSave = async (values: IAddTeamFormValues) => {
    if (!editingTeam) {
      return;
    }

    setIsLoading(true);

    try {
      await biohubApi.teams.updateTeam(editingTeam.team_id, {
        name: values.name,
        description: values.description || undefined,
        system_user_ids: values.system_users.map((u) => u.system_user_id)
      });

      setOpenEditTeamDialog(false);
      setEditingTeam(null);
      setEditingTeamMembers([]);
      refresh();

      showSnackBar({
        snackbarMessage: 'Updated team'
      });
    } catch (error) {
      const apiError = error as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Update Team',
        dialogText: 'An error occurred while updating the team.',
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
   * Get initial form values for the edit dialog.
   *
   * @returns {IAddTeamFormValues} Form values pre-populated with the editing team's data
   */
  const getEditTeamInitialValues = (): IAddTeamFormValues => {
    if (!editingTeam) {
      return AddTeamFormInitialValues;
    }
    return {
      name: editingTeam.name,
      description: editingTeam.description || '',
      system_users: editingTeamMembers
    };
  };

  // DataGrid columns
  const columns: GridColDef<ITeam>[] = [
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
      field: 'member_count',
      headerName: 'Members',
      width: 100,
      valueGetter: (_value, row) => row.member_count
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
              menuLabel: 'Edit team',
              menuOnClick: () => handleEditTeamClick(params.row)
            },
            {
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuLabel: 'Delete team',
              menuOnClick: () => handleDeleteTeamClick(params.row)
            }
          ]}
        />
      )
    }
  ];

  return (
    <>
      <PageSection
        id="teams"
        label={
          <>
            Teams{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setOpenAddTeamDialog(true)}
        headerContent={
          <Stack gap={1} direction="row" alignItems="center">
            <TextField
              size="small"
              placeholder="Search by team name"
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
        <ServerPaginatedDataGrid<ITeam>
          dataTestId="teams-table"
          rows={teams}
          columns={columns}
          getRowId={(row) => row.team_id}
          noRowsMessage="No Teams"
          rowCount={rowCount}
          paginationModel={paginationModel}
          setPaginationModel={setPaginationModel}
          sortModel={sortModel}
          setSortModel={setSortModel}
        />
      </PageSection>

      <EditDialog
        isLoading={isLoading}
        dialogTitle="Add Team"
        open={openAddTeamDialog}
        dialogSaveButtonLabel="Create"
        component={{
          element: <AddTeamForm />,
          initialValues: AddTeamFormInitialValues,
          validationSchema: AddTeamFormYupSchema
        }}
        onCancel={() => setOpenAddTeamDialog(false)}
        onSave={handleAddTeamSave}
      />

      <EditDialog
        isLoading={isLoading}
        dialogTitle="Edit Team"
        open={openEditTeamDialog}
        dialogSaveButtonLabel="Save"
        component={{
          element: <AddTeamForm />,
          initialValues: getEditTeamInitialValues(),
          validationSchema: AddTeamFormYupSchema
        }}
        onCancel={() => {
          setOpenEditTeamDialog(false);
          setEditingTeam(null);
          setEditingTeamMembers([]);
        }}
        onSave={handleEditTeamSave}
      />
    </>
  );
};
