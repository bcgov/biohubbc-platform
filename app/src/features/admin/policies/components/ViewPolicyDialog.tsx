import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { OkDialog } from 'components/dialog/OkDialog';
import CustomTextField from 'components/fields/CustomTextField';
import { IPolicy } from 'interfaces/usePoliciesApi.interface';
import { transformApiToPolicyJson } from '../utils/policyTransform';
import { ReadOnlyPolicyJsonEditor } from './ReadOnlyPolicyJsonEditor';

interface IViewPolicyDialogProps {
  open: boolean;
  policy: IPolicy;
  onClose: () => void;
}

/**
 * Read-only policy viewer dialog.
 *
 * @param {IViewPolicyDialogProps} props
 * @return {*}
 */
export const ViewPolicyDialog = (props: IViewPolicyDialogProps) => {
  const { open, policy, onClose } = props;
  const formattedStatus = `${policy.status.charAt(0).toUpperCase()}${policy.status.slice(1)}`;
  const formattedPolicyJson = transformApiToPolicyJson(policy.statements);

  return (
    <OkDialog
      open={open}
      onClose={onClose}
      dialogTitle="View Policy"
      dialogText=""
      okButtonLabel="Close"
      dialogProps={{ fullWidth: true, maxWidth: 'md' }}
      dialogContent={
        <Box display="flex" flexDirection="column" gap={3} mt={1}>
          <CustomTextField label="Policy Name" value={policy.name} disabled fullWidth />
          <CustomTextField
            label="Description"
            value={policy.description || '-'}
            disabled
            fullWidth
            multiline
            rows={3}
          />
          <CustomTextField label="Status" value={formattedStatus} disabled fullWidth />

          <Box>
            <Typography component="legend" mb={1}>
              Definition
            </Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Add statements using JSON. Use the format:{' '}
              <code>urn:&lt;submissionId&gt;:&lt;featureType&gt;:&lt;featureId&gt;</code> for resources. Use{' '}
              <code>*</code> as a wildcard.
            </Typography>
            <ReadOnlyPolicyJsonEditor value={formattedPolicyJson} />
          </Box>
        </Box>
      }
    />
  );
};
