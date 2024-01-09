import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, AlertTitle, Collapse, ListItem, Stack, Typography } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import { ISecurityRuleAndCategory, ISubmissionFeatureSecurityRecord } from 'hooks/api/useSecurityApi';
import { useSubmissionContext } from 'hooks/useContext';
import { useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import { alphabetizeObjects } from 'utils/Utils';
import yup from 'utils/YupSchema';
import SecurityRuleActionCard from './SecurityRuleActionCard';
import SecurityRuleCard from './SecurityRuleCard';
import { GridRowSelectionModel } from '@mui/x-data-grid';
import { IPatchFeatureSecurityRules } from 'interfaces/useSecurityApi.interface';

/**
 * Form data that represents the security state of all selected security rules
 *
 * @export
 * @interface ISecurityRuleForm
 */
export interface ISecurityRuleForm {
  securityAppliedRule: ISubmissionFeatureSecurityRecord[];
  diff: IPatchFeatureSecurityRules;
}

export const SecurityRuleFormYupSchema = yup.object().shape({
  // rules: yup.array(yup.object()) // TODO
});

export interface ISecurityRuleFormProps {
  submissionFeatureIds: GridRowSelectionModel
}

const SecurityRuleForm = (props: ISecurityRuleFormProps) => {
  const formikProps = useFormikContext<ISecurityRuleForm>();
  const [searchText, setSearchText] = useState('');

  const submissionContext = useSubmissionContext();

  // List all potential security rules
  const { allSecurityRulesStaticListDataLoader } = submissionContext;
  const allSecurityRules = allSecurityRulesStaticListDataLoader.data || [];

  const hasNoSecuritySelected = !formikProps.values.securityAppliedRule.length;

  const handleAdd = (selected: ISecurityRuleAndCategory) => {
    formikProps.setFieldValue(`rules[${formikProps.values.securityAppliedRule.length}]`, selected);
  };

  const handleRemove = (idToRemove: number) => {
    const formData = formikProps.values.securityAppliedRule;
    const filteredData = formData.filter((item) => item.security_rule_id !== idToRemove);
    formikProps.setFieldValue('rules', filteredData);
  };

  return (
    <form onSubmit={formikProps.handleSubmit}>
      <Box component="fieldset">
        <Typography
          variant="body1"
          color="textSecondary"
          sx={{
            maxWidth: '72ch'
          }}>
          Specify reasons why this information should be secured.
        </Typography>
        <Typography variant='body2'>{JSON.stringify(props)}</Typography>
        <Box mt={3}>
          <Autocomplete
            id={'autocomplete-security-rule-search'}
            data-testid={'autocomplete-security-rule-search'}
            filterSelectedOptions
            clearOnBlur
            loading={submissionContext.allSecurityRulesStaticListDataLoader.isLoading}
            noOptionsText="No records found"
            options={alphabetizeObjects(allSecurityRules, 'name')}
            filterOptions={(options, state) => {
              const searchFilter = createFilterOptions<ISecurityRuleAndCategory>({
                ignoreCase: true,
                matchFrom: 'any',
                stringify: (option) => option.name + option.category_name
              });
              const unselectedOptions = options.filter(
                (item) => !formikProps.values.securityAppliedRule.some((existing) => existing.security_rule_id === item.security_rule_id)
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
                placeholder={'Add security reasons'}
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
          {/* {formikProps.values.rules.map((rule: ISecurityRuleAndCategory) => {
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
          })} */}
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
