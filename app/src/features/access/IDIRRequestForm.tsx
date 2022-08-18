import Box from '@mui/material/Box';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import Grid from '@mui/material/Grid';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import Typography from '@mui/material/Typography';
import CustomTextField from 'components/fields/CustomTextField';
import { useFormikContext } from 'formik';
import { IGetRoles } from 'interfaces/useAdminApi.interface';
import React from 'react';
import yup from 'utils/YupSchema';

export interface IIDIRRequestForm {
  role: number;
  comments: string;
}

export const IDIRRequestFormInitialValues: IIDIRRequestForm = {
  role: '' as unknown as number,
  comments: ''
};

export const IDIRRequestFormYupSchema = yup.object().shape({
  role: yup.string().required('Required'),
  comments: yup.string().max(300, 'Maximum 300 characters')
});

export interface IIDIRRequestFormProps {
  roles: IGetRoles[];
}

/**
 * Access Request - IDIR request fields
 *
 * @return {*}
 */
const IDIRRequestForm: React.FC<React.PropsWithChildren<IIDIRRequestFormProps>> = (props) => {
  const { values, touched, errors, handleChange } = useFormikContext<IIDIRRequestForm>();

  const { roles } = props;
  return (
    <Box>
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Typography variant="h3">What role do you want to be assigned?</Typography>
          <Box mt={2}>
            <FormControl fullWidth variant="outlined" required={true} style={{ width: '100%' }}>
              <InputLabel id="role-label">Role</InputLabel>
              <Select
                id="role"
                name="role"
                labelId="role-label"
                label="Role"
                value={values.role}
                notched
                onChange={handleChange}
                error={touched.role && Boolean(errors.role)}
                displayEmpty
                inputProps={{ 'aria-label': 'Role' }}>
                {roles.map((item) => (
                  <MenuItem key={item.system_role_id} value={item.name}>
                    {item.name}
                  </MenuItem>
                ))}
              </Select>
              <FormHelperText>{errors.role}</FormHelperText>
            </FormControl>
          </Box>
        </Grid>
      </Grid>

      <Box mt={3}>
        <Typography variant="h3">Reason for your request</Typography>
        <Box mt={2}>
          <CustomTextField name="Reason" label="Reason" other={{ multiline: true, rows: 4 }} />
        </Box>
      </Box>
    </Box>
  );
};

export default IDIRRequestForm;
