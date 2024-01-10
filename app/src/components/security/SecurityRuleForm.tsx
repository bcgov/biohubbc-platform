import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, AlertTitle, Collapse, ListItem, Stack, Typography } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import { ISecurityRuleAndCategory, ISubmissionFeatureSecurityRecord } from 'hooks/api/useSecurityApi';
import { useSubmissionContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import { alphabetizeObjects } from 'utils/Utils';
import yup from 'utils/YupSchema';
import SecurityRuleActionCard from './SecurityRuleActionCard';
import SecurityRuleCard from './SecurityRuleCard';

import { IPatchFeatureSecurityRules } from 'interfaces/useSecurityApi.interface';


export const SecurityRuleFormYupSchema = yup.object().shape({
  // rules: yup.array(yup.object()) // TODO
});

// export interface ISecurityRuleFormProps { // ODO not needed anymore?
//   initialAppliedSecurityRules: ISubmissionFeatureSecurityRecord[]
// }

interface IAppliedSecurityRuleGroup {
  securityRule: ISecurityRuleAndCategory;
  submissionFeatureIds: number[];
  appliedFeatureGroups: { displayName: string, numFeatures: number }[]
}

const SecurityRuleForm = () => {
  const formikProps = useFormikContext<IPatchFeatureSecurityRules>();
  const [searchText, setSearchText] = useState('');

  const submissionContext = useSubmissionContext();

  // List all potential security rules
  const {
    allSecurityRulesStaticListDataLoader, 
    submissionFeaturesAppliedRulesDataLoader,
    submissionFeatureGroupsDataLoader
  } = submissionContext;

  const allSecurityRules = useMemo(() => {
    return allSecurityRulesStaticListDataLoader.data ?? [];
  }, [allSecurityRulesStaticListDataLoader.data]);

  const initialAppliedSecurityRules = useMemo(() => {
    return submissionFeaturesAppliedRulesDataLoader.data ?? []
  }, [submissionFeaturesAppliedRulesDataLoader.data]);

  /**
   * An aggregate of all security rules that have been applied to one or more of the selected features,
   * in addition to all of the features IDs and features types (with counts) that belong to each rule.
   */
  const groupedAppliedSecurityRules: IAppliedSecurityRuleGroup[] = useMemo(() => {
    return initialAppliedSecurityRules.reduce((ruleGroups: IAppliedSecurityRuleGroup[], securityRecord: ISubmissionFeatureSecurityRecord) => {
      const ruleGroupIndex = ruleGroups.findIndex((ruleGroup) => ruleGroup.securityRule.security_rule_id === securityRecord.security_rule_id)

      const featureGroupDisplayName = (submissionFeatureGroupsDataLoader.data ?? [])
        .find((featureGroup) => {
          return featureGroup.features.some((feature) => feature.submission_feature_id === securityRecord.submission_feature_id)
        })
        ?.feature_type_display_name || 'Other'

      if (ruleGroupIndex === -1) {
        const securityRule = allSecurityRules.find((securityRule) => securityRule.security_rule_id === securityRecord.security_rule_id);
        if (securityRule) {
          ruleGroups.push({
            securityRule,
            submissionFeatureIds: [securityRecord.submission_feature_id],
            appliedFeatureGroups: [{ displayName: featureGroupDisplayName, numFeatures: 1 }]
          })
        }
      } else {
        ruleGroups[ruleGroupIndex].submissionFeatureIds.push(securityRecord.submission_feature_id);

        const featureGroupIndex = ruleGroups[ruleGroupIndex].appliedFeatureGroups.findIndex((featureGroup) => {
          return featureGroup.displayName === featureGroupDisplayName
        });

        if (featureGroupIndex === -1) {
          ruleGroups[ruleGroupIndex].appliedFeatureGroups.push({ displayName: featureGroupDisplayName, numFeatures: 1 })
        } else {
          ruleGroups[ruleGroupIndex].appliedFeatureGroups[featureGroupIndex].numFeatures ++;
        }
      }

      return ruleGroups;
    }, []);
  }, [initialAppliedSecurityRules, submissionFeatureGroupsDataLoader.data]);

  console.log({ groupedAppliedSecurityRules })
  console.log({ test: submissionFeatureGroupsDataLoader.data })

  const [appliedRules, unappliedRules] = useMemo(() => {
    const applied: ISecurityRuleAndCategory[] = [];
    const unapplied: ISecurityRuleAndCategory[] = [];

    allSecurityRules.forEach((securityRule) => {
      if (groupedAppliedSecurityRules.some((group) => group.securityRule.security_rule_id === securityRule.security_rule_id)) {
        applied.push(securityRule);
      } else {
        unapplied.push(securityRule);
      }
    });

    return [applied, unapplied];
  }, [allSecurityRules]) // TODO Deps

  const stageForApply = (securityRule: ISecurityRuleAndCategory) => {
    formikProps.setFieldValue('applyRuleIds', [...formikProps.values.applyRuleIds, securityRule.security_rule_id])
  }

  const hasNoSecuritySelected = !initialAppliedSecurityRules.length;

  console.log({appliedRules, unappliedRules})

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

        <Box mt={3}>
          <Typography variant='h6'>Apply a New Rule</Typography>
          <Autocomplete
            id={'autocomplete-security-rule-search'}
            data-testid={'autocomplete-security-rule-search'}
            filterSelectedOptions
            clearOnBlur
            loading={submissionContext.allSecurityRulesStaticListDataLoader.isLoading}
            noOptionsText="No records found"
            options={alphabetizeObjects(unappliedRules, 'name')}
            filterOptions={(options, state) => {
              const searchFilter = createFilterOptions<ISecurityRuleAndCategory>({
                ignoreCase: true,
                matchFrom: 'any',
                stringify: (option) => option.name + option.category_name
              });
              return searchFilter(unappliedRules, state);
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
                stageForApply(option);
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
                    description={renderOption.description}
                  />
                </ListItem>
              );
            }}
          />
        </Box>
        <p>{JSON.stringify({ applyRuleIds: formikProps.values.applyRuleIds })}</p>

        <Box mt={3}>
          <Typography variant='h6'>Previously Applied Rules</Typography>
        </Box>
        <Stack component={TransitionGroup} gap={1} mt={1}>
          {groupedAppliedSecurityRules.map((group: IAppliedSecurityRuleGroup) => {
            return (
              <Collapse key={group.securityRule.security_rule_id}>
                <SecurityRuleActionCard
                  title={group.securityRule.name}
                  category={group.securityRule.category_name}
                  description={group.securityRule.description}
                  featureMembers={group.appliedFeatureGroups.map((featureGroup) => `${featureGroup.displayName} (${featureGroup.numFeatures})`)}
                  onRemove={() => {}}
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
