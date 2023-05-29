import { Paper } from '@mui/material';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';
import { FieldArray, useFormikContext } from 'formik';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { IArtifact } from 'interfaces/useDatasetApi.interface';
import yup from 'utils/YupSchema';
import SecurityReasonCategory, { ISecurityReason, SecurityReason } from './SecurityReasonCategory';

export interface SecurityReasonSelectorProps {
  selectedArtifacts: IArtifact[];
}
export interface ISelectSecurityReasonForm {
  securityReasons: ISecurityReason[];
}

export const SecurityReasonsInitialValues: ISelectSecurityReasonForm = {
  securityReasons: []
};

export const SecurityReasonsYupSchema = yup.object().shape({
  securityReasons: yup
    .array()
    .min(1, 'A minimum of 1 security reason is required')
    .of(
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
const SecurityReasonSelector: React.FC<SecurityReasonSelectorProps> = (props) => {
  const biohubApi = useApi();
  const persecutionHarmDataLoader = useDataLoader(() => biohubApi.security.listPersecutionHarmRules());
  persecutionHarmDataLoader.load();

  const { values } = useFormikContext<ISelectSecurityReasonForm>();

  if (!persecutionHarmDataLoader.data) {
    return <></>; //TODO: Loader Spinner
  }

  return (
    <Paper elevation={3} sx={{ height: '100%', width: '100%', display: 'flex', overflow: 'hidden' }}>
      <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column' }}>
        <ActionToolbar label={`Security Reasons`} labelProps={{ variant: 'h4' }} />
        <Divider></Divider>
        <Box sx={{ p: 2, height: '100%', overflow: 'hidden', overflowY: 'scroll' }}>
          <SecurityReasonCategory
            categoryName={'Persecution or Harm'}
            securityReasons={persecutionHarmDataLoader.data as unknown as ISecurityReason[]}
          />
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem />

      <Box sx={{ width: '50%' }}>
        <ActionToolbar
          label={`Applied Security Reasons (${values.securityReasons.length})`}
          labelProps={{ variant: 'h4' }}
        />
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
                        key={index}
                        securityReason={securityReason}
                        onClickSecurityReason={() => arrayHelpers.remove(index)}
                        icon="minus"
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
