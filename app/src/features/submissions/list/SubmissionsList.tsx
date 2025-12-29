import { mdiCommentOutline, mdiTextBoxSearchOutline, mdiTrayArrowDown } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import { grey } from '@mui/material/colors';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/system/Stack';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import { SubmissionRecordPublishedForPublic } from 'interfaces/useSubmissionsApi.interface';
import { getFormattedDate } from 'utils/Utils';

export interface ISubmissionsListProps {
  submissions: SubmissionRecordPublishedForPublic[];
  onDownload: (submission: SubmissionRecordPublishedForPublic) => void;
  onAccessRequest: () => void;
}

const SubmissionsList = (props: ISubmissionsListProps) => {
  const { submissions, onDownload, onAccessRequest } = props;

  if (submissions.length === 0) {
    return (
      <>
        <Stack alignItems="center" justifyContent="center" p={3} component={Paper} elevation={0} minHeight={168}>
          <Box
            sx={{
              '& svg': {
                color: 'text.secondary'
              }
            }}>
            <Icon path={mdiTextBoxSearchOutline} size={2} />
          </Box>
          <Typography
            data-testid="no-security-reviews"
            component="h2"
            variant="h4"
            fontWeight={700}
            sx={{
              mb: 1
            }}>
            No records found
          </Typography>
        </Stack>
      </>
    );
  }

  return (
    <Stack gap={2}>
      {submissions?.map((submission) => (
        <Card elevation={0} key={submission.submission_id}>
          <CardHeader
            title={
              <Typography
                variant="h4"
                component="h3"
                sx={{
                  display: '-webkit-box',
                  WebkitLineClamp: '2',
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis'
                }}>
                {submission.name}
              </Typography>
            }
            action={
              <Chip
                label={submission.root_feature_type_display_name}
                size="small"
                sx={{
                  my: '-2px',
                  fontSize: '12px',
                  borderRadius: '4px',
                  textTransform: 'uppercase'
                }}
              />
            }
            sx={{
              pb: 1,
              '& .MuiCardHeader-action': {
                margin: 0
              }
            }}></CardHeader>
          <CardContent
            sx={{
              pt: 0
            }}>
            <Typography
              variant="body1"
              color="textSecondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: '2',
                WebkitBoxOrient: 'vertical',
                maxWidth: 800,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}>
              {submission.description}
            </Typography>
          </CardContent>
          <CardActions
            sx={{
              px: 2,
              py: 1.5,
              borderTop: '1px solid' + grey[200]
            }}>
            <Stack
              width="100%"
              flexDirection={{ xs: 'column', sm: 'row' }}
              flexWrap="wrap"
              gap={1}
              justifyContent="space-between">
              <Stack
                flex="1 1 auto"
                my={1}
                component="dl"
                sx={{
                  typography: 'body2',
                  whiteSpace: 'nowrap',
                  '& dd': {
                    color: 'text.secondary'
                  },
                  '& dt': {
                    ml: 1
                  }
                }}>
                <Stack flexDirection="row">
                  <dd>Published:</dd>
                  <dt>
                    {submission.publish_timestamp
                      ? getFormattedDate(DATE_FORMAT.ShortDateFormat, submission.publish_timestamp)
                      : 'Unpublished'}
                  </dt>
                </Stack>
              </Stack>
              <Stack flexDirection="row" alignItems="center" gap={1} flexWrap="nowrap">
                {(submission.security === SECURITY_APPLIED_STATUS.SECURED ||
                  submission.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) && (
                  <Button
                    variant={'contained'}
                    disableElevation
                    startIcon={<Icon path={mdiCommentOutline} size={0.75} />}
                    sx={{
                      fontWeight: 700
                    }}
                    onClick={() => onAccessRequest()}>
                    Request Access
                  </Button>
                )}
                {(submission.security === SECURITY_APPLIED_STATUS.UNSECURED ||
                  submission.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) && (
                  <Button
                    variant="contained"
                    startIcon={<Icon path={mdiTrayArrowDown} size={0.75} />}
                    onClick={() => onDownload(submission)}>
                    Download
                  </Button>
                )}
              </Stack>
            </Stack>
          </CardActions>
        </Card>
      ))}
    </Stack>
  );
};

export default SubmissionsList;
