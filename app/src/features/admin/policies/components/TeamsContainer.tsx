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
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import EditDialog from 'components/dialog/EditDialog';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { ITeamWithMembers } from 'interfaces/useTeamsApi.interface';
import { debounce } from 'lodash-es';
import { useCallback, useMemo, useState } from 'react';
import { AddTeamForm, AddTeamFormInitialValues, AddTeamFormYupSchema, IAddTeamFormValues } from './AddTeamForm';

/**
 * Container component for managing teams.
 *
 * Provides functionality to:
 * - View teams in a searchable, paginated table
 * - Create new teams via dialog
 * - Edit existing teams via dialog
 * - Delete teams with confirmation
 */
export const TeamsContainer = () => {
  const biohubApi = useApi();
  const dialogContext = useDialogContext();

  // Search state
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  // Dialog state
  const [openAddTeamDialog, setOpenAddTeamDialog] = useState(false);
  const [openEditTeamDialog, setOpenEditTeamDialog] = useState(false);
  const [editingTeam, setEditingTeam] = useState<ITeamWithMembers | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Data loader for fetching teams
  const teamsDataLoader = useDataLoader((search?: string) => biohubApi.teams.getTeams({ search: search || undefined }));
  teamsDataLoader.load(debouncedSearchTerm);

  /**
   * Debounced function to update search term and refresh teams.
   * Waits 300ms after last keystroke before triggering API call.
   */
  const debouncedRefresh = useMemo(
    () =>
      debounce((term: string) => {
        setDebouncedSearchTerm(term);
        teamsDataLoader.refresh(term);
      }, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /**
   * Handle search input changes.
   */
  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);
      debouncedRefresh(term);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const teams = teamsDataLoader.data?.teams ?? [];
  const teamCount = teamsDataLoader.data?.pagination?.total ?? teams.length;

  /**
   * Display a snackbar notification.
   */
  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  /**
   * Open confirmation dialog to delete a team.
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

      teamsDataLoader.refresh(debouncedSearchTerm);
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
   */
  const handleEditTeamClick = (team: ITeamWithMembers) => {
    setEditingTeam(team);
    setOpenEditTeamDialog(true);
  };

  /**
   * Handle saving a new team from the add dialog.
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
      teamsDataLoader.refresh(debouncedSearchTerm);

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
      teamsDataLoader.refresh(debouncedSearchTerm);

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
              ({teamCount})
            </Typography>
          </Typography>
          <Stack gap={1} direction="row" alignItems="center">
            <TextField
              size="small"
              placeholder="Search by team name"
              value={searchTerm}
              onChange={(e) => handleSearch(e.target.value)}
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
          pageSizeOptions={[10, 25, 50]}
          disableRowSelectionOnClick
          disableColumnSelector
          disableColumnMenu
          localeText={{ noRowsLabel: 'No Teams' }}
          initialState={{
            pagination: {
              paginationModel: {
                pageSize: 10
              }
            }
          }}
          sx={{
            border: 'none',
            '& .MuiDataGrid-columnHeaderTitle': {
              fontWeight: 700,
              textTransform: 'uppercase'
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
          element: (
            <AddTeamForm
              initialUsers={editingTeam?.members.map((m) => ({
                system_user_id: m.system_user_id,
                user_identifier: m.user_identifier
              }))}
            />
          ),
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
