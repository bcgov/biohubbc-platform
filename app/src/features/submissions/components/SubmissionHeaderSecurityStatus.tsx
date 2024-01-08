import { mdiLock, mdiLockAlertOutline, mdiLockOpenOutline } from '@mdi/js';
import Icon from '@mdi/react';
import Divider from '@mui/material/Divider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { getFormattedDate } from 'utils/Utils';

export interface ISubmissionHeaderSecurityStatusProps {
  submission: SubmissionRecordWithSecurity;
}

const SubmissionHeaderSecurityStatus = (props: ISubmissionHeaderSecurityStatusProps) => {
  const { submission } = props;

  let securityStatus = <></>;

  switch (submission.security) {
    case SECURITY_APPLIED_STATUS.SECURED: {
      securityStatus = (
        <Stack
          flexDirection="row"
          alignItems="center"
          gap={0.75}
          sx={{
            '& *': {
              color: 'error.main'
            },
            '& svg': {
              mt: '-2px'
            }
          }}>
          <Icon path={mdiLock} size={0.75} />
          <Typography component="strong" variant="body2" sx={{ fontWeight: 700 }}>
            Secured
          </Typography>
        </Stack>
      );
      break;
    }
    case SECURITY_APPLIED_STATUS.PARTIALLY_SECURED: {
      securityStatus = (
        <Stack
          flexDirection="row"
          alignItems="center"
          gap={0.75}
          sx={{
            '& *': {
              color: 'error.main'
            },
            '& svg': {
              mt: '-2px'
            }
          }}>
          <Icon path={mdiLockAlertOutline} size={0.75} />
          <Typography component="strong" variant="body2" sx={{ fontWeight: 700 }}>
            Partially Secured
          </Typography>
        </Stack>
      );
      break;
    }
    default: {
      securityStatus = (
        <Stack
          flexDirection="row"
          alignItems="center"
          gap={0.75}
          sx={{
            '& *': {
              color: 'error.main'
            },
            '& svg': {
              mt: '-2px'
            }
          }}>
          <Icon path={mdiLockOpenOutline} size={0.75} />
          <Typography component="strong" variant="body2" sx={{ fontWeight: 700 }}>
            Unsecured
          </Typography>
        </Stack>
      );
      break;
    }
  }

  return (
    <Stack
      flexDirection="row"
      alignItems="center"
      gap={1.25}
      divider={<Divider flexItem orientation="vertical" />}
      sx={{
        textTransform: 'uppercase'
      }}
      title="Open access to all records">
      <Stack flexDirection="row" alignItems="center" gap={1}>
        {securityStatus}
      </Stack>

      {submission.publish_timestamp ? (
        <Stack flexDirection="row" alignItems="center" gap={0.75}>
          <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
            Published
          </Typography>
          <Typography component="span" variant="body2">
            ({getFormattedDate(DATE_FORMAT.ShortDateFormat, submission.publish_timestamp as string)})
          </Typography>
        </Stack>
      ) : submission.security_review_timestamp ? (
        <Stack flexDirection="row" alignItems="center" gap={0.75}>
          <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
            Review Complete
          </Typography>
          <Typography component="span" variant="body2">
            ({getFormattedDate(DATE_FORMAT.ShortDateFormat, submission.security_review_timestamp as string)})
          </Typography>
        </Stack>
      ) : (
        <Stack flexDirection="row" alignItems="center">
          <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
            Pending Review
          </Typography>
        </Stack>
      )}

      <Stack flexDirection="row" alignItems="center" gap={0.75}>
        <Typography component="span" variant="body2" sx={{ fontWeight: 700 }}>
          Date Submitted
        </Typography>
        <Typography component="span" variant="body2">
          ({getFormattedDate(DATE_FORMAT.ShortDateFormat, submission.create_date as string)})
        </Typography>
      </Stack>
    </Stack>
  );
};

export default SubmissionHeaderSecurityStatus;
