import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { EditDialog } from 'components/dialog/EditDialog';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useState } from 'react';
import { formQueryKeys } from 'utils/query-keys/form-query-keys';
import yup from 'utils/YupSchema';
import { FormTeamsForm, IFormTeamsFormValues } from './FormTeamsForm';

const TEAM_OPTIONS_PAGINATION = { page: 1, limit: 50, sort: 'name', order: 'asc' as const };

const formTeamsSchema = yup.object({ teamIds: yup.array(yup.string().required()).required() });

interface IFormTeamsDialogProps {
  /** Form whose teams are edited. */
  formId: number;
  /** Closes the dialog. */
  onClose: () => void;
}

/**
 * Edit the teams whose members may access a form that is not public. Loads the linked teams, searches teams by name,
 * and replaces the links on save.
 *
 * @param {IFormTeamsDialogProps} props
 * @returns {JSX.Element} Team access dialog.
 */
export const FormTeamsDialog = ({ formId, onClose }: IFormTeamsDialogProps) => {
  const biohubApi = useApi();
  const queryClient = useQueryClient();
  const [teamSearch, setTeamSearch] = useState('');
  const [saveError, setSaveError] = useState<string>();

  const formTeamsQuery = useQuery({
    queryKey: formQueryKeys.teams(formId),
    queryFn: ({ signal }) => biohubApi.forms.getFormTeams(formId, { signal })
  });
  const teamsQuery = useQuery({
    queryKey: ['forms', 'teamOptions', teamSearch],
    queryFn: ({ signal }) =>
      biohubApi.teams.getTeams({ search: teamSearch || undefined }, TEAM_OPTIONS_PAGINATION, { signal }),
    placeholderData: keepPreviousData
  });

  const linkedTeams = formTeamsQuery.data?.teams ?? [];
  const searchedTeams = teamsQuery.data?.teams ?? [];
  const teamOptions = [
    ...linkedTeams.map((team) => ({ value: team.team_id, label: team.name })),
    ...searchedTeams
      .filter((team) => !linkedTeams.some((linkedTeam) => linkedTeam.team_id === team.team_id))
      .map((team) => ({ value: team.team_id, label: team.name }))
  ];

  /**
   * Replace the form's team links and refresh the cached links.
   *
   * @param {IFormTeamsFormValues} values Selected teams.
   */
  const handleSave = async (values: IFormTeamsFormValues) => {
    try {
      const result = await biohubApi.forms.updateFormTeams(formId, values.teamIds);
      queryClient.setQueryData(formQueryKeys.teams(formId), result);
      onClose();
    } catch (error_) {
      setSaveError((error_ as APIError).message);
    }
  };

  if (!formTeamsQuery.data) {
    return <QueryErrorDialog error={formTeamsQuery.error} label="form teams" />;
  }

  return (
    <EditDialog<IFormTeamsFormValues>
      open
      dialogTitle="Form Access"
      dialogSaveButtonLabel="Save"
      dialogError={saveError}
      onCancel={onClose}
      onSave={handleSave}
      component={{
        element: <FormTeamsForm teamOptions={teamOptions} onTeamSearch={setTeamSearch} />,
        initialValues: { teamIds: linkedTeams.map((team) => team.team_id) },
        validationSchema: formTeamsSchema
      }}
    />
  );
};
