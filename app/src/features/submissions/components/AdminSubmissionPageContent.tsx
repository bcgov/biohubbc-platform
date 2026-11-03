import { Box, Breadcrumbs, Link, Skeleton, Stack, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
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
    <AdminPageLayout
      breadcrumbs={
        <Breadcrumbs aria-label="submission breadcrumb">
          <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
            Administration
          </Link>
          <Link component={RouterLink} to="/admin/submissions" underline="hover" color="inherit">
            Submissions
          </Link>
          <Typography variant="inherit" color="text.primary" aria-current="page">
            {submission?.name ?? 'Submission'}
          </Typography>
        </Breadcrumbs>
      }
      title={submissionQuery.isPending ? <Skeleton width={240} height={48} /> : (submission?.name ?? 'Submission')}
      description={submission?.description}
      tabs={[
        {
          value: 'uploads',
          label: 'Uploads',
          id: 'submission-uploads-tab',
          ariaControls: 'submission-uploads-panel'
        },
        {
          value: 'metadata',
          label: 'About',
          id: 'submission-metadata-tab',
          ariaControls: 'submission-metadata-panel'
        }
      ]}
      activeTab={activeTab}
      onTabChange={(value) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', value);
        setSearchParams(next);
      }}>
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
    </AdminPageLayout>
  );
};
