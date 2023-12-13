import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Stack from '@mui/system/Stack';
import SecureDataAccessRequestDialog from 'features/datasets/security/SecureDataAccessRequestDialog';
import { SearchInput } from 'features/search/SearchComponent';
import { FuseResult } from 'fuse.js';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDownloadJSON from 'hooks/useDownloadJSON';
import useFuzzySearch from 'hooks/useFuzzySearch';
import { SECURITY_APPLIED_STATUS } from 'interfaces/useDatasetApi.interface';
import { ISubmission } from 'interfaces/useSubmissionsApi.interface';
import React, { useState } from 'react';
import DatasetSortMenu from './components/SubmissionsListSortMenu';
import Chip from '@mui/material/Chip';
import { DATE_FORMAT } from 'constants/dateTimeFormats';
import { getFormattedDate } from 'utils/Utils';
import { mdiCommentOutline, mdiTrayArrowDown } from '@mdi/js';
import Icon from '@mdi/react';
import CardHeader from '@mui/material/CardHeader';
import CardContent from '@mui/material/CardContent';
import CardActions from '@mui/material/CardActions';
import grey from '@mui/material/colors/grey';
import Skeleton from '@mui/material/Skeleton';

/**
 * Renders reviewed Submissions as cards with download and request access actions
 *
 * @returns {*}
 */
