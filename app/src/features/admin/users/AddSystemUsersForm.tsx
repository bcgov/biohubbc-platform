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
import CustomTextFieldFormik from 'components/fields/CustomTextFieldFormik';
import { SYSTEM_IDENTITY_SOURCE } from 'constants/auth';
import { FieldArray, useFormikContext } from 'formik';
import get from 'lodash-es/get';
import yup from 'utils/YupSchema';

export interface IAddSystemUsersFormArrayItem {
  userIdentifier: string;
  userGuid: string;
  identitySource: string;
  systemRole: number;
}

export interface IAddSystemUsersForm {
  systemUsers: IAddSystemUsersFormArrayItem[];
}

export const AddSystemUsersFormArrayItemInitialValues: IAddSystemUsersFormArrayItem = {
  userIdentifier: '',
  userGuid: '',
  identitySource: '',
  systemRole: '' as unknown as number
};

export const AddSystemUsersFormInitialValues: IAddSystemUsersForm = {
  systemUsers: [AddSystemUsersFormArrayItemInitialValues]
};

export const AddSystemUsersFormYupSchema = yup.object().shape({
  systemUsers: yup.array().of(
    yup.object().shape({
      userIdentifier: yup.string().required('Username is required'),
      userGuid: yup.string().required('GUID is required'),
      identitySource: yup.string().required('Login Method is required'),
      systemRole: yup.number().required('Role is required')
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
              {values.systemUsers?.map((_: IAddSystemUsersFormArrayItem, index: number) => {
                const systemRoleName = `systemUsers.[${index}].systemRole`;
                const identitySourceName = `systemUsers.[${index}].identitySource`;
                const identitySourceMeta = getFieldMeta(identitySourceName);
                const systemRoleMeta = getFieldMeta(systemRoleName);

                return (
                  <Box display="flex" key={index} mx={-0.5} alignItems="flex-start">
                    <Box width="300px" py={1} px={0.5}>
                      <CustomTextFieldFormik
                        name={`systemUsers.[${index}].userIdentifier`}
                        label="Username"
                        required
                      />
                    </Box>
                    <Box width="300px" py={1} px={0.5}>
                      <CustomTextFieldFormik
                        name={`systemUsers.[${index}].userGuid`}
                        label="User GUID"
                        required
                      />
                    </Box>
                    <Box width="250px" py={1} px={0.5}>
                      <FormControl fullWidth required error={systemRoleMeta.touched && Boolean(systemRoleMeta.error)}>
                        <InputLabel id={`system-role-label-${index}`}>System Role</InputLabel>
                        <Select
                          id={systemRoleName}
                          name={systemRoleName}
                          labelId={`system-role-label-${index}`}
                          label="System Role"
                          value={get(values, systemRoleName) ?? ''}
                          onChange={handleChange}
                          error={systemRoleMeta.touched && Boolean(systemRoleMeta.error)}
                          inputProps={{ 'aria-label': 'System Role' }}>
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
                        error={identitySourceMeta.touched && Boolean(identitySourceMeta.error)}>
                        <InputLabel id={`login-method-label-${index}`}>Login Method</InputLabel>
                        <Select
                          id={identitySourceName}
                          name={identitySourceName}
                          labelId={`login-method-label-${index}`}
                          label="Login Method"
                          value={get(values, identitySourceName) ?? ''}
                          onChange={handleChange}
                          error={identitySourceMeta.touched && Boolean(identitySourceMeta.error)}
                          inputProps={{ 'aria-label': 'Login Method' }}>
                          <MenuItem key={SYSTEM_IDENTITY_SOURCE.IDIR} value={SYSTEM_IDENTITY_SOURCE.IDIR}>
                            IDIR
                          </MenuItem>
                          <MenuItem key={SYSTEM_IDENTITY_SOURCE.BCEID_BASIC} value={SYSTEM_IDENTITY_SOURCE.BCEID_BASIC}>
                            BCeID Basic
                          </MenuItem>
                          <MenuItem
                            key={SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS}
                            value={SYSTEM_IDENTITY_SOURCE.BCEID_BUSINESS}>
                            BCeID Business
                          </MenuItem>
                        </Select>
                        <FormHelperText>{identitySourceMeta.touched && identitySourceMeta.error}</FormHelperText>
                      </FormControl>
                    </Box>
                    <Box py={2} px={0.5}>
                      <IconButton
                        data-testid="delete-icon"
                        aria-label="Remove user"
                        onClick={() => arrayHelpers.remove(index)}>
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
                onClick={() => arrayHelpers.push(AddSystemUsersFormArrayItemInitialValues)}>
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
