import { mdiClipboardTextOutline, mdiLock, mdiLockAlertOutline, mdiLockOpenVariantOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Typography from '@mui/material/Typography';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { SECURITY_APPLIED_STATUS, SubmissionRecordWithSecurity } from 'interfaces/useDatasetApi.interface';
import { getFormattedDate } from 'utils/Utils';

export interface ISubmissionHeaderSecurityStatusProps {
  submission: SubmissionRecordWithSecurity;
}

const SubmissionHeaderSecurityStatus = (props: ISubmissionHeaderSecurityStatusProps) => {
  const { submission } = props;

  if (submission.security === SECURITY_APPLIED_STATUS.UNSECURED) {
    return (
      <>
        <Typography component="span" color="textSecondary" sx={{ mr: 1 }}>
          <Icon path={mdiLockOpenVariantOutline} size={1} />
        </Typography>
        <Typography component="span" color="textSecondary" sx={{ mr: 1 }}>
          Unsecured
        </Typography>
        <Typography component="span" color="textSecondary" sx={{ pl: 1, borderLeft: '1px solid' }}>
          Published:&nbsp;
          {getFormattedDate(DATE_FORMAT.ShortDateFormat, submission.security_review_timestamp as string)}
        </Typography>
      </>
    );
  }

  if (submission.security === SECURITY_APPLIED_STATUS.SECURED) {
    return (
      <>
        <Typography component="span" color="textSecondary" sx={{ mr: 1 }}>
          <Icon path={mdiLock} size={1} />
        </Typography>
        <Typography component="span" color="textSecondary" sx={{ mr: 1 }}>
          Secured
        </Typography>
        <Typography component="span" color="textSecondary" sx={{ pl: 1, borderLeft: '1px solid' }}>
          Published:&nbsp;
          {getFormattedDate(DATE_FORMAT.ShortDateFormat, submission.security_review_timestamp as string)}
        </Typography>
      </>
    );
  }

  if (submission.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) {
    return (
      <>
        <Typography component="span" color="textSecondary" sx={{ mr: 1 }}>
          <Icon path={mdiLockAlertOutline} size={1} />
        </Typography>
        <Typography component="span" color="textSecondary" sx={{ mr: 1 }}>
          Partially Secured
        </Typography>
        <Typography component="span" color="textSecondary" sx={{ pl: 1, borderLeft: '1px solid' }}>
          Published:&nbsp;
          {getFormattedDate(DATE_FORMAT.ShortDateFormat, submission.security_review_timestamp as string)}
        </Typography>
      </>
    );
  }

  return (
    <>
      <Typography component="span" color="textSecondary" sx={{ mr: 1 }}>
        <Icon path={mdiClipboardTextOutline} size={1} />
      </Typography>
      <Typography component="span" color="textSecondary" sx={{ mr: 1 }}>
        Pending Review
      </Typography>
      <Typography component="span" color="textSecondary" sx={{ pl: 1, borderLeft: '1px solid' }}>
        Submitted:&nbsp;{getFormattedDate(DATE_FORMAT.ShortDateFormat, submission.create_date as string)}
      </Typography>
    </>
  );
};

export default SubmissionHeaderSecurityStatus;
