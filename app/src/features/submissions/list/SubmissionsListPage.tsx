import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RecordsFoundSkeletonLoader from 'components/skeleton/submission-card/RecordsFoundSkeletonLoader';
import SubmissionCardSkeletonLoader from 'components/skeleton/submission-card/SubmissionCardSkeletonLoader';
import SecureDataAccessRequestDialog from 'features/datasets/security/SecureDataAccessRequestDialog';
import { SearchInput } from 'features/search/SearchComponent';
import SubmissionsListSortMenu from 'features/submissions/components/SubmissionsListSortMenu';
import SubmissionsList from 'features/submissions/list/SubmissionsList';
import { FuseResult } from 'fuse.js';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDownloadJSON from 'hooks/useDownloadJSON';
import useFuzzySearch from 'hooks/useFuzzySearch';
import { SubmissionRecordPublished } from 'interfaces/useSubmissionsApi.interface';
import { useState } from 'react';
import { pluralize as p } from 'utils/Utils';

/**
 * Renders reviewed Submissions as cards with download and request access actions
 *
 * @returns {*}
 */
const SubmissionsListPage = () => {
  const biohubApi = useApi();
  const download = useDownloadJSON();

  const reviewedSubmissionsDataLoader = useDataLoader(() => biohubApi.submissions.getPublishedSubmissions());
  reviewedSubmissionsDataLoader.load();

  const [openRequestAccess, setOpenRequestAccess] = useState(false);

  const { fuzzyData, handleFuzzyData, handleSearch, searchValue } = useFuzzySearch<SubmissionRecordPublished>(
    reviewedSubmissionsDataLoader.data,
    { keys: ['name', 'description'] }
  );

  const onDownload = async (submission: FuseResult<SubmissionRecordPublished>) => {
    // make request here for JSON data of submission and children
    const data = await biohubApi.submissions.getSubmissionDownloadPackage();
    download(data, `${submission.item.name.toLowerCase().replace(/ /g, '-')}-${submission.item.submission_id}`);
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
            {(reviewedSubmissionsDataLoader.isLoading && (
              <>
                <RecordsFoundSkeletonLoader />
                <SubmissionCardSkeletonLoader />
              </>
            )) || (
              <>
                <Stack mb={4} flexDirection="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="h4" component="h2">
                    {`${fuzzyData.length} ${p(fuzzyData.length, 'record')} found`}
                  </Typography>
                  <SubmissionsListSortMenu
                    data={fuzzyData}
                    handleSortedFuzzyData={(data) => {
                      handleFuzzyData(data);
                    }}
                  />
                </Stack>
                <SubmissionsList
                  submissions={fuzzyData}
                  onDownload={onDownload}
                  onAccessRequest={() => setOpenRequestAccess(true)}
                />
              </>
            )}
          </Box>
        </Container>
      </Box>
    </>
  );
};

export default SubmissionsListPage;
