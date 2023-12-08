import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import CardHeader from '@mui/material/CardHeader';
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
            <Typography variant="h1" mb={2}>
              Submissions
            </Typography>
            <SearchInput
              placeholderText="Enter a submission title or keyword"
              value={searchValue}
              handleChange={handleSearch}
            />
          </Container>
        </Paper>
        <Container maxWidth="xl">
          <Box py={4} display="flex" alignItems="center" justifyContent="space-between">
            <Typography fontWeight="bold">
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
          </Box>
          <Stack spacing={2} mb={2}>
            {fuzzyData?.map((dataset) => (
              <Card elevation={0} key={dataset.item.submission_feature_id}>
                <CardHeader
                  title={highlight(dataset.item.name, dataset?.matches?.find((match) => match.key === 'name')?.indices)}
                  subheader={
                    <Typography variant="body2" color="textSecondary">
                      {dataset.item.submission_date.toDateString()}
                    </Typography>
                  }
                  action={
                    <>
                      {(dataset.item.security === SECURITY_APPLIED_STATUS.SECURED ||
                        dataset.item.security === SECURITY_APPLIED_STATUS.PARTIALLY_SECURED) && (
                        <Button
                          variant={'outlined'}
                          sx={{ ml: 'auto', minWidth: 150 }}
                          disableElevation
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
                          sx={{ ml: 1, minWidth: 150 }}
                          disableElevation
                          onClick={() => {
                            handleDownload(dataset);
                          }}>
                          Download
                        </Button>
                      )}
                    </>
                  }
                />
                <CardContent sx={{ pt: 0, display: 'flex', alignItems: 'center' }}>
                  <Typography variant="body1" color="textSecondary">
                    {highlight(
                      dataset.item.description,
                      dataset?.matches?.find((match) => match.key === 'description')?.indices
                    )}
                  </Typography>
                </CardContent>
              </Card>
            ))}
          </Stack>
        </Container>
      </Box>
    </>
  );
};

export default SubmissionsListPage;
