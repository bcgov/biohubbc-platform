import { EditDialog } from 'components/dialog/EditDialog';
import useDebounce from 'hooks/useDebounce';
import useDataLoader from 'hooks/useDataLoader';
import { useApi } from 'hooks/useApi';
import { useCallback, useEffect, useMemo } from 'react';
import { ApiPaginationRequestOptions } from 'types/pagination';
import {
  ITeamPolicyFormValues,
  TeamPolicyForm,
  TeamPolicyFormInitialValues,
  TeamPolicyFormYupSchema
} from './TeamPolicyForm';

export interface ICreateTeamPolicyDialogProps {
  open: boolean;
  isLoading: boolean;
  onLoadError: (title: string, text: string, error: unknown) => void;
  onCancel: () => void;
  onSave: (values: ITeamPolicyFormValues) => void;
}

const ASSIGNMENT_OPTIONS_PAGINATION: ApiPaginationRequestOptions = {
  page: 1,
  limit: 25,
  sort: 'name',
  order: 'asc'
};

/**
 * Dialog for creating a team-policy assignment.
 *
 * @param {ICreateTeamPolicyDialogProps} props
 * @returns {JSX.Element}
 */
export const CreateTeamPolicyDialog = (props: ICreateTeamPolicyDialogProps) => {
  const { open, isLoading, onLoadError, onCancel, onSave } = props;
  const biohubApi = useApi();

  const teamsDataLoader = useDataLoader(
    (search?: string) => biohubApi.teams.getTeams({ search }, ASSIGNMENT_OPTIONS_PAGINATION),
    (error) => onLoadError('Failed to Load Assignment Options', 'An error occurred while loading teams.', error)
  );

  const policiesDataLoader = useDataLoader(
    (search?: string) => biohubApi.policies.getPolicies({ search }, ASSIGNMENT_OPTIONS_PAGINATION),
    (error) => onLoadError('Failed to Load Assignment Options', 'An error occurred while loading policies.', error)
  );

  useEffect(() => {
    if (!open) {
      return;
    }
    teamsDataLoader.refresh();
    policiesDataLoader.refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const teams = useMemo(() => teamsDataLoader.data?.teams ?? [], [teamsDataLoader.data?.teams]);
  const policies = useMemo(() => policiesDataLoader.data?.policies ?? [], [policiesDataLoader.data?.policies]);

  const debouncedTeamRefresh = useDebounce((search: string) => {
    teamsDataLoader.refresh(search || undefined);
  }, 300);

  const debouncedPolicyRefresh = useDebounce((search: string) => {
    policiesDataLoader.refresh(search || undefined);
  }, 300);

  const handleTeamSearch = useCallback(
    (search: string) => {
      debouncedTeamRefresh(search);
    },
    [debouncedTeamRefresh]
  );

  const handlePolicySearch = useCallback(
    (search: string) => {
      debouncedPolicyRefresh(search);
    },
    [debouncedPolicyRefresh]
  );

  return (
    <EditDialog<ITeamPolicyFormValues>
      open={open}
      isLoading={isLoading}
      dialogTitle="Add Assignment"
      dialogSaveButtonLabel="Add"
      component={{
        element: (
          <TeamPolicyForm
            teams={teams}
            policies={policies}
            onTeamSearch={handleTeamSearch}
            onPolicySearch={handlePolicySearch}
          />
        ),
        initialValues: TeamPolicyFormInitialValues,
        validationSchema: TeamPolicyFormYupSchema
      }}
      onCancel={onCancel}
      onSave={onSave}
    />
  );
};
