import Breadcrumbs from '@mui/material/Breadcrumbs';
import Container from '@mui/material/Container';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { GridRowParams } from '@mui/x-data-grid';
import { skipToken, useQuery } from '@tanstack/react-query';
import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { PageHeader } from 'components/header/PageHeader';
import { TabGroup } from 'components/tabs/TabGroup';
import { SubmissionFeatureTable } from 'features/submissions/components/SubmissionFeatureTable';
import { SubmissionFeatureRow } from 'features/submissions/components/SubmissionFeatureTable.interface';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { Link as RouterLink, Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousDataWithin } from 'utils/query-client';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { buildSubmissionFeaturePath, parseRouteId } from 'utils/routes';
import { PortalSubmissionUploadAbout } from './content/PortalSubmissionUploadAbout';

type PortalSubmissionUploadTab = 'features' | 'about';

/**
 * Portal page of one of a submission's uploads, for the submission's team.
 *
 * Lists every feature the upload stored, whatever its lifecycle: unreviewed features of an upload awaiting review, and
 * features a later upload has since superseded. Selecting a feature opens its Portal feature page. A caller outside
 * the submission's team is sent to the forbidden page, and an upload that is not in the submission is not found.
 *
 * The Features tab lists the upload's features and the About tab its metadata; the selected tab is kept in the `tab`
 * query parameter.
 *
 * @returns {JSX.Element} Portal submission upload page.
 */
export const PortalSubmissionUploadPage = () => {
  const api = useApi();
  const navigate = useNavigate();
  const params = useParams<{ submissionId: string; submissionUploadId: string }>();
  const submissionId = parseRouteId(params.submissionId);
  const submissionUploadId = params.submissionUploadId;
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab: PortalSubmissionUploadTab = searchParams.get('tab') === 'about' ? 'about' : 'features';

  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.record(submissionId ?? 0),
    queryFn:
      submissionId === null
        ? skipToken
        : ({ signal }) => api.submissions.getSubmissionRecordWithSecurity(submissionId, { signal })
  });

  const submissionUuid = submissionQuery.data?.uuid;
  const uploadQuery = useQuery({
    queryKey: submissionQueryKeys.upload(submissionId ?? 0, submissionUploadId ?? ''),
    queryFn:
      submissionUuid === undefined || !submissionUploadId
        ? skipToken
        : ({ signal }) => api.submissions.getSubmissionUpload(submissionUuid, submissionUploadId, { signal })
  });

  const featureGrid = useServerPaginatedGridState({ defaultSort: { field: 'submission_feature_id', sort: 'asc' } });
  const featuresQuery = useQuery({
    queryKey: submissionQueryKeys.uploadFeatures(
      submissionId ?? 0,
      submissionUploadId ?? '',
      featureGrid.apiPagination
    ),
    queryFn:
      submissionId === null || !submissionUploadId
        ? skipToken
        : ({ signal }) =>
            api.submissions.getSubmissionUploadFeatures(submissionId, submissionUploadId, featureGrid.apiPagination, {
              signal
            }),
    placeholderData: keepPreviousDataWithin(
      submissionQueryKeys.uploadDetail(submissionId ?? 0, submissionUploadId ?? '')
    )
  });

  const submissionErrorStatus = (submissionQuery.error as APIError | null)?.status;
  const featuresErrorStatus = (featuresQuery.error as APIError | null)?.status;
  const uploadErrorStatus = (uploadQuery.error as APIError | null)?.status;
  if (
    [submissionErrorStatus, featuresErrorStatus, uploadErrorStatus].some((status) => status === 401 || status === 403)
  ) {
    return <Navigate to="/forbidden" replace />;
  }

  if (submissionId === null || !submissionUploadId || featuresErrorStatus === 404 || uploadErrorStatus === 404) {
    return <Navigate to="/page-not-found" replace />;
  }

  const handleRowClick = (params: GridRowParams<SubmissionFeatureRow>) => {
    navigate(buildSubmissionFeaturePath('/portal/submission', submissionId, params.row.submission_feature_id));
  };

  return (
    <>
      <QueryErrorDialog error={submissionQuery.error} label="submission" />
      <QueryErrorDialog error={featuresQuery.error} label="upload features" />
      <QueryErrorDialog error={uploadQuery.error} label="upload" />
      <PageHeader
        maxWidth="lg"
        label="Upload"
        subheader={<Typography color="text.secondary">{submissionUploadId}</Typography>}
        breadcrumbs={
          <Breadcrumbs aria-label="breadcrumb">
            <Link component={RouterLink} to="/portal" underline="hover" color="inherit">
              Portal
            </Link>
            <Link component={RouterLink} to="/portal/submission" underline="hover" color="inherit">
              Submissions
            </Link>
            <Link
              component={RouterLink}
              to={`/portal/submission/${submissionId}?tab=uploads`}
              underline="hover"
              color="inherit">
              {submissionQuery.data?.name ?? 'Submission'}
            </Link>
            <Typography color="text.primary">Upload</Typography>
          </Breadcrumbs>
        }
        tabs={
          <TabGroup<PortalSubmissionUploadTab>
            value={activeTab}
            onChange={(value) => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', value);
              setSearchParams(next);
            }}
            ariaLabel="Upload sections"
            tabs={[
              { value: 'features', label: 'Features' },
              { value: 'about', label: 'About' }
            ]}
          />
        }
      />
      <Container maxWidth="lg" sx={{ py: 4 }}>
        {activeTab === 'features' && (
          <SubmissionFeatureTable
            rows={featuresQuery.data?.features ?? []}
            rowCount={featuresQuery.data?.pagination.total ?? 0}
            isLoading={featuresQuery.isFetching && !featuresQuery.data}
            onRowClick={handleRowClick}
            paginationModel={featureGrid.paginationModel}
            onPaginationModelChange={featureGrid.handlePaginationChange}
            sortModel={featureGrid.sortModel}
            onSortModelChange={featureGrid.handleSortChange}
          />
        )}
        {activeTab === 'about' && uploadQuery.data && <PortalSubmissionUploadAbout upload={uploadQuery.data} />}
      </Container>
    </>
  );
};
