import { Divider, Skeleton } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { getFormattedDate, toTitleCase } from 'utils/Utils';
import Chip from '@mui/material/Chip';

const DatasetsForReviewTable = () => {
  const biohubApi = useApi();

  const unreviewedSubmissionsDataLoader = useDataLoader(() => biohubApi.dataset.getUnreviewedSubmissions());

  unreviewedSubmissionsDataLoader.load();

  const submissionRecords = unreviewedSubmissionsDataLoader.data || [];

  if (unreviewedSubmissionsDataLoader.isLoading) {
    return (
      <Card>
        <Stack flex="1 1 auto" gap={1} p={2}>
          <Stack flexDirection="row" alignItems="flex-start" gap={2}>
            <Stack flex="1 1 auto" flexDirection="row" gap={1} justifyContent="space-between">
              <Typography
                component="h3"
                variant="h4"
                sx={{
                  flex: '1 1 auto',
                  maxWidth: 800
                }}>
                <Skeleton height={20} sx={{ transform: 'none' }}></Skeleton>
              </Typography>
              <Skeleton width={60}></Skeleton>
            </Stack>
          </Stack>
          <Typography
            variant="body1"
            sx={{
              mb: 0.5,
              maxWidth: 800,
            }}>
            <Skeleton></Skeleton>
            <Skeleton width="50%"></Skeleton>
          </Typography>
          <Divider flexItem></Divider>

          <Stack flexDirection="row" alignItems="center" justifyContent="space-between" gap={2}>
            <Stack flexDirection="row" gap={2}>
              <Skeleton width={100} />
              <Skeleton width={100} />
            </Stack>
            <Skeleton variant="rectangular" width={112} height={36} />
          </Stack>

        </Stack>
      </Card>
    );
  }

  if (submissionRecords.length === 0) {
    return (
      <Box
        sx={{
          p: 3,
          m: 1,
          display: 'flex',
          flexFlow: 'column',
          alignItems: 'center',
          position: 'relative',
          border: '1pt solid #dadada',
          borderRadius: '4px'
        }}>
        <Typography
          data-testid="no-security-reviews"
          component="strong"
          color="textSecondary"
          variant="body1"
          fontWeight={'bold'}>
          No Pending Security Reviews
        </Typography>
      </Box>
    );
  }

  return (
    <Stack gap={2}>
      {submissionRecords.map((submissionRecord) => {
        return (
          <Card>
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
                  label={toTitleCase(submissionRecord.feature_type)}
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

              <Stack
                flexDirection="row"
                justifyContent="space-between"
                alignItems="center"
              >
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
                  variant="contained"
                  color="primary"
                  onClick={() => {
                    // TODO wire up review button. Take user to admin submission page: SIMSBIOHUB-404
                  }}
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
  );
};

export default DatasetsForReviewTable;
