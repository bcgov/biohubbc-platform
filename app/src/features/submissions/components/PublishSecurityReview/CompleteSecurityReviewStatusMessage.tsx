import { mdiAlertCircleOutline, mdiLock, mdiLockAlertOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import { Box } from '@mui/system';
import { SECURITY_APPLIED_STATUS, SubmissionRecordWithSecurity } from 'interfaces/useDatasetApi.interface';

export interface ICompleteSecurityReviewStatusMessageProps {
  submission: SubmissionRecordWithSecurity;
}

const CompleteSecurityReviewStatusMessage = (props: ICompleteSecurityReviewStatusMessageProps) => {
  const { submission } = props;

  if (submission.security === SECURITY_APPLIED_STATUS.SECURED) {
    return (
      <Box mt={3}>
        <Alert severity="info" icon={<Icon path={mdiLock} size={1} />}>
          <AlertTitle>
            <strong>{'All records secured'}</strong>
          </AlertTitle>
          {'Access to secured records will be restricted pending approval by a BioHub Administrator.'}
        </Alert>
      </Box>
    );
  }

  if (submission.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) {
    return (
      <Box mt={3}>
        <Alert severity="info" icon={<Icon path={mdiLockAlertOutline} size={1} />}>
          <AlertTitle>
            <strong>{'Some records are secured'}</strong>
          </AlertTitle>
          {
            'Users can access unsecured records. Access to secured records will be restricted pending approval by a BioHub Administrator.'
          }
        </Alert>
      </Box>
    );
  }

  return (
    <Box mt={3}>
      <Alert severity="error" icon={<Icon path={mdiAlertCircleOutline} size={1} />}>
        <AlertTitle>
          <strong>{'Open access to all records'}</strong>
        </AlertTitle>
        {'Users can access all records.'}
      </Alert>
    </Box>
  );
};

export default CompleteSecurityReviewStatusMessage;
