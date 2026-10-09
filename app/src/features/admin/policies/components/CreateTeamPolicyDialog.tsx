import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { TEAM_POLICY_ASSIGNMENT_OPTIONS_PAGINATION } from 'constants/team-policy';
import { useApi } from 'hooks/useApi';
import useDebounce from 'hooks/useDebounce';
import { useEffect, useMemo, useState } from 'react';
import { policyQueryKeys } from 'utils/query-keys/policy-query-keys';
import { teamQueryKeys } from 'utils/query-keys/team-query-keys';
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

/**
 * Dialog for creating a team-policy assignment.
 *
 * @param {ICreateTeamPolicyDialogProps} props
 * @returns {JSX.Element}
 */
export const CreateTeamPolicyDialog = (props: ICreateTeamPolicyDialogProps) => {
  const { open, isLoading, onLoadError, onCancel, onSave } = props;
  const biohubApi = useApi();

  const [teamSearch, setTeamSearch] = useState('');
  const [policySearch, setPolicySearch] = useState('');

  const teamsQuery = useQuery({
    queryKey: teamQueryKeys.list({ search: teamSearch || undefined }, TEAM_POLICY_ASSIGNMENT_OPTIONS_PAGINATION),
    queryFn: ({ signal }) =>
      biohubApi.teams.getTeams({ search: teamSearch || undefined }, TEAM_POLICY_ASSIGNMENT_OPTIONS_PAGINATION, {
        signal
      }),
    enabled: open,
    placeholderData: keepPreviousData
  });

  const policiesQuery = useQuery({
    queryKey: policyQueryKeys.list({ search: policySearch || undefined }, TEAM_POLICY_ASSIGNMENT_OPTIONS_PAGINATION),
    queryFn: ({ signal }) =>
      biohubApi.policies.getPolicies({ search: policySearch || undefined }, TEAM_POLICY_ASSIGNMENT_OPTIONS_PAGINATION, {
        signal
      }),
    enabled: open,
    placeholderData: keepPreviousData
  });

  const { error: teamsError } = teamsQuery;
  useEffect(() => {
    if (teamsError) {
      onLoadError('Failed to Load Assignment Options', 'An error occurred while loading teams.', teamsError);
    }
  }, [teamsError, onLoadError]);

  const { error: policiesError } = policiesQuery;
  useEffect(() => {
    if (policiesError) {
      onLoadError('Failed to Load Assignment Options', 'An error occurred while loading policies.', policiesError);
    }
  }, [policiesError, onLoadError]);

  const teams = useMemo(() => teamsQuery.data?.teams ?? [], [teamsQuery.data?.teams]);
  const policies = useMemo(() => policiesQuery.data?.policies ?? [], [policiesQuery.data?.policies]);

  const handleTeamSearch = useDebounce(setTeamSearch, 300);
  const handlePolicySearch = useDebounce(setPolicySearch, 300);

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
