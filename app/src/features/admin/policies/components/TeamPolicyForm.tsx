import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { SearchAutocomplete } from 'features/search/result/sidebar/search/components/section/autocomplete/SearchAutocomplete';
import { SidebarOption } from 'features/search/result/sidebar/search/components/section/option/SearchSidebarOption';
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
  const { values, errors, touched, setFieldValue } = useFormikContext<ITeamPolicyFormValues>();

  const teamOptions: SidebarOption[] = teams.map((team) => ({
    label: team.name,
    value: team.team_id
  }));

  const policyOptions: SidebarOption[] = policies.map((policy) => ({
    label: policy.name,
    value: policy.policy_id
  }));

  const selectedTeamOption = teamOptions.find((team) => team.value === values.team_id) ?? null;
  const selectedPolicyOption = policyOptions.find((policy) => policy.value === values.policy_id) ?? null;

  return (
    <Box display="flex" flexDirection="column" gap={3} mt={1}>
      <Box>
        <SearchAutocomplete
          options={teamOptions}
          value={selectedTeamOption}
          showStartAdornment={false}
          label="Team"
          placeholder="Search team"
          onInputChange={onTeamSearch}
          onChange={(option) => {
            setFieldValue('team_id', option?.value ?? '');
          }}
        />
        {touched.team_id && errors.team_id && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
            {errors.team_id}
          </Typography>
        )}
      </Box>

      <Box>
        <SearchAutocomplete
          options={policyOptions}
          value={selectedPolicyOption}
          label="Policy"
          showStartAdornment={false}
          placeholder="Search policy"
          onInputChange={onPolicySearch}
          onChange={(option) => {
            setFieldValue('policy_id', option?.value ?? '');
          }}
        />
        {touched.policy_id && errors.policy_id && (
          <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
            {errors.policy_id}
          </Typography>
        )}
      </Box>
    </Box>
  );
};
