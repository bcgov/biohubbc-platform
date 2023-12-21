import { mdiCommentOutline, mdiTrayArrowDown } from '@mdi/js';
import Icon from '@mdi/react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import grey from '@mui/material/colors/grey';
import Typography from '@mui/material/Typography';
import Stack from '@mui/system/Stack';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { FuseResult } from 'fuse.js';
import useFuzzySearch from 'hooks/useFuzzySearch';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import { SubmissionRecordPublished } from 'interfaces/useSubmissionsApi.interface';
import { getFormattedDate } from 'utils/Utils';

export interface ISubmissionsListProps {
  submissions: FuseResult<SubmissionRecordPublished>[];
  onDownload: (submission: FuseResult<SubmissionRecordPublished>) => void;
  onAccessRequest: () => void;
}

const SubmissionsList = (props: ISubmissionsListProps) => {
  const { submissions, onDownload, onAccessRequest } = props;

  const { highlight } = useFuzzySearch();

  return (
    <Stack gap={2}>
      {submissions?.map((submission) => (
        <Card elevation={0} key={submission.item.submission_id}>
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
                {highlight(submission.item.name, submission?.matches?.find((match) => match.key === 'name')?.indices)}
              </Typography>
            }
            action={
              <Chip
                label={submission.item.root_feature_type_display_name}
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
              {highlight(
                submission.item.description,
                submission?.matches?.find((match) => match.key === 'description')?.indices
              )}
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
                    {submission.item.publish_timestamp
                      ? getFormattedDate(DATE_FORMAT.ShortDateFormat, submission.item.publish_timestamp)
                      : 'Unpublished'}
                  </dt>
                </Stack>
              </Stack>
              <Stack flexDirection="row" alignItems="center" gap={1} flexWrap="nowrap">
                {(submission.item.security === SECURITY_APPLIED_STATUS.SECURED ||
                  submission.item.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) && (
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
                {(submission.item.security === SECURITY_APPLIED_STATUS.UNSECURED ||
                  submission.item.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) && (
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
