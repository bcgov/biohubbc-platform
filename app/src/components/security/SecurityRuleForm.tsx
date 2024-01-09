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
import { GridRowSelectionModel } from '@mui/x-data-grid';
import { IPatchFeatureSecurityRules } from 'interfaces/useSecurityApi.interface';

export const SecurityRuleFormYupSchema = yup.object().shape({
  // rules: yup.array(yup.object()) // TODO
});

export interface ISecurityRuleFormProps {
  initialAppliedSecurityRules: ISubmissionFeatureSecurityRecord[]
}

interface IAppliedSecurityRuleGroup {
  securityRuleId: number;
  submissionFeatureIds: number[];
}

const SecurityRuleForm = (props: ISecurityRuleFormProps) => {
  const formikProps = useFormikContext<IPatchFeatureSecurityRules>();
  const [searchText, setSearchText] = useState('');

  const submissionContext = useSubmissionContext();

  // List all potential security rules
  const { allSecurityRulesStaticListDataLoader } = submissionContext;

  const hasNoSecuritySelected = !props.initialAppliedSecurityRules.length;

  const groupedAppliedSecurityRules: IAppliedSecurityRuleGroup[] = useMemo(() => {
    return props
      .initialAppliedSecurityRules
      .reduce((groups: IAppliedSecurityRuleGroup[], securityRecord: ISubmissionFeatureSecurityRecord) => {
        const groupIndex = groups.findIndex((group) => group.securityRuleId === securityRecord.security_rule_id)

        if (groupIndex === -1) {
          groups.push({
            securityRuleId: securityRecord.security_rule_id,
            submissionFeatureIds: [securityRecord.submission_feature_id]
          })
        } else {
          groups[groupIndex].submissionFeatureIds.push(securityRecord.submission_feature_id)
        }

        return groups;
      }, []);
    }, [props.initialAppliedSecurityRules]);

  console.log({ groupedAppliedSecurityRules, allSecurityRulesStaticListData: allSecurityRulesStaticListDataLoader.data })

  const [appliedRules, unappliedRules] = useMemo(() => {
    const applied: ISecurityRuleAndCategory[] = [];
    const unapplied: ISecurityRuleAndCategory[] = [];

    (allSecurityRulesStaticListDataLoader.data ?? []).forEach((securityRule) => {
      if (groupedAppliedSecurityRules.some((group) => group.securityRuleId === securityRule.security_rule_id)) {
        applied.push(securityRule);
      } else {
        unapplied.push(securityRule);
      }
    });

    return [applied, unapplied];
  }, [allSecurityRulesStaticListDataLoader.data]) // TODO Deps

  const stageForApply = (securityRule: ISecurityRuleAndCategory) => {
    formikProps.setFieldValue('applyRuleIds', [...formikProps.values.applyRuleIds, securityRule.security_rule_id])
  }

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
        <Typography variant='body2'>{JSON.stringify(props)}</Typography>
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
                    subtitle={renderOption.description}
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
          uhhhh
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
