import { CircularProgress, Divider } from '@mui/material';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { getFormattedDate, toTitleCase } from 'utils/Utils';

const DatasetsForReviewTable = () => {
  const biohubApi = useApi();

  const unreviewedSubmissionsDataLoader = useDataLoader(() => biohubApi.dataset.getUnreviewedSubmissions());

  unreviewedSubmissionsDataLoader.load();

  const submissionRecords = unreviewedSubmissionsDataLoader.data || [];

  if (unreviewedSubmissionsDataLoader.isLoading) {
    return <CircularProgress className="pageProgress" size={40} />;
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
            <Stack
              component={CardContent}
              flexDirection={{ sm: 'column', md: 'row' }}
              alignItems={{ sm: 'flex-start', md: 'center' }}
              gap={2}
              sx={{
                px: 3
              }}>
              <Stack flex="1 1 auto" gap={2}>
                <Stack flexDirection="row" alignItems="flex-start" gap={2}>
                  <Stack flex="1 1 auto" gap={1.5}>
                    <Stack
                      component="dl"
                      flexDirection="row"
                      alignItems="center"
                      sx={{
                        typography: 'body2',
                        whiteSpace: 'nowrap',
                        '& dd': {
                          color: 'text.secondary'
                        },
                        '& dt': {
                          color: 'text.secondary'
                        }
                      }}>
                      <Stack flexDirection="row">
                        <dd hidden>Submitted on:</dd>
                        <dt>{getFormattedDate(DATE_FORMAT.ShortDateFormat, submissionRecord.create_date)}</dt>
                      </Stack>
                    </Stack>
                    <Typography
                      component="h3"
                      variant="h4"
                      sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: '2',
                        WebkitBoxOrient: 'vertical',
                        maxWidth: 800,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                      {submissionRecord.name}
                    </Typography>
                  </Stack>
                </Stack>

                <Typography
                  variant="body1"
                  color="textSecondary"
                  sx={{
                    display: '-webkit-box',
                    WebkitLineClamp: '2',
                    WebkitBoxOrient: 'vertical',
                    mt: -0.65,
                    maxWidth: 800,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                  {submissionRecord.description}
                </Typography>

                <Stack
                  component="dl"
                  flexDirection={{ xs: 'column', md: 'row' }}
                  alignItems={{ xs: 'flex-start', md: 'center' }}
                  justifyContent="flex-start"
                  gap={{ md: 3 }}
                  divider={<Divider orientation="vertical" flexItem />}
                  sx={{
                    typography: 'body2',
                    whiteSpace: 'nowrap',
                    '& dd': {
                      color: 'text.secondary',
                      width: { xs: 60, md: 'auto' }
                    },
                    '& dt': {
                      ml: 1,
                      fontWeight: 700
                    }
                  }}>
                  <Stack flexDirection="row">
                    <dd>Type:</dd>
                    <dt>{toTitleCase(submissionRecord.feature_type)}</dt>
                  </Stack>
                  <Stack flexDirection="row">
                    <dd>Source:</dd>
                    <dt>{submissionRecord.source_system}</dt>
                  </Stack>
                </Stack>
              </Stack>

              <Stack
                minWidth={{ xs: 'auto', md: 300 }}
                alignItems={{ xs: 'flex-start', md: 'center' }}
                mt={{ xs: 1, md: 0 }}>
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
