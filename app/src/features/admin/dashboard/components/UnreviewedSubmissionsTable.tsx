import { mdiTextBoxCheckOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Box, Divider, Paper } from '@mui/material';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import SubmissionCardSkeletonLoader from 'features/admin/dashboard/components/SubmissionCardSkeletonLoader';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { Link as RouterLink } from 'react-router-dom';
import { getFormattedDate, pluralize as p } from 'utils/Utils';

const UnreviewedSubmissionsTable = () => {
  const biohubApi = useApi();

  const unreviewedSubmissionsDataLoader = useDataLoader(() => biohubApi.submissions.getUnreviewedSubmissions());

  unreviewedSubmissionsDataLoader.load();

  const submissionRecords = unreviewedSubmissionsDataLoader.data || [];

  if (unreviewedSubmissionsDataLoader.isLoading) {
    return <SubmissionCardSkeletonLoader />;
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
      <Box pb={4}>
        <Typography variant="h4" component="h2">{`${submissionRecords.length} ${p(
          submissionRecords.length,
          'record'
        )} found`}</Typography>
      </Box>
      <Stack gap={2}>
        {submissionRecords.map((submissionRecord) => {
          return (
            <Card elevation={0} key={submissionRecord.submission_id}>
              <Stack flex="1 1 auto" gap={1} p={2}>
                <Stack flexDirection="row" alignItems="flex-start" gap={2}>
                  <Typography
                    component="h3"
                    variant="h4"
                    sx={{
                      flex: '1 1 auto',
                      display: '-webkit-box',
                      WebkitLineClamp: '2',
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis'
                    }}>
                    {submissionRecord.name}
                  </Typography>
                  <Chip
                    color="default"
                    size="small"
                    label={submissionRecord.feature_type_name}
                    sx={{
                      borderRadius: '4px',
                      textTransform: 'uppercase',
                      typography: 'caption',
                      fontWeight: 700
                    }}
                  />
                </Stack>

                <Typography
                  variant="body1"
                  color="textSecondary"
                  sx={{
                    display: '-webkit-box',
                    mb: 0.5,
                    WebkitLineClamp: '2',
                    WebkitBoxOrient: 'vertical',
                    maxWidth: 800,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                  {submissionRecord.description}
                </Typography>

                <Divider flexItem></Divider>

                <Stack flexDirection="row" justifyContent="space-between" alignItems="center">
                  <Stack
                    component="dl"
                    flexDirection={{ xs: 'column', sm: 'row' }}
                    alignItems={{ xs: 'flex-start', md: 'center' }}
                    justifyContent="flex-start"
                    gap={{ sm: 0, md: 2 }}
                    divider={<Divider orientation="vertical" flexItem />}
                    sx={{
                      typography: 'body2',
                      whiteSpace: 'nowrap',
                      '& dd': {
                        color: 'text.secondary',
                        width: { xs: 80, md: 'auto' }
                      },
                      '& dt': {
                        ml: 1,
                        fontWeight: 700
                      }
                    }}>
                    <Stack flexDirection="row">
                      <dd>Submitted:</dd>
                      <dt>{getFormattedDate(DATE_FORMAT.ShortDateFormat, submissionRecord.create_date)}</dt>
                    </Stack>
                    <Stack flexDirection="row">
                      <dd>Source:</dd>
                      <dt>{submissionRecord.source_system}</dt>
                    </Stack>
                  </Stack>
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
            </Card>
          );
        })}
      </Stack>
    </>
  );
};

export default UnreviewedSubmissionsTable;