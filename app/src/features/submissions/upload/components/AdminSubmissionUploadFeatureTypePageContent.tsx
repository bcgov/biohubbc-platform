import { Breadcrumbs, Container, Link, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { PageHeader } from 'components/header/PageHeader';
import { SubmissionUploadReviewFeatureTypePropertiesTable } from 'features/admin/reviews/components/table/SubmissionUploadReviewFeatureTypePropertiesTable';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { useApi } from 'hooks/useApi';
import { SubmissionUploadScope } from 'interfaces/useAdminApi.interface';
import { Link as RouterLink, Navigate, useLocation } from 'react-router-dom';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';

interface AdminSubmissionUploadFeatureTypePageContentProps {
  scope: SubmissionUploadScope;
  featureType: string;
}

/**
 * Display the properties set for one feature type across an upload, under the upload's breadcrumbs. The Upload
 * breadcrumb keeps the query string, so it returns to the outcome tab the feature type was opened from.
 *
 * @param {AdminSubmissionUploadFeatureTypePageContentProps} props Upload and feature type to display.
 * @returns {JSX.Element} Feature type header and Properties section.
 */
export const AdminSubmissionUploadFeatureTypePageContent = ({
  scope,
  featureType
}: AdminSubmissionUploadFeatureTypePageContentProps) => {
  const api = useApi();
  const location = useLocation();
  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.record(scope.submissionId),
    queryFn: ({ signal }) => api.submissions.getSubmissionRecordWithSecurity(scope.submissionId, { signal })
  });
  const propertiesQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureTypeProperties(scope, featureType),
    queryFn: ({ signal }) =>
      api.admin.getSubmissionUploadFeatureTypeProperties(scope.submissionId, scope.submissionUploadId, featureType, {
        signal
      })
  });
  const submission = submissionQuery.data;
  const title = getFeatureTypeDisplayLabel(featureType);
  const error = propertiesQuery.error ?? submissionQuery.error;
  if (isAxiosError(error) && error.response?.status === 404) {
    return <Navigate to="/page-not-found" replace />;
  }
  return (
    <>
      <PageHeader
        breadcrumbs={
          <Breadcrumbs aria-label="submission upload feature type breadcrumb">
            <Link component={RouterLink} to="/admin/submissions" underline="hover" color="inherit">
              Submissions
            </Link>
            <Link
              component={RouterLink}
              to={`/admin/submissions/${scope.submissionId}`}
              underline="hover"
              color="inherit">
              {submission?.name ?? 'Submission'}
            </Link>
            <Link
              component={RouterLink}
              to={`/admin/submissions/${scope.submissionId}/uploads/${scope.submissionUploadId}${location.search}`}
              underline="hover"
              color="inherit">
              Upload
            </Link>
            <Typography variant="inherit" color="text.primary" aria-current="page">
              {title}
            </Typography>
          </Breadcrumbs>
        }
        label={title}
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <SubmissionUploadReviewFeatureTypePropertiesTable
          properties={propertiesQuery.data?.properties ?? []}
          isLoading={propertiesQuery.isLoading}
          hasError={propertiesQuery.isError}
        />
      </Container>
    </>
  );
};
