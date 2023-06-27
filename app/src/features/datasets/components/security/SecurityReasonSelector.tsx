import { Button, Paper } from '@mui/material';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { FieldArray, useFormikContext } from 'formik';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import yup from 'utils/YupSchema';
import SecurityReasonCategory, { ISecurityReason, SecurityReason } from './SecurityReasonCategory';

export interface ISelectSecurityReasonForm {
  securityReasons: ISecurityReason[];
}

export const SecurityReasonsInitialValues: ISelectSecurityReasonForm = {
  securityReasons: []
};

export const SecurityReasonsYupSchema = yup.object().shape({
  securityReasons: yup.array().of(
    yup.object().shape({
      name: yup.string(),
      description: yup.string()
    })
  )
});

/**
 * Security Reason Selector for security application.
 *
 * @return {*}
 */
const SecurityReasonSelector: React.FC = () => {
  const biohubApi = useApi();
  const { values, setFieldValue } = useFormikContext<ISelectSecurityReasonForm>();
  const persecutionHarmDataLoader = useDataLoader(() => biohubApi.security.listPersecutionHarmRules());
  persecutionHarmDataLoader.load();

  if (!persecutionHarmDataLoader.data) {
    return <></>;
  }

  const persecutionHarmRules: ISecurityReason[] = persecutionHarmDataLoader.data.map((rule) => {
    return {
      category: 'Persecution or Harm',
      name: rule.name,
      description: rule.description,
      id: rule.persecution_or_harm_id,
      type_id: rule.persecution_or_harm_type_id,
      wldtaxonomic_units_id: rule.wldtaxonomic_units_id
    }
  });

  return (
    <Paper elevation={3} sx={{ height: '100%', width: '100%', display: 'flex', overflow: 'hidden' }}>
      <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
        <ActionToolbar label={`Security Reasons`} labelProps={{ variant: 'h4' }} />
        <Divider></Divider>
        <Box sx={{ height: '100%', overflow: 'hidden', overflowY: 'scroll' }}>
          {persecutionHarmDataLoader.data && (
            <SecurityReasonCategory
              categoryName={'Persecution or Harm'}
              securityReasons={persecutionHarmRules.filter((value: ISecurityReason) => {
                return !values.securityReasons.some((reason) => reason.name === value.name);
              })}
            />
          )}
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem />

      <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex' }}>
          <Box sx={{ width: '100%' }}>
            <ActionToolbar
              label={`Applied Security Reasons (${values.securityReasons.length})`}
              labelProps={{ variant: 'h4' }}
            />
          </Box>
          {values.securityReasons.length > 1 && (
            <Button
              sx={{ width: '20%', display: 'flex', justifyContent: 'center', alignContent: 'center' }}
              variant="text"
              color="primary"
              onClick={() => {
                setFieldValue('securityReasons', SecurityReasonsInitialValues.securityReasons);
              }}>
              Remove All
            </Button>
          )}
        </Box>
        <Divider></Divider>
        <Box sx={{ p: 2, height: '100%', overflow: 'hidden', overflowY: 'scroll' }}>
          <FieldArray
            name="securityReasons"
            render={(arrayHelpers) => (
              <>
                {values.securityReasons.map((securityReason, index) => {
                  return (
                    <Box key={securityReason.name} py={1} px={2}>
                      <SecurityReason
                        key={securityReason.id}
                        securityReason={securityReason}
                        onClick={() => arrayHelpers.remove(index)}
                        isSelected={true}
                      />
                    </Box>
                  );
                })}
              </>
            )}
          />
        </Box>
      </Box>
    </Paper>
  );
};

export default SecurityReasonSelector;
