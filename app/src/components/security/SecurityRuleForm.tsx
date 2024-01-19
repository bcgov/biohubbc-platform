import { mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, AlertTitle, Collapse, ListItem, Stack, Typography } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import { ISecurityRuleAndCategory, ISubmissionFeatureSecurityRecord } from 'hooks/api/useSecurityApi';
import { useSubmissionContext } from 'hooks/useContext';
import { IPatchFeatureSecurityRules } from 'interfaces/useSecurityApi.interface';
import { useMemo, useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import { alphabetizeObjects, pluralize as p } from 'utils/Utils';
import SecurityRuleActionCard from './SecurityRuleActionCard';
import SecurityRuleCard from './SecurityRuleCard';

interface IAppliedSecurityRuleGroup {
  securityRule: ISecurityRuleAndCategory;
  submissionFeatureIds: number[];
  appliedFeatureGroups: { displayName: string; numFeatures: number }[];
}

const SecurityRuleForm = () => {
  const formikProps = useFormikContext<IPatchFeatureSecurityRules>();
  const [searchText, setSearchText] = useState('');

  const submissionContext = useSubmissionContext();

  const {
    allSecurityRulesStaticListDataLoader,
    submissionFeaturesAppliedRulesDataLoader,
    submissionFeatureGroupsDataLoader
  } = submissionContext;

  // List all potential security rules
  const allSecurityRules = useMemo(() => {
    return allSecurityRulesStaticListDataLoader.data ?? [];
  }, [allSecurityRulesStaticListDataLoader.data]);

  const initialAppliedSecurityRules = useMemo(() => {
    return submissionFeaturesAppliedRulesDataLoader.data ?? [];
  }, [submissionFeaturesAppliedRulesDataLoader.data]);

  /**
   * An aggregate of all security rules that have been applied to one or more of the *selected* features,
   * in addition to all of the features IDs and features types (with counts) that belong to each rule.
   */
  const groupedAppliedSecurityRules: IAppliedSecurityRuleGroup[] = useMemo(() => {
    return (
      initialAppliedSecurityRules
        // Filter out any security records that don't pertain to the selected.
        .filter((securityRecord) =>
          formikProps.initialValues.submissionFeatureIds.includes(securityRecord.submission_feature_id)
        )

        // Group security records by rule, including associated feature IDs and feature type counts.
        .reduce((ruleGroups: IAppliedSecurityRuleGroup[], securityRecord: ISubmissionFeatureSecurityRecord) => {
          const ruleGroupIndex = ruleGroups.findIndex(
            (ruleGroup) => ruleGroup.securityRule.security_rule_id === securityRecord.security_rule_id
          );

          const featureGroupDisplayName =
            (submissionFeatureGroupsDataLoader.data ?? []).find((featureGroup) => {
              return featureGroup.features.some(
                (feature) => feature.submission_feature_id === securityRecord.submission_feature_id
              );
            })?.feature_type_display_name ?? 'Other';

          if (ruleGroupIndex === -1) {
            const securityRule = allSecurityRules.find(
              (securityRule) => securityRule.security_rule_id === securityRecord.security_rule_id
            );
            if (securityRule) {
              ruleGroups.push({
                securityRule,
                submissionFeatureIds: [securityRecord.submission_feature_id],
                appliedFeatureGroups: [{ displayName: featureGroupDisplayName, numFeatures: 1 }]
              });
            }
          } else {
            ruleGroups[ruleGroupIndex].submissionFeatureIds.push(securityRecord.submission_feature_id);

            const featureGroupIndex = ruleGroups[ruleGroupIndex].appliedFeatureGroups.findIndex((featureGroup) => {
              return featureGroup.displayName === featureGroupDisplayName;
            });

            if (featureGroupIndex === -1) {
              ruleGroups[ruleGroupIndex].appliedFeatureGroups.push({
                displayName: featureGroupDisplayName,
                numFeatures: 1
              });
            } else {
              ruleGroups[ruleGroupIndex].appliedFeatureGroups[featureGroupIndex].numFeatures++;
            }
          }

          return ruleGroups;
        }, [])
    );
  }, [initialAppliedSecurityRules, submissionFeatureGroupsDataLoader.data]);

  const toggleStageApply = (securityRule: ISecurityRuleAndCategory) => {
    if (
      formikProps.values.stagedForApply.some(
        (applyingRule) => applyingRule.security_rule_id === securityRule.security_rule_id
      )
    ) {
      formikProps.setFieldValue(
        'stagedForApply',
        formikProps.values.stagedForApply.filter((value) => value.security_rule_id !== securityRule.security_rule_id)
      );
    } else {
      formikProps.setFieldValue('stagedForApply', [...formikProps.values.stagedForApply, securityRule]);
    }
  };

  const toggleStageRemove = (securityRule: ISecurityRuleAndCategory) => {
    if (
      formikProps.values.stagedForRemove.some(
        (removingRule) => removingRule.security_rule_id === securityRule.security_rule_id
      )
    ) {
      formikProps.setFieldValue(
        'stagedForRemove',
        formikProps.values.stagedForRemove.filter((value) => value.security_rule_id !== securityRule.security_rule_id)
      );
    } else {
      formikProps.setFieldValue('stagedForRemove', [...formikProps.values.stagedForRemove, securityRule]);
    }
  };

  const applyRulesAvailableSortedOptions = useMemo(() => {
    return alphabetizeObjects(allSecurityRules, 'name');
  }, [allSecurityRules]);

  const hasNoSecuritySelected = !initialAppliedSecurityRules.length;

  return (
    <form onSubmit={formikProps.handleSubmit}>
      <Box component="fieldset" mt={1}>
        <Typography component="legend">Add Security Rules</Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mt: -1, mb: 3 }}>
          Select one or more security rules to apply to selected records.
        </Typography>
        <Autocomplete
          value={null}
          id={'autocomplete-security-rule-search'}
          data-testid={'autocomplete-security-rule-search'}
          filterSelectedOptions
          clearOnBlur
          loading={submissionContext.allSecurityRulesStaticListDataLoader.isLoading}
          noOptionsText="No records found"
          options={applyRulesAvailableSortedOptions}
          filterOptions={(options, state) => {
            const searchFilter = createFilterOptions<ISecurityRuleAndCategory>({
              ignoreCase: true,
              matchFrom: 'any',
              stringify: (option) => option.name + option.category_name
            });

            const selectableOptions = options.filter((securityRule) => {
              return !formikProps.values.stagedForApply.some(
                (applyingRule) => applyingRule.security_rule_id === securityRule.security_rule_id
              );
            });

            return searchFilter(selectableOptions, state);
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
              toggleStageApply(option);
            }
          }}
          renderInput={(params) => (
            <TextField
              {...params}
              variant="outlined"
              placeholder={'Security rules'}
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
                disablePadding
                divider
                sx={{
                  py: '12px !important',
                  px: 2
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
        <Stack component={TransitionGroup} gap={1} my={1}>
          {formikProps.values.stagedForApply.map((applyingRule) => {
            return (
              <Collapse key={applyingRule.security_rule_id}>
                <SecurityRuleActionCard
                  action={'apply'}
                  title={applyingRule.name}
                  category={applyingRule.category_name}
                  description={applyingRule.description}
                  onRemove={() => toggleStageApply(applyingRule)}
                />
              </Collapse>
            );
          })}
        </Stack>
      </Box>
      <Box component="fieldset" mt={2}>
        <Typography component="legend">Secured Records</Typography>
        <Typography variant="body1" color="textSecondary" sx={{ mt: -1 }}>
          Some of the selected records have been secured using one or more of the following rules.
        </Typography>

        <Stack component={TransitionGroup} gap={1} mt={3}>
          {groupedAppliedSecurityRules.map((group: IAppliedSecurityRuleGroup) => {
            const cardAction = formikProps.values.stagedForRemove.some(
              (removingRule) => removingRule.security_rule_id === group.securityRule.security_rule_id
            )
              ? 'remove'
              : 'persist';

            return (
              <Collapse key={group.securityRule.security_rule_id}>
                <SecurityRuleActionCard
                  action={cardAction}
                  title={group.securityRule.name}
                  category={group.securityRule.category_name}
                  description={group.securityRule.description}
                  featureMembers={group.appliedFeatureGroups.map(
                    (featureGroup) =>
                      `${p(featureGroup.numFeatures, featureGroup.displayName)} (${featureGroup.numFeatures})`
                  )}
                  onRemove={() => toggleStageRemove(group.securityRule)}
                />
              </Collapse>
            );
          })}
        </Stack>

        {hasNoSecuritySelected && (
          <Alert severity="error">
            <AlertTitle>No security applied</AlertTitle>
            All users will have unrestricted access to records that have been included in this submission.
          </Alert>
        )}
      </Box>
    </form>
  );
};

export default SecurityRuleForm;
