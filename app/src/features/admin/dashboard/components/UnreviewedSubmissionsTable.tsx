import { mdiTextBoxCheckOutline } from '@mdi/js';
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
import dayjs from 'dayjs';
import SubmissionsListSortMenu from 'features/submissions/list/SubmissionsListSortMenu';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { SubmissionRecordWithSecurityAndRootFeature } from 'interfaces/useSubmissionsApi.interface';
import { Link as RouterLink } from 'react-router-dom';
import { getDaysSinceDate, pluralize as p } from 'utils/Utils';

const UnreviewedSubmissionsTable = () => {
  const biohubApi = useApi();

  const unreviewedSubmissionsDataLoader = useDataLoader(() =>
    biohubApi.submissions.getUnreviewedSubmissionsForAdmins()
  );

  unreviewedSubmissionsDataLoader.load();

  const submissionRecords = unreviewedSubmissionsDataLoader.data || [];

  const handleSortSubmissions = (submissions: SubmissionRecordWithSecurityAndRootFeature[]) => {
    unreviewedSubmissionsDataLoader.setData(submissions);
  };

  if (unreviewedSubmissionsDataLoader.isLoading) {
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
            <Icon path={mdiTextBoxCheckOutline} size={2} />
          </Box>
          <Typography
            data-testid="no-security-reviews"
            component="h2"
            variant="h4"
            fontWeight={700}
            sx={{
              mb: 1
            }}>
            No security reviews required
          </Typography>
          <Typography variant="body2" color="textSecondary">
            No submissions currently require security reviews.
          </Typography>
        </Stack>
      </>
    );
  }

  return (
    <>
      <Stack mb={4} flexDirection="row" justifyContent="space-between">
        <Typography variant="h4" component="h2">{`${submissionRecords.length} ${p(
          submissionRecords.length,
          'record'
        )} found`}</Typography>
        <Box my={-1}>
          <SubmissionsListSortMenu
            sortMenuItems={{ submitted_timestamp: 'Date Submitted' }}
            submissions={submissionRecords}
            handleSubmissions={handleSortSubmissions}
            apiSortSync={{ key: 'submitted_timestamp', sort: 'desc' }}
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
                      <dt>{getDaysSinceDate(dayjs(submissionRecord.create_date))}</dt>
                    </Stack>
                    <Stack flexDirection="row">
                      <dd>Source:</dd>
                      <dt>{submissionRecord.source_system}</dt>
                    </Stack>
                  </Stack>
                  <Stack flexDirection="row" alignItems="center" gap={1} flexWrap="nowrap">
                    <Button
                      component={RouterLink}
                      variant="contained"
                      color="primary"
                      to={`/admin/dashboard/submissions/${submissionRecord.submission_id}`}
                      sx={{
                        flex: '0 0 auto',
                        minWidth: '7rem'
                      }}>
                      Review
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

export default UnreviewedSubmissionsTable;