const SubmissionsListPage = () => {
  const biohubApi = useApi();
  const download = useDownloadJSON();

  const submissionsLoader = useDataLoader(() => biohubApi.submissions.listReviewedSubmissions());
  submissionsLoader.load();

  // this is what the page renders / mutates
  const [openRequestAccess, setOpenRequestAccess] = useState(false);
  const { fuzzyData, handleFuzzyData, handleSearch, searchValue, highlight } = useFuzzySearch<ISubmission>(
    submissionsLoader.data,
    { keys: ['name', 'description'] }
  );

  const handleDownload = async (dataset: FuseResult<ISubmission>) => {
    // make request here for JSON data of submission and children
    const data = await biohubApi.submissions.getSubmissionDownloadPackage();
    download(data, `${dataset.item.name.toLowerCase().replace(/ /g, '-')}-${dataset.item.submission_feature_id}`);
  };

  const handleRequestAccess = () => {
    setOpenRequestAccess(true);
  };

  return (
    <>
      <SecureDataAccessRequestDialog
        open={openRequestAccess}
        onClose={() => setOpenRequestAccess(false)}
        artifacts={[]}
        initialArtifactSelection={[]}
      />
      <Box>
        <Paper
          square
          elevation={0}
          sx={{
            py: 4
          }}>
          <Container maxWidth="xl">
            <Typography mb={1} variant="h1">
              BioHub BC
            </Typography>
            <Typography mb={3} variant="body1" color="textSecondary">
              Open access to British Columbia's terrestrial, aquatic species and habitat inventory data.
            </Typography>
            <SearchInput
              placeholderText="Enter a submission title or keyword"
              value={searchValue}
              handleChange={handleSearch}
            />
          </Container>
        </Paper>
        <Container maxWidth="xl">

          <Box py={4}>

            <Stack mb={4} flexDirection="row" alignItems="center" justifyContent="space-between">
              <Typography variant="h4" component="h2">
                {searchValue
                  ? `${fuzzyData.length} records found for "${searchValue}"`
                  : `${fuzzyData.length} records found`}
              </Typography>
              <DatasetSortMenu
                data={fuzzyData}
                handleSortedFuzzyData={(data) => {
                  handleFuzzyData(data);
                }}
              />
            </Stack>

            <Stack gap={2}>
              
              {/* TODO: Need Skeleton Loader */}
              <Card elevation={0}>
                <CardHeader
                  title={
                    <Typography variant="h4">
                      <Skeleton sx={{maxWidth: 800, transform: 'scale(1, 0.8)'}}></Skeleton>
                    </Typography>
                  }
                  action={
                    <Skeleton width={70}></Skeleton>
                  }
                  sx={{
                    pb: 1,
                    '& .MuiCardHeader-action': {
                      margin: 0
                    }
                  }}
                >
                </CardHeader>
                <CardContent
                  sx={{
                    pt: 0
                  }}
                >
                  <Typography
                    variant="body1"
                    color="textSecondary"
                    sx={{
                      maxWidth: 800,
                    }}>
                      <Skeleton sx={{maxWidth: 400}}></Skeleton>
                  </Typography>
                </CardContent>
                <CardActions
                    sx={{
                      px: 2,
                      py: 1.5,
                      borderTop: '1px solid' + grey[200]
                    }}
                  >
                  <Stack 
                    flexDirection="row"
                    alignItems="center" 
                    justifyContent="space-between" 
                    width="100%"
                  >
                    <Skeleton width={150}></Skeleton>
                    <Skeleton variant="rectangular" height={36} width={100}
                      sx={{
                        borderRadius: '4px'
                      }}
                    ></Skeleton>
                  </Stack>
                </CardActions>
              </Card>
              
              {fuzzyData?.map((dataset) => (
                <Card elevation={0} key={dataset.item.submission_feature_id}>
                  <CardHeader
                    title={
                      <Typography variant="h4">
                        {highlight(dataset.item.name, dataset?.matches?.find((match) => match.key === 'name')?.indices)}
                      </Typography>
                    }
                    action={
                      <Chip 
                        label='Dataset' 
                        size="small"
                        sx={{
                          my: '-2px',
                          fontSize: '12px',
                          borderRadius: '4px'
                        }}
                      />
                    }
                    sx={{
                      pb: 1,
                      '& .MuiCardHeader-action': {
                        margin: 0
                      }
                    }}
                  >
                  </CardHeader>
                  <CardContent
                    sx={{
                      pt: 0
                    }}
                  >
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
                        dataset.item.description,
                        dataset?.matches?.find((match) => match.key === 'description')?.indices
                      )}
                    </Typography>
                  </CardContent>
                  <CardActions
                    sx={{
                      px: 2,
                      py: 1.5,
                      borderTop: '1px solid' + grey[200]
                    }}
                  >
                    <Stack
                      width="100%"
                      flexDirection={{xs: 'column', sm: 'row'}}
                      flexWrap="wrap"
                      justifyContent="space-between">
                      <Stack
                        flex="1 1 auto"
                        my={1}
                        component="dl"
                        sx={{
                          typography: 'body2',
                          whiteSpace: 'nowrap',
                          '& dd': {
                            color: 'text.secondary',
                          },
                          '& dt': {
                            ml: 1,
                          }
                        }}>
                        <Stack flexDirection="row">
                          <dd>Published:</dd>
                          <dt>{getFormattedDate(DATE_FORMAT.ShortDateFormat, dataset.item.submission_date.toDateString())}</dt>
                        </Stack>
                      </Stack>
                      <Stack flexDirection="row" alignItems="center" gap={1} flexWrap="nowrap">
                        {(dataset.item.security === SECURITY_APPLIED_STATUS.SECURED ||
                          dataset.item.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) && (
                            <Button
                              variant={'contained'}
                              disableElevation
                              startIcon={<Icon path={mdiCommentOutline} size={0.75} />}
                              sx={{
                                fontWeight: 700
                              }}
                              onClick={() => {
                                handleRequestAccess();
                              }}>
                              Request Access
                            </Button>
                          )}
                        {(dataset.item.security === SECURITY_APPLIED_STATUS.UNSECURED ||
                          dataset.item.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) && (
                            <Button
                              variant="contained"
                              startIcon={<Icon path={mdiTrayArrowDown} size={0.75} />}
                              onClick={() => {
                                handleDownload(dataset);
                              }}>
                              Download
                            </Button>
                          )}
                      </Stack>
                    </Stack>
                  </CardActions>
                </Card>
              ))}
            </Stack>

          </Box>
        </Container>
      </Box>
    </>
  );
};

export default SubmissionsListPage;
