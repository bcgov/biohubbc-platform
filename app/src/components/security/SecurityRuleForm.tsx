import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, AlertTitle, Typography } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { FieldArray, FieldArrayRenderProps, useFormikContext } from 'formik';
import { ISecurityRule } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useEffect } from 'react';
import { alphabetizeObjects } from 'utils/Utils';
import { ISecurityRuleFormProps } from './SecuritiesDialog';
import SecurityRuleActionCard from './SecurityRuleActionCard';
import SecurityRuleCard from './SecurityRuleCard';

const SecurityRuleForm = () => {
  const { handleSubmit, errors, values, setFieldValue } = useFormikContext<ISecurityRuleFormProps>();
  const api = useApi();
  const rulesDataLoader = useDataLoader(() => api.security.getActiveSecurityRules());
  rulesDataLoader.load();

  const rules = rulesDataLoader.data || [];
  useEffect(() => {
    // FieldArray doesn't re render when the dataloader returns with data so the autocomplete will not have options
    // so setting the field value back to the forms initial values forces a re render
    setFieldValue('rules', []);
  }, [rules]);
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
                    <SecurityRuleActionCard
                      index={index}
                      security_rule_id={rule.security_rule_id}
                      name={rule.name}
                      description={rule.description}
                      remove={helpers.remove}
                    />
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
