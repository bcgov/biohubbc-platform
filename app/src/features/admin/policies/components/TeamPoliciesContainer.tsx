import { mdiDotsVertical, mdiMagnify, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
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
import { ITeamPolicyDetails } from 'interfaces/useTeamPoliciesApi.interface';
import { useCallback, useState } from 'react';
import { IServerPaginationProps } from 'types/pagination';
import { CreateTeamPolicyDialog } from './CreateTeamPolicyDialog';
import { ITeamPolicyFormValues } from './TeamPolicyForm';

/**
 * Props for the TeamPoliciesContainer component.
 */
export interface ITeamPoliciesContainerProps extends IServerPaginationProps {
  /** Array of team-policy associations to display (pre-filtered by parent) */
  teamPolicies: ITeamPolicyDetails[];
  /** Callback to refresh the team-policies list after create/update/delete */
  refresh: () => void;
  /** Current search term for filtering assignments */
  searchTerm: string;
  /** Callback when search term changes */
  onSearch: (term: string) => void;
}

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
  const {
    teamPolicies,
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

  /**
   * Display a snackbar notification.
   *
   * @param {Partial<ISnackbarProps>} [textDialogProps]
   */
  const showSnackBar = (textDialogProps?: Partial<ISnackbarProps>) => {
    dialogContext.setSnackbar({ ...textDialogProps, open: true });
  };

  const handleCreate = async (values: ITeamPolicyFormValues) => {
    setIsSaving(true);

    try {
      await biohubApi.teamPolicies.createTeamPolicies(values.team_id, { policies: values.policies });

      setOpenCreateDialog(false);
      refresh();

      showSnackBar({
        snackbarMessage: 'Created assignments'
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
        <Typography component="div" color="textSecondary">
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
        onAdd={() => setOpenCreateDialog(true)}
        headerContent={
          <Stack gap={1} direction="row" alignItems="center">
            <TextField
              size="small"
              placeholder="Search by team or policy"
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
        onLoadError={showApiErrorDialog}
        onCancel={() => setOpenCreateDialog(false)}
        onSave={handleCreate}
      />
    </>
  );
};
