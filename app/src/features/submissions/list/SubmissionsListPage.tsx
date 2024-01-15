import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import RecordsFoundSkeletonLoader from 'components/skeleton/submission-card/RecordsFoundSkeletonLoader';
import SubmissionCardSkeletonLoader from 'components/skeleton/submission-card/SubmissionCardSkeletonLoader';
import SecureDataAccessRequestDialog from 'features/datasets/security/SecureDataAccessRequestDialog';
import { SearchInput } from 'features/search/SearchComponent';
import SubmissionsList from 'features/submissions/list/SubmissionsList';
import SubmissionsListSortMenu from 'features/submissions/list/SubmissionsListSortMenu';
import { FuseResult } from 'fuse.js';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import useDownload from 'hooks/useDownload';
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
  const { downloadJSON } = useDownload();

  const reviewedSubmissionsDataLoader = useDataLoader(() => biohubApi.submissions.getPublishedSubmissions());
  reviewedSubmissionsDataLoader.load();

  const [openRequestAccess, setOpenRequestAccess] = useState(false);

  const { fuzzyData, handleFuzzyData, handleSearch, searchValue } = useFuzzySearch<SubmissionRecordPublished>(
    reviewedSubmissionsDataLoader.data,
    { keys: ['name', 'description'] }
  );

  const onDownload = async (submission: FuseResult<SubmissionRecordPublished>) => {
    // make request here for JSON data of submission and children
    const data = await biohubApi.submissions.getSubmissionPublishedDownloadPackage(submission.item.submission_id);
    const fileName = `${submission.item.name.toLowerCase().replace(/ /g, '-')}-${submission.item.submission_id}`;
    downloadJSON(data, fileName);
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
            {reviewedSubmissionsDataLoader.isLoading ? (
              <>
                <RecordsFoundSkeletonLoader />
                <SubmissionCardSkeletonLoader />
              </>
            ) : (
              <>
                <Box pb={4} display="flex" flexDirection="row" justifyContent="space-between">
                  <Typography variant="h4" component="h2">{`${fuzzyData.length} ${p(
                    fuzzyData.length,
                    'record'
                  )} found`}</Typography>
                  <Box my={-1}>
                    <SubmissionsListSortMenu
                      sortMenuItems={{ publish_timestamp: 'Publish Date', name: 'Name' }}
                      submissions={fuzzyData}
                      handleSubmissions={(data) => {
                        handleFuzzyData(data);
                      }}
                      apiSortSync={{ key: 'publish_timestamp', sort: 'asc' }}
                    />
                  </Box>
                </Box>
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
