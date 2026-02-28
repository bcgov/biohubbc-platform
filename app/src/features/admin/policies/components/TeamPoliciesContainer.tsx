import { mdiDotsVertical, mdiPencilOutline, mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import ServerPaginatedDataGrid from 'components/data-grid/ServerPaginatedDataGrid';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { ITeam } from 'interfaces/useTeamsApi.interface';
import { useEffect, useMemo, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { CreateTeamPolicyDialog } from './CreateTeamPolicyDialog';
import { EditTeamPolicyDialog } from './EditTeamPolicyDialog';
import { ITeamPolicyFormValues, TeamPolicyFormInitialValues } from './TeamPolicyForm';

/**
 * Props for the TeamPoliciesContainer component.
 */
export interface ITeamPoliciesContainerProps {
  /** Array of team-policy associations to display (pre-filtered by parent) */
  teamPolicies: ITeamPolicyDetails[];
  /** Total number of team-policy associations (for server-side pagination) */
  rowCount: number;
  /** Current pagination model from parent */
  paginationModel: GridPaginationModel;
  /** Callback when pagination changes */
  setPaginationModel: (model: GridPaginationModel) => void;
  /** Current sort model from parent */
  sortModel: GridSortModel;
  /** Callback when sort changes */
  setSortModel: (model: GridSortModel) => void;
  /** Currently selected team from TeamsContainer (null if none selected) */
  selectedTeam: ITeam | null;
  /** Currently selected policy from PoliciesContainer (null if none selected) */
  selectedPolicy: IPolicy | null;
  /** Callback to refresh the team-policies list after create/delete */
  refresh: () => void;
}

/**
 * Container component for managing team-policy associations.
 *
 * Displays filtered team-policy assignments based on selection in parent containers.
 * Supports adding, editing, and removing assignments.
 *
 * @param {ITeamPoliciesContainerProps} props - Component props
 * @returns {React.ReactElement} The team-policies container component
 */
export const TeamPoliciesContainer: React.FC<ITeamPoliciesContainerProps> = (props) => {
  const {
    teamPolicies,
    rowCount,
    paginationModel,
    setPaginationModel,
    sortModel,
    setSortModel,
    selectedTeam,
    selectedPolicy,
    refresh
  } = props;

  const biohubApi = useApi();
  const dialogContext = useDialogContext();

  const [teams, setTeams] = useState<ITeam[]>([]);
  const [policies, setPolicies] = useState<IPolicy[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [editingTeamPolicy, setEditingTeamPolicy] = useState<ITeamPolicyDetails | null>(null);

  useEffect(() => {
    const pagination: ApiPaginationRequestOptions = {
      page: 1,
      limit: 25,
      sort: 'name',
      order: 'asc'
    };

    const loadAssignmentOptions = async () => {
      try {
        const [teamsResponse, policiesResponse] = await Promise.all([
          biohubApi.teams.getTeams(undefined, pagination),
          biohubApi.policies.getPolicies(undefined, pagination)
        ]);

        setTeams(teamsResponse.teams);
        setPolicies(policiesResponse.policies);
      } catch (error) {
        const apiError = error as APIError;
        dialogContext.setErrorDialog({
          open: true,
          dialogTitle: 'Failed to Load Assignment Options',
          dialogText: 'An error occurred while loading teams and policies.',
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

    loadAssignmentOptions();
  }, [biohubApi.policies, biohubApi.teams, dialogContext]);

  const teamOptions = useMemo(() => {
    const map = new Map<string, ITeam>();
    teams.forEach((team) => map.set(team.team_id, team));
    if (selectedTeam) {
      map.set(selectedTeam.team_id, selectedTeam);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [selectedTeam, teams]);

  const createInitialValues: ITeamPolicyFormValues = {
    team_id: selectedTeam?.team_id ?? TeamPolicyFormInitialValues.team_id,
    policy_id: selectedPolicy?.policy_id ?? TeamPolicyFormInitialValues.policy_id
  };

  const editInitialValues: ITeamPolicyFormValues = {
    team_id: editingTeamPolicy?.team_id ?? TeamPolicyFormInitialValues.team_id,
    policy_id: editingTeamPolicy?.policy_id ?? TeamPolicyFormInitialValues.policy_id
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
   * Get dynamic header text based on selection state.
   *
   * @returns {string} Header text describing what's being shown
   */
  const getHeaderText = (): string => {
    if (selectedTeam && selectedPolicy) {
      return `Assignment: ${selectedTeam.name} + ${selectedPolicy.name}`;
    }
    if (selectedTeam) {
      return `Policies for "${selectedTeam.name}"`;
    }
    if (selectedPolicy) {
      return `Teams with "${selectedPolicy.name}"`;
    }
    return 'Team-Policy Assignments';
  };

  const handleCreate = async (values: ITeamPolicyFormValues) => {
    setIsSaving(true);

    try {
      await biohubApi.teamPolicies.createTeamPolicy({
        team_id: values.team_id,
        policy_id: values.policy_id
      });

      setOpenCreateDialog(false);
      refresh();

      showSnackBar({
        snackbarMessage: 'Created assignment'
      });
    } catch (error) {
      const apiError = error as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Create Assignment',
        dialogText: 'An error occurred while creating the team-policy assignment.',
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
      setIsSaving(false);
    }
  };

  const handleEditClick = (teamPolicy: ITeamPolicyDetails) => {
    setEditingTeamPolicy(teamPolicy);
    setOpenEditDialog(true);
  };

  const handleEdit = async (values: ITeamPolicyFormValues) => {
    if (!editingTeamPolicy) {
      return;
    }

    const hasChanges = values.team_id !== editingTeamPolicy.team_id || values.policy_id !== editingTeamPolicy.policy_id;

    if (!hasChanges) {
      setOpenEditDialog(false);
      setEditingTeamPolicy(null);
      return;
    }

    setIsSaving(true);

    try {
      await biohubApi.teamPolicies.createTeamPolicy({
        team_id: values.team_id,
        policy_id: values.policy_id
      });

      await biohubApi.teamPolicies.deleteTeamPolicy(editingTeamPolicy.team_policy_id);

      setOpenEditDialog(false);
      setEditingTeamPolicy(null);
      refresh();

      showSnackBar({
        snackbarMessage: 'Updated assignment'
      });
    } catch (error) {
      const apiError = error as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Update Assignment',
        dialogText: 'An error occurred while updating the team-policy assignment.',
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
      setIsSaving(false);
    }
  };

  /**
   * Open confirmation dialog to delete a team-policy association.
   *
   * @param {ITeamPolicyDetails} teamPolicy - The association to delete
   */
  const handleDeleteClick = (teamPolicy: ITeamPolicyDetails) => {
    dialogContext.setYesNoDialog({
      dialogTitle: 'Remove assignment?',
      dialogContent: (
        <Typography variant="body1" component="div" color="textSecondary">
          Remove policy <strong>{teamPolicy.policy_name}</strong> from team <strong>{teamPolicy.team_name}</strong>?
        </Typography>
      ),
      yesButtonLabel: 'Remove',
      noButtonLabel: 'Cancel',
      yesButtonProps: { color: 'error' },
      onClose: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      onNo: () => {
        dialogContext.setYesNoDialog({ open: false });
      },
      open: true,
      onYes: async () => {
        await handleDelete(teamPolicy);
        dialogContext.setYesNoDialog({ open: false });
      }
    });
  };

  /**
   * Delete a team-policy association via API.
   *
   * @param {ITeamPolicyDetails} teamPolicy - The association to delete
   */
  const handleDelete = async (teamPolicy: ITeamPolicyDetails) => {
    try {
      await biohubApi.teamPolicies.deleteTeamPolicy(teamPolicy.team_policy_id);

      showSnackBar({
        snackbarMessage: 'Removed assignment'
      });

      refresh();
    } catch (error) {
      const apiError = error as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Error Removing Assignment',
        dialogText: 'An error occurred while removing the policy assignment.',
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

  const columns: GridColDef<ITeamPolicyDetails>[] = [
    {
      field: 'team_name',
      headerName: 'Team',
      flex: 1,
      minWidth: 150
    },
    {
      field: 'policy_name',
      headerName: 'Policy',
      flex: 1,
      minWidth: 150
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
              menuLabel: 'Edit assignment',
              menuOnClick: () => handleEditClick(params.row)
            },
            {
              menuIcon: <Icon path={mdiTrashCanOutline} size={0.875} />,
              menuLabel: 'Remove assignment',
              menuOnClick: () => handleDeleteClick(params.row)
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
            {getHeaderText()}{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </Typography>
          <Button
            variant="contained"
            color="primary"
            startIcon={<Icon path={mdiPlus} size={0.8} />}
            onClick={() => setOpenCreateDialog(true)}
            data-testid="add-assignment-button"
            disabled={teamOptions.length === 0 || policies.length === 0}>
            Add
          </Button>
        </Toolbar>

        <Divider flexItem />

        <ServerPaginatedDataGrid<ITeamPolicyDetails>
          dataTestId="team-policies-table"
          rows={teamPolicies}
          columns={columns}
          getRowId={(row) => row.team_policy_id}
          noRowsMessage="No Team-Policy Assignments"
          rowCount={rowCount}
          paginationModel={paginationModel}
          setPaginationModel={setPaginationModel}
          sortModel={sortModel}
          setSortModel={setSortModel}
        />
      </Box>

      <CreateTeamPolicyDialog
        open={openCreateDialog}
        isLoading={isSaving}
        teams={teamOptions}
        policies={policies}
        initialValues={createInitialValues}
        onCancel={() => setOpenCreateDialog(false)}
        onSave={handleCreate}
      />

      <EditTeamPolicyDialog
        open={openEditDialog}
        isLoading={isSaving}
        teams={teamOptions}
        policies={policies}
        initialValues={editInitialValues}
        onCancel={() => {
          setOpenEditDialog(false);
          setEditingTeamPolicy(null);
        }}
        onSave={handleEdit}
      />
    </>
  );
};
