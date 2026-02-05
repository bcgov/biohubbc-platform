import { mdiDotsVertical, mdiMagnify, mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import InputAdornment from '@mui/material/InputAdornment';
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
import { ITeamWithMembers } from 'interfaces/useTeamsApi.interface';
import { IServerPaginationProps } from 'types/pagination';
import { useState } from 'react';
import { AddTeamForm, AddTeamFormInitialValues, AddTeamFormYupSchema, IAddTeamFormValues } from './AddTeamForm';

/**
 * Props for the TeamsContainer component.
 */
export interface ITeamsContainerProps extends IServerPaginationProps {
  /** Array of teams to display in the table */
  teams: ITeamWithMembers[];
  /** Callback to refresh the teams list after create/update/delete */
  refresh: () => void;
  /** Current search term for filtering teams */
  searchTerm: string;
  /** Callback when search term changes */
  onSearch: (term: string) => void;
  /** Currently selected team ID for filtering team-policy assignments */
  selectedTeamId: string | null;
  /** Callback when a team row is selected/deselected */
  onSelectTeam: (teamId: string | null) => void;
}

/**
 * Container component for managing teams.
 *
 * Provides functionality to:
 * - View teams in a searchable, paginated table
 * - Select a team to filter team-policy assignments
 * - Create new teams via dialog
 * - Edit existing teams via dialog
 * - Delete teams with confirmation
 *
 * @param {ITeamsContainerProps} props - Component props
 * @returns {React.ReactElement} The teams container component
 */
export const TeamsContainer: React.FC<ITeamsContainerProps> = (props) => {
  const {
    teams,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    refresh,
    searchTerm,
    onSearch,
    selectedTeamId,
    onSelectTeam
  } = props;

  const biohubApi = useApi();
  const dialogContext = useDialogContext();

  // Dialog state
  const [openAddTeamDialog, setOpenAddTeamDialog] = useState(false);
  const [openEditTeamDialog, setOpenEditTeamDialog] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ITeamWithMembers | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Handle row selection changes in the DataGrid.
   * Extracts the selected team ID and calls the parent callback.
   *
   * @param {GridRowSelectionModel} model - The new selection model from DataGrid
   */
  const handleRowSelectionChange = (model: GridRowSelectionModel) => {
    const ids = model && 'ids' in model ? Array.from(model.ids) : [];
    const newSelectedId = (ids[0] as string) || null;
    onSelectTeam(newSelectedId);
  };

  // Convert selectedTeamId to DataGrid selection model format
  const rowSelectionModel: GridRowSelectionModel = {
    type: 'include',
    ids: selectedTeamId ? new Set([selectedTeamId]) : new Set()
  };

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
   * @param {ITeamWithMembers} team - The team to delete
   */
  const handleDeleteTeamClick = (team: ITeamWithMembers) => {
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
      onYes: () => {
        deleteTeam(team).then(() => {
          dialogContext.setYesNoDialog({ open: false });
        });
      }
    });
  };

  /**
   * Delete a team via API.
   *
   * @param {ITeamWithMembers} team - The team to delete
   * @returns {Promise<void>}
   */
  const deleteTeam = async (team: ITeamWithMembers) => {
    if (!team?.team_id) {
      return;
    }
    try {
      await biohubApi.teams.deleteTeam(team.team_id);

      showSnackBar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Team <strong>{team.name}</strong> deleted.
          </Typography>
        ),
        open: true
      });

      // Clear selection if deleted team was selected
      if (selectedTeamId === team.team_id) {
        onSelectTeam(null);
      }

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
   * @param {ITeamWithMembers} team - The team to edit
   */
  const handleEditTeamClick = (team: ITeamWithMembers) => {
    setEditingTeam(team);
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
        member_user_ids: values.member_user_ids
      });

      setOpenAddTeamDialog(false);
      refresh();

      showSnackBar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Team <strong>{values.name}</strong> created.
          </Typography>
        )
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
        member_user_ids: values.member_user_ids
      });

      setOpenEditTeamDialog(false);
      setEditingTeam(null);
      refresh();

      showSnackBar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Team <strong>{values.name}</strong> updated.
          </Typography>
        )
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
      member_user_ids: editingTeam.members.map((m) => m.system_user_id)
    };
  };

  // DataGrid columns
  const columns: GridColDef<ITeamWithMembers>[] = [
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
      minWidth: 200,
      valueGetter: (value) => value || '-'
    },
    {
      field: 'members',
      headerName: 'Members',
      width: 100,
      sortable: false,
      valueGetter: (_value, row) => row.members?.length ?? 0
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
      <Box>
        <Toolbar disableGutters sx={{ px: 2 }}>
          <Typography variant="h4" component="h2" flexGrow={1}>
            Teams{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </Typography>
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
            <Button
              variant="contained"
              color="primary"
              startIcon={<Icon path={mdiPlus} size={0.8} />}
              onClick={() => setOpenAddTeamDialog(true)}>
              Add
            </Button>
          </Stack>
        </Toolbar>

        <Divider flexItem />

        <DataGrid
          data-testid="teams-table"
          rows={teams}
          columns={columns}
          getRowId={(row) => row.team_id}
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
          localeText={{ noRowsLabel: 'No Teams' }}
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
      </Box>

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
        }}
        onSave={handleEditTeamSave}
      />
    </>
  );
};
