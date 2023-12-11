import { mdiClose, mdiMagnify } from '@mdi/js';
import Icon from '@mdi/react';
import { Alert, AlertTitle, IconButton, Paper, Typography } from '@mui/material';
import Autocomplete, { createFilterOptions } from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import Collapse from '@mui/material/Collapse';
import TextField from '@mui/material/TextField';
import { useFormikContext } from 'formik';
import { ISecurityRule } from 'hooks/api/useSecurityApi';
import { useApi } from 'hooks/useApi';
import { useEffect, useState } from 'react';
import { TransitionGroup } from 'react-transition-group';
import { alphabetizeObjects } from 'utils/Utils';
import SecurityRuleCard from './SecurityRuleCard';

const SecurityRuleForm = () => {
  const { handleSubmit, errors } = useFormikContext<any>();
  const [selectedRules, setSelectedRules] = useState<ISecurityRule[]>([]);
  const [rules, setRules] = useState<ISecurityRule[]>([]);
  const [searchText, setSearchText] = useState('');

  const api = useApi();
  useEffect(() => {
    const fetchData = async () => {
      const data = await api.security.getActiveSecurityRules();
      setRules(data);
    };

    fetchData();
  }, []);

  const handleAdd = (rule: ISecurityRule) => {
    console.log('HANDLE ADD NEW RULE');
    setSelectedRules([...selectedRules, rule]);
  };

  const handleRemove = (idToRemove: number) => {
    console.log(`Please remove: ${idToRemove}`);
  };

  return (
    <form onSubmit={handleSubmit}>
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
            id={'autocomplete-security-rule-search'}
            data-testid={'autocomplete-security-rule-search'}
            filterSelectedOptions
            noOptionsText="No records found"
            options={alphabetizeObjects(rules, 'name')}
            filterOptions={(options, state) => {
              const searchFilter = createFilterOptions<ISecurityRule>({ ignoreCase: true });
              const unselectedOptions = options.filter(
                (item) => !selectedRules.some((existing) => existing.security_rule_id === item.security_rule_id)
              );
              return searchFilter(unselectedOptions, state);
            }}
            getOptionLabel={(option) => option.name}
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
        <Box>
          <Box mt={3}>
            <TransitionGroup>
              {/* This should probably be the formik array props? */}
              {selectedRules.map((rule: ISecurityRule, index: number) => {
                return (
                  <Collapse>
                    <Paper
                      variant="outlined"
                      sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        p: 1,
                        mb: 1
                      }}>
                      <SecurityRuleCard key={rule.security_rule_id} title={rule.name} subtitle={rule.description} />
                      <IconButton onClick={() => handleRemove(rule.security_rule_id)}>
                        <Icon path={mdiClose} size={1} />
                      </IconButton>
                    </Paper>
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
