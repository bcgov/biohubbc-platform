import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Collapse, ListItem, Stack, TextField } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import { useFormikContext } from 'formik';
import { ISecurityRuleAndCategory } from 'hooks/api/useSecurityApi';
import { useMemo, useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import { ISecurityFormValues } from './SecuritiesDialog';
import SecurityRuleActionCard from './SecurityRuleActionCard';
import SecurityRuleCard from './SecurityRuleCard';

interface SecurityRuleFormProps {
  options: ISecurityRuleAndCategory[];
  isLoading?: boolean;
}

export const SecurityRuleForm = ({ options, isLoading }: SecurityRuleFormProps) => {
  const { values, setFieldValue } = useFormikContext<ISecurityFormValues>();
  const [searchText, setSearchText] = useState('');

  const sortedOptions = useMemo(() => [...options].sort((a, b) => a.name.localeCompare(b.name)), [options]);

  // Options that are not yet applied
  const stagedForApplyOptions = sortedOptions.filter(
    (option) => !values.stagedForApply.some((appliedRule) => appliedRule.security_rule_id === option.security_rule_id)
  );

  // Add rule to stagedForApply and remove from stagedForRemove if present
  const handleAddRule = (rule: ISecurityRuleAndCategory) => {
    setFieldValue('stagedForApply', [...values.stagedForApply, rule]);
    setFieldValue(
      'stagedForRemove',
      values.stagedForRemove.filter((removedRule) => removedRule.security_rule_id !== rule.security_rule_id)
    );
  };

  // Remove rule from stagedForApply and add to stagedForRemove
  const handleRemoveRule = (rule: ISecurityRuleAndCategory) => {
    setFieldValue('stagedForRemove', [...values.stagedForRemove, rule]);
    setFieldValue(
      'stagedForApply',
      values.stagedForApply.filter((appliedRule) => appliedRule.security_rule_id !== rule.security_rule_id)
    );
  };

  return (
    <Stack gap={2}>
      <Autocomplete
        value={null}
        loading={isLoading}
        options={stagedForApplyOptions}
        inputValue={searchText}
        clearOnBlur
        getOptionLabel={(option) => option.name}
        isOptionEqualToValue={(option, value) => option.security_rule_id === value.security_rule_id}
        filterOptions={(options, state) =>
          createFilterOptions<ISecurityRuleAndCategory>({
            stringify: (option) => option.name + option.category_name
          })(options, state)
        }
        onInputChange={(_, value, reason) => setSearchText(reason !== 'input' ? '' : value)}
        onChange={(_, rule) => rule && handleAddRule(rule)}
        renderInput={(params) => (
          <TextField
            {...params}
            placeholder="Add security rules"
            slotProps={{
              input: {
                ...params.InputProps,
                startAdornment: (
                  <Box mx={1} mt="6px">
                    <Icon path={mdiMagnify} size={1} />
                  </Box>
                )
              }
            }}
          />
        )}
        renderOption={(props, rule) => (
          <ListItem {...props} divider>
            <SecurityRuleCard title={rule.name} category={rule.category_name} description={rule.description} />
          </ListItem>
        )}
      />

      <Stack component={TransitionGroup} gap={1}>
        {values.stagedForApply.map((rule) => {
          const option = options.find((option) => rule.security_rule_id === option.security_rule_id);

          if (!option) {
            return null;
          }

          return (
            <Collapse key={rule.security_rule_id}>
              <SecurityRuleActionCard
                action="persist"
                title={option.name}
                category={option.category_name}
                description={option.description}
                onRemove={() => handleRemoveRule(option)}
              />
            </Collapse>
          );
        })}
      </Stack>
    </Stack>
  );
};
