import { mdiDotsVertical, mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import CustomDataGrid from 'components/data-grid/CustomDataGrid';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { ITeamWithMembers } from 'interfaces/useTeamsApi.interface';
import { useState } from 'react';

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
  selectedTeam: ITeamWithMembers | null;
  /** Currently selected policy from ActivePoliciesList (null if none selected) */
  selectedPolicy: IPolicy | null;
  /** Callback to refresh the team-policies list after create/delete */
  refresh: () => void;
}

/**
 * Container component for managing team-policy associations.
 *
 * Displays filtered team-policy assignments based on selection in parent containers.
 * When both a team and policy are selected, shows an "Assign" button to create the association.
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

  const [isAssigning, setIsAssigning] = useState(false);

  // Check if the selected team-policy combination already exists
  const assignmentExists =
    selectedTeam &&
    selectedPolicy &&
    teamPolicies.some((tp) => tp.team_id === selectedTeam.team_id && tp.policy_id === selectedPolicy.policy_id);

  // Can assign when both are selected and assignment doesn't exist
  const canAssign = selectedTeam && selectedPolicy && !assignmentExists;

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

  /**
   * Handle creating a new team-policy association.
   */
  const handleAssign = async () => {
    if (!selectedTeam || !selectedPolicy) {
      return;
    }

    setIsAssigning(true);

    try {
      await biohubApi.teamPolicies.createTeamPolicy({
        team_id: selectedTeam.team_id,
        policy_id: selectedPolicy.policy_id
      });

      refresh();

      showSnackBar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Assigned <strong>{selectedPolicy.name}</strong> to <strong>{selectedTeam.name}</strong>.
          </Typography>
        )
      });
    } catch (error) {
      const apiError = error as APIError;

      dialogContext.setErrorDialog({
        open: true,
        dialogTitle: 'Failed to Assign Policy',
        dialogText: 'An error occurred while assigning the policy to the team.',
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
      setIsAssigning(false);
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
      onYes: () => {
        deleteTeamPolicy(teamPolicy).then(() => {
          dialogContext.setYesNoDialog({ open: false });
        });
      }
    });
  };

  /**
   * Delete a team-policy association via API.
   *
   * @param {ITeamPolicyDetails} teamPolicy - The association to delete
   */
  const deleteTeamPolicy = async (teamPolicy: ITeamPolicyDetails) => {
    try {
      await biohubApi.teamPolicies.deleteTeamPolicy(teamPolicy.team_policy_id);

      showSnackBar({
        snackbarMessage: (
          <Typography variant="body2" component="div">
            Removed <strong>{teamPolicy.policy_name}</strong> from <strong>{teamPolicy.team_name}</strong>.
          </Typography>
        )
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

  // DataGrid columns
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
    <Box>
      <Toolbar disableGutters sx={{ px: 2 }}>
        <Typography variant="h4" component="h2" flexGrow={1}>
          {getHeaderText()}{' '}
          <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
            ({rowCount})
          </Typography>
        </Typography>
        {canAssign && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<Icon path={mdiPlus} size={0.8} />}
            onClick={handleAssign}
            disabled={isAssigning}>
            Assign
          </Button>
        )}
      </Toolbar>

      <Divider flexItem />

      <CustomDataGrid
        data-testid="team-policies-table"
        rows={teamPolicies}
        columns={columns}
        getRowId={(row) => row.team_policy_id}
        paginationMode="server"
        paginationModel={paginationModel}
        onPaginationModelChange={setPaginationModel}
        pageSizeOptions={[10, 25, 50]}
        sortingMode="server"
        sortingOrder={['asc', 'desc']}
        sortModel={sortModel}
        onSortModelChange={setSortModel}
        rowCount={rowCount}
        disableRowSelectionOnClick
        disableColumnSelector
        disableColumnMenu
        localeText={{ noRowsLabel: 'No Team-Policy Assignments' }}
        sx={{
          border: 'none',
          '& .MuiDataGrid-columnHeaderTitle': {
            fontWeight: 700,
            textTransform: 'uppercase'
          }
        }}
      />
    </Box>
  );
};
