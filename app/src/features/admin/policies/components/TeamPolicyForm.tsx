import Box from '@mui/material/Box';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
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
  const { teams, policies } = props;
  const { values, errors, touched, handleChange, handleBlur } = useFormikContext<ITeamPolicyFormValues>();

  return (
    <Box display="flex" flexDirection="column" gap={3} mt={1}>
      <TextField
        select
        name="team_id"
        label="Team"
        fullWidth
        required
        value={values.team_id}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.team_id && Boolean(errors.team_id)}
        helperText={touched.team_id && errors.team_id}>
        {teams.map((team) => (
          <MenuItem key={team.team_id} value={team.team_id}>
            {team.name}
          </MenuItem>
        ))}
      </TextField>

      <TextField
        select
        name="policy_id"
        label="Policy"
        fullWidth
        required
        value={values.policy_id}
        onChange={handleChange}
        onBlur={handleBlur}
        error={touched.policy_id && Boolean(errors.policy_id)}
        helperText={touched.policy_id && errors.policy_id}>
        {policies.map((policy) => (
          <MenuItem key={policy.policy_id} value={policy.policy_id}>
            {policy.name}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );
};
