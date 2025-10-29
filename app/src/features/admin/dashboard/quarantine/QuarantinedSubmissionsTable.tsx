import { mdiTextBoxCheckOutline } from '@mdi/js';
import Icon from '@mdi/react';
import { Paper, Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import RecordsFoundSkeletonLoader from 'components/skeleton/submission-card/RecordsFoundSkeletonLoader';
import SubmissionCardSkeletonLoader from 'components/skeleton/submission-card/SubmissionCardSkeletonLoader';
import SubmissionsListSortMenu from 'features/submissions/list/SubmissionsListSortMenu';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { SubmissionRecordWithQuarantine } from 'interfaces/useQuarantineApi.interface';
import { pluralize } from 'utils/Utils';
import { QuarantinedSubmissionsCard } from './card/QuarantinedSubmissionsCard';

/**
 * Table of quarantined submission records
 *
 * @returns
 */
export const QuarantinedSubmissionsTable = () => {
  const biohubApi = useApi();

  const quarantinedSubmissionsDataLoader = useDataLoader(() =>
    biohubApi.quarantine.getQuarantinedSubmissionsForAdmins()
  );

  quarantinedSubmissionsDataLoader.load();

  const submissionRecords = quarantinedSubmissionsDataLoader.data?.submissions ?? [];

  const handleSortSubmissions = (submissions: SubmissionRecordWithQuarantine[]) => {
    quarantinedSubmissionsDataLoader.setData({ submissions });
  };

  /**
   * Trigger a malware scan for a specific quarantine record.
   */
  const handleScan = async (record: SubmissionRecordWithQuarantine) => {
    try {
      await biohubApi.quarantine.scanQuarantineForMalware(record.submission_id);
      // Reload after scan initiation to refresh scan status
      quarantinedSubmissionsDataLoader.refresh();
    } catch (error) {
      console.error('Error initiating malware scan:', error);
    }
  };

  /**
   * Skip malware scan for a specific quarantine record.
   */
  const handleSkipScan = async (record: SubmissionRecordWithQuarantine) => {
    try {
      await biohubApi.quarantine.skipQuarantineMalwareScan(record.quarantine.quarantine_id);
      // Reload list to reflect updated status
      quarantinedSubmissionsDataLoader.refresh();
    } catch (error) {
      console.error('Error skipping malware scan:', error);
    }
  };

  if (quarantinedSubmissionsDataLoader.isLoading) {
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
      <Stack mb={4} alignItems="center" flexDirection="row" justifyContent="space-between">
        <Typography variant="h4" component="h2">
          {`${submissionRecords.length} ${pluralize(submissionRecords.length, 'record')} found`}
        </Typography>
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
        {submissionRecords.map((record) => (
          <QuarantinedSubmissionsCard
            key={record.submission_id}
            record={record}
            onScan={() => handleScan(record)}
            onSkipScan={() => handleSkipScan(record)}
          />
        ))}
      </Stack>
    </>
  );
};

export default QuarantinedSubmissionsTable;
