import { mdiClose, mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, AlertTitle, IconButton, Paper, Typography } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { FieldArray, FieldArrayRenderProps, useFormikContext } from 'formik';
import { ISecurityRule } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import { useEffect, useState } from 'react';
import { alphabetizeObjects } from 'utils/Utils';
import { ISecurityRuleFormProps } from './SecuritiesDialog';
import SecurityRuleCard from './SecurityRuleCard';

const SecurityRuleForm = () => {
  const { handleSubmit, errors, values } = useFormikContext<ISecurityRuleFormProps>();
  const [rules, setRules] = useState<ISecurityRule[]>([]);

  const api = useApi();
  useEffect(() => {
    const fetchData = async () => {
      const data = await api.security.getActiveSecurityRules();
      setRules(data);
    };

    fetchData();
  }, []);

  return (
    <form onSubmit={handleSubmit}>
      <Box component="fieldset">
        <Typography component="legend">Manage Security Rules</Typography>
        <Typography
          variant="body1"
          color="textSecondary"
          sx={{
            maxWidth: '72ch'
          }}>
          A minimum of one security rule must be selected.
        </Typography>
        {errors?.['rules'] && !values.rules.length && (
          <Box mt={3}>
            <Alert severity="error" variant="standard">
              <AlertTitle>No Rules Selected</AlertTitle>
              At least one security rule needs to be selected.
            </Alert>
          </Box>
        )}
        <FieldArray name="rules">
          {(helpers: FieldArrayRenderProps) => (
            <>
              <Box mt={3}>
                <Autocomplete
                  id={'autocomplete-security-rule-search'}
                  data-testid={'autocomplete-security-rule-search'}
                  filterSelectedOptions
                  clearOnBlur
                  noOptionsText="No records found"
                  options={alphabetizeObjects(rules, 'name')}
                  filterOptions={(options, state) => {
                    const searchFilter = createFilterOptions<ISecurityRule>({ ignoreCase: true });
                    const unselectedOptions = options.filter(
                      (item) => !values.rules.some((existing) => existing.security_rule_id === item.security_rule_id)
                    );
                    return searchFilter(unselectedOptions, state);
                  }}
                  getOptionLabel={(option) => option.name}
                  isOptionEqualToValue={(option, value) => option.security_rule_id === value.security_rule_id}
                  onChange={(_, option) => {
                    if (option) {
                      helpers.push(option);
                    }
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      variant="outlined"
                      placeholder={'Find Security Rules'}
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
                        <SecurityRuleCard title={renderOption.name} subtitle={renderOption.description} />
                      </Box>
                    );
                  }}
                />
              </Box>
              <Box mt={3}>
                {values.rules.map((rule: ISecurityRule, index: number) => {
                  return (
                    <Paper
                      key={rule.security_rule_id}
                      variant="outlined"
                      sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        p: 1,
                        mb: 1
                      }}>
                      <SecurityRuleCard key={rule.security_rule_id} title={rule.name} subtitle={rule.description} />
                      <IconButton onClick={() => helpers.remove(index)}>
                        <Icon path={mdiClose} size={1} />
                      </IconButton>
                    </Paper>
                  );
                })}
              </Box>
            </>
          )}
        </FieldArray>
      </Box>
    </form>
  );
};

export default SecurityRuleForm;