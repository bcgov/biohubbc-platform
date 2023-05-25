import { Paper } from '@mui/material';
import { ActionToolbar } from 'components/toolbar/ActionToolbars';

// export interface SecurityReasonSelectorProps {
//   name: string;
// }

/**
 * Security Reason Selector for security application.
 *
 * @return {*}
 */
const SecurityReasonSelector: React.FC = () => {
  return (
    <>
      <Paper elevation={2}>
        <ActionToolbar label={`Security Reasons`} labelProps={{ variant: 'h4' }} />
      </Paper>
    </>
  );
};

export default SecurityReasonSelector;
