import Box from '@mui/material/Box';
import { AutocompleteInputChangeReason } from '@mui/material/Autocomplete';
import { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import CustomAutocompleteFormik from 'components/fields/CustomAutocompleteFormik';
import { SearchAutocomplete } from 'components/search/SearchAutocomplete';
import { SearchOption } from 'components/search/SearchAutocomplete.interface';
import { useFormikContext } from 'formik';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { ITeam } from 'interfaces/useTeamsApi.interface';
import yup from 'utils/YupSchema';

export interface ITeamPolicyFormValues {
  team_id: string;
  policy_id: string;
}

export interface ITeamPolicyFormProps {
  teams: ITeam[];
  policies: IPolicy[];
  onTeamSearch: (search: string) => void;
  onPolicySearch: (search: string) => void;
}

export const TeamPolicyFormInitialValues: ITeamPolicyFormValues = {
  team_id: '',
  policy_id: ''
};

export const TeamPolicyFormYupSchema = yup.object().shape({
  team_id: yup.string().required('Team is required'),
  policy_id: yup.string().required('Policy is required')
});

/**
 * Form fields for selecting team and policy when creating/editing assignments.
 *
 * @param {ITeamPolicyFormProps} props
 * @returns {JSX.Element}
 */
export const TeamPolicyForm = (props: ITeamPolicyFormProps) => {
  const { teams, policies, onTeamSearch, onPolicySearch } = props;
  const { values, setFieldValue } = useFormikContext<ITeamPolicyFormValues>();

  const teamOptions: SearchOption[] = teams.map((team) => ({
    label: team.name,
    value: team.team_id
  }));

  const policyOptions: ICustomAutocompleteOption<string>[] = policies.map((policy) => ({
    label: policy.name,
    value: policy.policy_id
  }));

  const selectedTeamOption = teamOptions.find((team) => team.value === values.team_id) ?? null;
  return (
    <Box display="flex" flexDirection="column" gap={3} mt={1}>
      <Box>
        <SearchAutocomplete
          options={teamOptions}
          value={selectedTeamOption}
          showStartAdornment={false}
          label="Team"
          onInputChange={onTeamSearch}
          onChange={(option) => {
            setFieldValue('team_id', option?.value ?? '');
          }}
        />
      </Box>

      <Box>
        <CustomAutocompleteFormik
          id="policy_id"
          name="policy_id"
          options={policyOptions}
          label="Policy"
          required
          onInputChange={(_event, value, reason: AutocompleteInputChangeReason) => {
            if (reason !== 'reset') {
              onPolicySearch(value);
            }
          }}
        />
      </Box>
    </Box>
  );
};
