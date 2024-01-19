import { mdiTextBoxSearchOutline, mdiTrayArrowDown } from '@mdi/js';
import Icon from '@mdi/react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActions from '@mui/material/CardActions';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
import Chip from '@mui/material/Chip';
import grey from '@mui/material/colors/grey';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RecordsFoundSkeletonLoader from 'components/skeleton/submission-card/RecordsFoundSkeletonLoader';
import SubmissionCardSkeletonLoader from 'components/skeleton/submission-card/SubmissionCardSkeletonLoader';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import SubmissionsListSortMenu from 'features/submissions/list/SubmissionsListSortMenu';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDownload from 'hooks/useDownload';
import { SubmissionRecordWithSecurityAndRootFeature } from 'interfaces/useSubmissionsApi.interface';
import { Link as RouterLink } from 'react-router-dom';
import { getFormattedDate, pluralize as p } from 'utils/Utils';

const PublishedSubmissionsTable = () => {
  const biohubApi = useApi();
  const download = useDownload();

  const publishedSubmissionsDataLoader = useDataLoader(() => biohubApi.submissions.getPublishedSubmissionsForAdmins());

  publishedSubmissionsDataLoader.load();

  const submissionRecords = publishedSubmissionsDataLoader.data || [];

  const onDownload = async (submission: SubmissionRecordWithSecurityAndRootFeature) => {
    // make request here for JSON data of submission and children
    const data = await biohubApi.submissions.getSubmissionDownloadPackage(submission.submission_id);
    download.downloadJSON(data, `${submission.name.toLowerCase().replace(/ /g, '-')}-${submission.submission_id}`);
  };

  const handleSortSubmissions = (submissions: SubmissionRecordWithSecurityAndRootFeature[]) => {
    publishedSubmissionsDataLoader.setData(submissions);
  };

  if (publishedSubmissionsDataLoader.isLoading) {
    return (
      <>
        <RecordsFoundSkeletonLoader />
        <SubmissionCardSkeletonLoader />
      </>
    );
  }

  if (submissionRecords.length === 0) {
    return (
      <>
        <Box pb={4}>
          <Typography variant="h4" component="h2">
            No records found
          </Typography>
        </Box>
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
            No completed security reviews
          </Typography>
          <Typography variant="body2" color="textSecondary">
            No submissions have completed security review.
          </Typography>
        </Stack>
      </>
    );
  }

  return (
    <>
      <Stack mb={4} alignItems="center" flexDirection="row" justifyContent="space-between">
        <Typography variant="h4" component="h2">{`${submissionRecords.length} ${p(
          submissionRecords.length,
          'record'
        )} found`}</Typography>
        <Box my={-1}>
          <SubmissionsListSortMenu
            sortMenuItems={{
              name: 'Name',
              security_review_timestamp: 'Review Complete',
              publish_timestamp: 'Publish Date',
              source_system: 'Submitting System'
            }}
            submissions={submissionRecords}
            handleSubmissions={handleSortSubmissions}
            apiSortSync={{ key: 'publish_timestamp', sort: 'asc' }}
          />
        </Box>
      </Stack>
      <Stack gap={2}>
        {submissionRecords.map((submissionRecord) => {
          return (
            <Card elevation={0} key={submissionRecord.submission_id}>
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
                    {submissionRecord.name}
                  </Typography>
                }
                action={
                  <Chip
                    label={submissionRecord.root_feature_type_name}
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
                  {submissionRecord.description}
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
                    flexDirection={{ xs: 'column', sm: 'row' }}
                    gap={{ xs: 0, sm: 1 }}
                    my={1}
                    component="dl"
                    divider={<Divider flexItem orientation="vertical"></Divider>}
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
                      <dd>Submitted:</dd>
                      <dt>{getFormattedDate(DATE_FORMAT.ShortDateFormat, submissionRecord.create_date)}</dt>
                    </Stack>
                    <Stack flexDirection="row">
                      <dd>Published:</dd>
                      <dt>
                        {submissionRecord.publish_timestamp &&
                          getFormattedDate(DATE_FORMAT.ShortDateFormat, submissionRecord.publish_timestamp)}
                      </dt>
                    </Stack>
                    <Stack flexDirection="row">
                      <dd>Source:</dd>
                      <dt>{submissionRecord.source_system}</dt>
                    </Stack>
                    {submissionRecord.regions.length > 0 && (
                      <Stack flexDirection="row">
                        <dd>{p(submissionRecord.regions.length, 'Region')}:</dd>
                        <dt>{submissionRecord.regions.sort().join(', ')}</dt>
                      </Stack>
                    )}
                  </Stack>
                  <Stack flexDirection="row" alignItems="center" gap={1} flexWrap="nowrap">
                    <Button
                      variant="contained"
                      color="primary"
                      component={RouterLink}
                      to={`/admin/dashboard/submissions/${submissionRecord.submission_id}`}
                      sx={{
                        flex: '0 0 auto',
                        minWidth: '7rem'
                      }}>
                      View
                    </Button>
                  </Stack>
                  <Stack flexDirection="row" alignItems="center" gap={1} flexWrap="nowrap">
                    <Button
                      variant="contained"
                      startIcon={<Icon path={mdiTrayArrowDown} size={0.75} />}
                      onClick={() => onDownload(submissionRecord)}>
                      Download
                    </Button>
                  </Stack>
                </Stack>
              </CardActions>
            </Card>
          );
        })}
      </Stack>
    </>
  );
};

export default PublishedSubmissionsTable;
