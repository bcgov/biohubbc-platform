import { mdiDotsVertical, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Typography from '@mui/material/Typography';
import { GridColDef, GridPaginationModel, GridSortModel } from '@mui/x-data-grid';
import { ServerPaginatedDataGrid } from 'components/data-grid/ServerPaginatedDataGrid';
import { PageSection } from 'components/section/PageSection';
import { CustomMenuIconButton } from 'components/toolbar/ActionToolbars';
import { ISnackbarProps } from 'contexts/dialogContext';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
import { CreateTeamPolicyDialog } from './CreateTeamPolicyDialog';
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
  /** Callback to refresh the team-policies list after create/delete */
  refresh: () => void;
}

const ASSIGNMENT_OPTIONS_PAGINATION: ApiPaginationRequestOptions = {
  page: 1,
  limit: 25,
  sort: 'name',
  order: 'asc'
};

/**
 * Container component for managing team-policy associations.
 *
 * Displays filtered team-policy assignments based on selection in parent containers.
 * Supports adding and removing assignments.
 *
 * @param {ITeamPoliciesContainerProps} props - Component props
 * @returns {React.ReactElement} The team-policies container component
 */
export const TeamPoliciesContainer = (props: ITeamPoliciesContainerProps) => {
  const { teamPolicies, rowCount, paginationModel, setPaginationModel, sortModel, setSortModel, refresh } = props;

  const biohubApi = useApi();
  const dialogContext = useDialogContext();

  const [isSaving, setIsSaving] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);

  const showApiErrorDialog = useCallback(
    (title: string, text: string, error: unknown) => {
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
    },
    [dialogContext]
  );

  const teamsDataLoader = useDataLoader(
    () => biohubApi.teams.getTeams(undefined, ASSIGNMENT_OPTIONS_PAGINATION),
    (error) => showApiErrorDialog('Failed to Load Assignment Options', 'An error occurred while loading teams.', error)
  );

  const policiesDataLoader = useDataLoader(
    () => biohubApi.policies.getPolicies(undefined, ASSIGNMENT_OPTIONS_PAGINATION),
    (error) =>
      showApiErrorDialog('Failed to Load Assignment Options', 'An error occurred while loading policies.', error)
  );

  useEffect(() => {
    teamsDataLoader.load();
    policiesDataLoader.load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const teams = useMemo(() => teamsDataLoader.data?.teams ?? [], [teamsDataLoader.data?.teams]);
  const policies = useMemo(() => policiesDataLoader.data?.policies ?? [], [policiesDataLoader.data?.policies]);

  const createInitialValues: ITeamPolicyFormValues = {
    team_id: TeamPolicyFormInitialValues.team_id,
    policy_id: TeamPolicyFormInitialValues.policy_id
  };

  /**
   * Display a snackbar notification.
   *
   * @param {Partial<ISnackbarProps>} [textDialogProps] - Optional snackbar configuration
   */
  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
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
      showApiErrorDialog(
        'Failed to Create Assignment',
        'An error occurred while creating the team-policy assignment.',
        error
      );
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
    const handleConfirmDelete = () => {
      handleDelete(teamPolicy);
      dialogContext.setYesNoDialog({ open: false });
    };

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
      onYes: handleConfirmDelete
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
      showApiErrorDialog('Error Removing Assignment', 'An error occurred while removing the policy assignment.', error);
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
      <PageSection
        id="assignments"
        label={
          <>
            Assignments{' '}
            <Typography sx={{ fontSize: 'inherit' }} component="span" color="textSecondary">
              ({rowCount})
            </Typography>
          </>
        }
        onAdd={() => setOpenCreateDialog(true)}>
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
      </PageSection>

      <CreateTeamPolicyDialog
        open={openCreateDialog}
        isLoading={isSaving}
        teams={teams}
        policies={policies}
        initialValues={createInitialValues}
        onCancel={() => setOpenCreateDialog(false)}
        onSave={handleCreate}
      />
    </>
  );
};
