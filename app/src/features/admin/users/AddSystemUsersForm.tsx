import { mdiPlus, mdiTrashCanOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormHelperText from '@mui/material/FormHelperText';
import IconButton from '@mui/material/IconButton';
import InputLabel from '@mui/material/InputLabel';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import CustomTextField from 'components/fields/CustomTextField';
import { FieldArray, useFormikContext } from 'formik';
import { SYSTEM_IDENTITY_SOURCE } from 'hooks/useKeycloakWrapper';
import yup from 'utils/YupSchema';

export interface IAddSystemUsersFormArrayItem {
  userIdentifier: string;
  identitySource: string;
  system_role: number;
}

export interface IAddSystemUsersForm {
  systemUsers: IAddSystemUsersFormArrayItem[];
}

export const AddSystemUsersFormArrayItemInitialValues: IAddSystemUsersFormArrayItem = {
  userIdentifier: '',
  identitySource: '',
  system_role: '' as unknown as number
};

export const AddSystemUsersFormInitialValues: IAddSystemUsersForm = {
  systemUsers: [AddSystemUsersFormArrayItemInitialValues]
};

export const AddSystemUsersFormYupSchema = yup.object().shape({
  systemUsers: yup.array().of(
    yup.object().shape({
      userIdentifier: yup.string().required('Username is required'),
      identitySource: yup.string().required('Login Method is required'),
      system_role: yup.number().required('Role is required')
    })
  )
});

export interface AddSystemUsersFormProps {
  system_roles: any[];
}

const AddSystemUsersForm: React.FC<React.PropsWithChildren<AddSystemUsersFormProps>> = (props) => {
  const { values, handleChange, handleSubmit, getFieldMeta } = useFormikContext<IAddSystemUsersForm>();

  return (
    <form onSubmit={handleSubmit}>
      <FieldArray
        name="systemUsers"
        render={(arrayHelpers) => (
          <Box>
            <Box>
              {values.systemUsers?.map((systemUser, index) => {
                const userIdentifierMeta = getFieldMeta(`systemUsers.[${index}].userIdentifier`);
                const identitySourceMeta = getFieldMeta(`systemUsers.[${index}].identitySource`);
                const systemRoleMeta = getFieldMeta(`systemUsers.[${index}].roleId`);

                return (
                  <Box display="flex" key={index} mx={-0.5} alignItems="flex-start">
                    <Box width="300px" py={1} px={0.5}>
                      <CustomTextField
                        name={`systemUsers.[${index}].userIdentifier`}
                        label="Username"
                        other={{
                          required: true,
                          value: systemUser.userIdentifier,
                          error: userIdentifierMeta.touched && Boolean(userIdentifierMeta.error),
                          helperText: userIdentifierMeta.touched && userIdentifierMeta.error
                        }}
                      />
                    </Box>
                    <Box width="250px" py={1} px={0.5}>
                      <FormControl fullWidth required error={systemRoleMeta.touched && Boolean(systemRoleMeta.error)}>
                        <InputLabel id="system_role">System Role</InputLabel>
                        <Select
                          id={`systemUsers.[${index}].system_role`}
                          name={`systemUsers.[${index}].system_role`}
                          labelId="system_role"
                          label="System Role"
                          value={systemUser.system_role}
                          onChange={handleChange}
                          error={systemRoleMeta.touched && Boolean(systemRoleMeta.error)}
                          inputProps={{ 'aria-label': 'System Role' }}
                        >
                          {props?.system_roles?.map((item) => (
                            <MenuItem key={item.value} value={item.value}>
                              {item.label}
                            </MenuItem>
                          ))}
                        </Select>
                        <FormHelperText>{systemRoleMeta.touched && systemRoleMeta.error}</FormHelperText>
                      </FormControl>
                    </Box>
                    <Box width="250px" py={1} px={0.5}>
                      <FormControl
                        fullWidth
                        required
                        error={identitySourceMeta.touched && Boolean(identitySourceMeta.error)}
                      >
                        <InputLabel id="loginMethod">Login Method</InputLabel>
                        <Select
                          id={`systemUsers.[${index}].identitySource`}
                          name={`systemUsers.[${index}].identitySource`}
                          labelId="login_method"
                          label="Login Method"
                          value={systemUser.identitySource}
                          onChange={handleChange}
                          error={identitySourceMeta.touched && Boolean(identitySourceMeta.error)}
                          inputProps={{ 'aria-label': 'Login Method' }}
                        >
                          <MenuItem key={SYSTEM_IDENTITY_SOURCE.IDIR} value={SYSTEM_IDENTITY_SOURCE.IDIR}>
                            IDIR
                          </MenuItem>
                          <MenuItem key={SYSTEM_IDENTITY_SOURCE.BCEID} value={SYSTEM_IDENTITY_SOURCE.BCEID}>
                            BCEID
                          </MenuItem>
                        </Select>
                        <FormHelperText>{identitySourceMeta.touched && identitySourceMeta.error}</FormHelperText>
                      </FormControl>
                    </Box>
                    <Box py={2} px={0.5}>
                      <IconButton
                        data-testid="delete-icon"
                        aria-label="Remove user"
                        onClick={() => arrayHelpers.remove(index)}
                      >
                        <Icon path={mdiTrashCanOutline} size={1} />
                      </IconButton>
                    </Box>
                  </Box>
                );
              })}
            </Box>
            <Box mt={1}>
              <Button
                type="button"
                variant="text"
                color="primary"
                data-testid="add-participant-button"
                startIcon={<Icon path={mdiPlus} size={1} />}
                onClick={() => arrayHelpers.push(AddSystemUsersFormArrayItemInitialValues)}
              >
                Add user
              </Button>
            </Box>
          </Box>
        )}
      />
    </form>
  );
};

export default AddSystemUsersForm;
