import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { skipToken, useQuery } from '@tanstack/react-query';
import { SECURITY_LABEL } from 'constants/security';
import dayjs from 'dayjs';
import { SubmissionDetailContent } from 'features/submissions/components/SubmissionDetailContent';
import { useApi } from 'hooks/useApi';
import { Link as RouterLink, useParams } from 'react-router-dom';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { getDaysSinceDate } from 'utils/Utils';

/**
 * Portal submission detail page for the current user's submission.
 *
 * @returns {JSX.Element}
 */
export const PortalSubmissionDetailPage = () => {
  const { submissionId } = useParams<{ submissionId: string }>();
  const numericSubmissionId = submissionId ? Number(submissionId) : undefined;
  const api = useApi();

  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.record(numericSubmissionId ?? 0),
    queryFn: numericSubmissionId
      ? ({ signal }) => api.submissions.getSubmissionRecordWithSecurity(numericSubmissionId, { signal })
      : skipToken
  });

  const submission = submissionQuery.data;

  return (
    <>
      <QueryErrorDialog error={submissionQuery.error} label="submission" />
      <SubmissionDetailContent
        isSubmissionLoading={submissionQuery.isPending}
        submission={submission}
        breadcrumbs={
          <Breadcrumbs aria-label="breadcrumb">
            <Link component={RouterLink} to="/portal" underline="hover" color="inherit">
              Portal
            </Link>
            <Link component={RouterLink} to="/portal/submission" underline="hover" color="inherit">
              Submissions
            </Link>
            <Typography color="text.primary">{submission?.name}</Typography>
          </Breadcrumbs>
        }
        subheader={
          <Stack gap={1}>
            {submission?.description && <Typography color="text.secondary">{submission.description}</Typography>}
            <Stack direction="row" gap={1} flexWrap="wrap">
              <Chip
                label={SECURITY_LABEL[submission?.security ?? ''] ?? submission?.security ?? 'Unknown'}
                size="small"
              />
              {submission?.submitted_timestamp && (
                <Chip label={`Submitted ${getDaysSinceDate(dayjs(submission.submitted_timestamp))}`} size="small" />
              )}
            </Stack>
          </Stack>
        }
        basePath="/portal/submission"
      />
    </>
  );
};
