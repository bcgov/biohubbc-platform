import { Box, Breadcrumbs, Container, Link, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { useApi } from 'hooks/useApi';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { AdminSubmissionMetadata } from './content/AdminSubmissionMetadata';
import { AdminSubmissionUploads } from './content/AdminSubmissionUploads';

interface AdminSubmissionPageContentProps {
  submissionId: number;
}

/**
 * Displays administrative submission uploads and lifecycle metadata in separate tabs.
 *
 * @param {AdminSubmissionPageContentProps} props The submission to show.
 * @returns {JSX.Element} Submission header, tabs and their loading states.
 */
export const AdminSubmissionPageContent = ({ submissionId }: AdminSubmissionPageContentProps) => {
  const api = useApi();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'metadata' ? 'metadata' : 'uploads';
  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.record(submissionId),
    queryFn: ({ signal }) => api.submissions.getSubmissionRecordWithSecurity(submissionId, { signal })
  });
  const submission = submissionQuery.data;

  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs aria-label="submission breadcrumb">
            <Link component={RouterLink} to="/admin/submissions" underline="hover" color="inherit">
              Submissions
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              {submission?.name ?? 'Submission'}
            </Typography>
          </Breadcrumbs>
        }
        label={submissionQuery.isPending ? <Skeleton width={240} height={48} /> : (submission?.name ?? 'Submission')}
        description={submission?.description}
        tabs={
          <TabGroup
            value={activeTab}
            onChange={(value) => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', value);
              setSearchParams(next);
            }}
            ariaLabel="Submission detail sections"
            tabs={[
              {
                value: 'uploads',
                label: 'Uploads',
                id: 'submission-uploads-tab',
                ariaControls: 'submission-uploads-panel'
              },
              {
                value: 'metadata',
                label: 'Metadata',
                id: 'submission-metadata-tab',
                ariaControls: 'submission-metadata-panel'
              }
            ]}
          />
        }
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Stack gap={3}>
          {submissionQuery.isPending && <Skeleton variant="rectangular" height={300} />}
          {submission && (
            <>
              <Box
                role="tabpanel"
                id="submission-uploads-panel"
                aria-labelledby="submission-uploads-tab"
                hidden={activeTab !== 'uploads'}>
                <AdminSubmissionUploads submissionId={submissionId} />
              </Box>
              {activeTab === 'metadata' && (
                <Box role="tabpanel" id="submission-metadata-panel" aria-labelledby="submission-metadata-tab">
                  <AdminSubmissionMetadata submission={submission} />
                </Box>
              )}
            </>
          )}
        </Stack>
      </Container>
    </>
  );
};
