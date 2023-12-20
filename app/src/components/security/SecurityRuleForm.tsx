import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, AlertTitle, Collapse, ListItem, Stack, Typography } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import { ISecurityRule } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import { useSubmissionContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import { alphabetizeObjects } from 'utils/Utils';
import yup from 'utils/YupSchema';
import SecurityRuleActionCard from './SecurityRuleActionCard';
import SecurityRuleCard from './SecurityRuleCard';

export interface ISecurityRuleFormProps {
  features: number[];
}

export interface ISecurityRuleFormikProps {
  rules: ISecurityRule[];
}

export const SecurityRuleFormYupSchema = yup.object().shape({
  rules: yup.array(yup.object()).min(1)
});

const SecurityRuleForm = (props: ISecurityRuleFormProps) => {
  const api = useApi();
  const submissionContext = useSubmissionContext();

  const { handleSubmit, errors, values, setFieldValue } = useFormikContext<ISecurityRuleFormikProps>();
  const [searchText, setSearchText] = useState('');

  const securityRules = submissionContext.securityRulesDataLoader.data || [];

  const submissionFeatureRulesDataLoader = useDataLoader(api.security.getSecurityRulesForSubmissions);
  submissionFeatureRulesDataLoader.load(props.features);

  const showSecuredBanner = Boolean(submissionFeatureRulesDataLoader.data?.length);

  const handleAdd = (selected: ISecurityRule) => {
    setFieldValue(`rules[${values.rules.length}]`, selected);
  };

  const handleRemove = (idToRemove: number) => {
    const formData = values.rules;
    const filteredData = formData.filter((item) => item.security_rule_id !== idToRemove);
    setFieldValue('rules', filteredData);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Box component="fieldset">
        <Typography
          variant="body1"
          color="textSecondary"
          sx={{
            maxWidth: '72ch'
          }}>
          Specify reasons why this information should be secured.
        </Typography>
        {showSecuredBanner && (
          <Box mt={3}>
            <Alert severity="info" variant="standard">
              <AlertTitle>Security Applied</AlertTitle>
              Some security rules have already been applied to this submission.
            </Alert>
          </Box>
        )}
        {errors?.['rules'] && !values.rules.length && (
          <Box mt={3}>
            <Alert severity="error" variant="standard">
              <AlertTitle>No Rules Selected</AlertTitle>
              At least one security rule needs to be selected.
            </Alert>
          </Box>
        )}
        <Box mt={3}>
          <Autocomplete
            id={'autocomplete-security-rule-search'}
            data-testid={'autocomplete-security-rule-search'}
            filterSelectedOptions
            clearOnBlur
            loading={submissionContext.securityRulesDataLoader.isLoading}
            noOptionsText="No records found"
            options={alphabetizeObjects(securityRules, 'name')}
            filterOptions={(options, state) => {
              const searchFilter = createFilterOptions<ISecurityRule>({
                ignoreCase: true
              });
              const unselectedOptions = options.filter(
                (item) => !values.rules.some((existing) => existing.security_rule_id === item.security_rule_id)
              );
              return searchFilter(unselectedOptions, state);
            }}
            getOptionLabel={(option) => option.name}
            isOptionEqualToValue={(option, value) => option.security_rule_id === value.security_rule_id}
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
                handleAdd(option);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="outlined"
                placeholder={'Find security reasons'}
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
                <ListItem
                  divider
                  sx={{
                    px: 2,
                    py: '12px !important'
                  }}
                  {...renderProps}>
                  <SecurityRuleCard title={renderOption.name} subtitle={renderOption.description} />
                </ListItem>
              );
            }}
          />
        </Box>
        <Stack component={TransitionGroup} gap={1} mt={1}>
          {values.rules.map((rule: ISecurityRule, index: number) => {
            return (
              <Collapse key={rule.security_rule_id}>
                <SecurityRuleActionCard
                  security_rule_id={rule.security_rule_id}
                  name={rule.name}
                  description={rule.description}
                  remove={handleRemove}
                />
              </Collapse>
            );
          })}
        </Stack>
      </Box>
    </form>
  );
};

export default SecurityRuleForm;
