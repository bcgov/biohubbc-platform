import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, AlertTitle, Collapse, ListItem, Stack, Typography } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import { ISecurityRuleAndCategory } from 'hooks/api/useSecurityApi';
import { useSubmissionContext } from 'hooks/useContext';
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
  rules: ISecurityRuleAndCategory[];
}

export const SecurityRuleFormYupSchema = yup.object().shape({
  rules: yup.array(yup.object())
});

const SecurityRuleForm = (props: ISecurityRuleFormProps) => {
  const { handleSubmit, values, setFieldValue } = useFormikContext<ISecurityRuleFormikProps>();
  const [searchText, setSearchText] = useState('');

  const submissionContext = useSubmissionContext();

  // List of all potential security rules
  const securityRules = submissionContext.allSecurityRulesStaticListDataLoader.data || [];

  const hasNoSecuritySelected = !values.rules.length;

  const handleAdd = (selected: ISecurityRuleAndCategory) => {
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
        <Box mt={3}>
          <Autocomplete
            id={'autocomplete-security-rule-search'}
            data-testid={'autocomplete-security-rule-search'}
            filterSelectedOptions
            clearOnBlur
            loading={submissionContext.allSecurityRulesStaticListDataLoader.isLoading}
            noOptionsText="No records found"
            options={alphabetizeObjects(securityRules, 'name')}
            filterOptions={(options, state) => {
              const searchFilter = createFilterOptions<ISecurityRuleAndCategory>({
                ignoreCase: true,
                matchFrom: 'any',
                stringify: (option) => option.name + option.category_name
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
                  <SecurityRuleCard
                    title={renderOption.name}
                    category={renderOption.category_name}
                    subtitle={renderOption.description}
                  />
                </ListItem>
              );
            }}
          />
        </Box>
        <Stack component={TransitionGroup} gap={1} mt={1}>
          {values.rules.map((rule: ISecurityRuleAndCategory) => {
            return (
              <Collapse key={rule.security_rule_id}>
                <SecurityRuleActionCard
                  security_rule_id={rule.security_rule_id}
                  name={rule.name}
                  category={rule.category_name}
                  description={rule.description}
                  remove={handleRemove}
                />
              </Collapse>
            );
          })}
        </Stack>
        {hasNoSecuritySelected && (
          <Alert severity="error" sx={{ marginTop: 1 }}>
            <AlertTitle>Open access to all records</AlertTitle>
            All users will have unrestricted access to records that have been included in this submission.
          </Alert>
        )}
      </Box>
    </form>
  );
};

export default SecurityRuleForm;
