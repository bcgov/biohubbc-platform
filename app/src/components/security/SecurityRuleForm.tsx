import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, AlertTitle, Typography } from '@mui/material';
import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import { useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import SecurityRuleCard from './SecurityRuleCard';

const SecurityRuleForm = () => {
  const { handleSubmit, values, setFieldValue, errors, setErrors } = useFormikContext<any>();
  const [selectedRules, setSelectedRules] = useState<any[]>([]);
  const [searchText, setSearchText] = useState('');

  return (
    <form onSubmit={() => {}}>
      <Box component="fieldset">
        <Typography component="legend">Manage Team Members</Typography>
        <Typography
          variant="body1"
          color="textSecondary"
          sx={{
            maxWidth: '72ch'
          }}>
          A minimum of one team member must be assigned the coordinator role.
        </Typography>
        {errors?.['participants'] && !selectedRules.length && (
          <Box mt={3}>
            <Alert severity="error" variant="standard">
              <AlertTitle>No Rules Selected</AlertTitle>
              At least one team member needs to be added to this project.
            </Alert>
          </Box>
        )}
        {errors?.['participants'] && selectedRules.length > 0 && (
          <Box mt={3}>{/* <AlertBar severity="error" variant="standard" title={''} text={''} /> */}</Box>
        )}
        <Box mt={3}>
          <Autocomplete
            id={'autocomplete-user-role-search'}
            data-testid={'autocomplete-user-role-search'}
            filterSelectedOptions
            noOptionsText="No records found"
            options={[]}
            // filterOptions={(options, state) => {
            //   const searchFilter = createFilterOptions<ISystemUser>({ ignoreCase: true });
            //   const unselectedOptions = options.filter(
            //     (item) => !selectedUsers.some((existing) => existing.system_user_id === item.system_user_id)
            //   );
            //   return searchFilter(unselectedOptions, state);
            // }}
            // getOptionLabel={(option) => option.display_name}
            inputValue={searchText}
            onInputChange={(_, value, reason) => {
              if (reason === 'reset') {
                setSearchText('');
              } else {
                setSearchText(value);
              }
            }}
            onChange={(_, option) => {
              if (option) {
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                placeholder={'Find team members'}
                fullWidth
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <Box mx={1} mt="6px">
                      <Icon path={mdiMagnify} size={1}></Icon>
                    </Box>
                  )
                }}
              />
            )}
            renderOption={(renderProps, renderOption) => {
              return (
                <Box component="li" {...renderProps}>
                  <SecurityRuleCard title={''} subtitle={''} />
                </Box>
              );
            }}
          />
        </Box>
        <Box>
          <Box
            sx={{
              '& .userRoleItemContainer + .userRoleItemContainer': {
                mt: 1
              }
            }}>
            <TransitionGroup>
              {selectedRules.map((rule: any, index: number) => {
                // const error = rowItemError(index);
                return (
                  <Collapse>
                    {/* <UserRoleSelector
                      index={index}
                      user={user}
                      roles={props.roles}
                      error={error}
                      selectedRole={getSelectedRole(index)}
                      handleAdd={handleAddUserRole}
                      handleRemove={handleRemoveUser}
                      key={user.system_user_id}
                      label={'Select a Role'}
                    /> */}
                    <></>
                  </Collapse>
                );
              })}
            </TransitionGroup>
          </Box>
        </Box>
      </Box>
    </form>
  );
};

export default SecurityRuleForm;
