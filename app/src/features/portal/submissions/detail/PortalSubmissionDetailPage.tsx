import { QueryErrorDialog } from 'components/dialog/QueryErrorDialog';
import { keepPreviousDataWithin } from 'utils/query-client';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';
import { GridRowParams, MuiEvent } from '@mui/x-data-grid';
import { skipToken, useQuery } from '@tanstack/react-query';
import { TabGroup } from 'components/tabs/TabGroup';
import { SubmissionDetailContent } from 'features/submissions/components/SubmissionDetailContent';
import { SubmissionFeatureTable } from 'features/submissions/components/SubmissionFeatureTable';
import { SubmissionFeatureRow } from 'features/submissions/components/SubmissionFeatureTable.interface';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { useMemo } from 'react';
import { Link as RouterLink, Navigate, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { PortalSubmissionAbout } from './content/PortalSubmissionAbout';
import { PortalSubmissionUploads } from './content/PortalSubmissionUploads';

type PortalSubmissionTab = 'features' | 'uploads' | 'about';

const PORTAL_SUBMISSION_TABS: PortalSubmissionTab[] = ['features', 'uploads', 'about'];

/**
 * Portal submission detail page for the current user's submission. Submissions are private to their team, so a
 * caller outside the team is sent to the forbidden page.
 *
 * The Features tab lists the submission's approved, current features; the Uploads tab lists its uploads, whose pages
 * also show features that are unreviewed or superseded; the About tab lists its metadata. The selected tab is kept in
 * the `tab` query parameter.
 *
 * @returns {JSX.Element}
 */
export const PortalSubmissionDetailPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedTab = searchParams.get('tab') as PortalSubmissionTab | null;
  const activeTab: PortalSubmissionTab =
    requestedTab && PORTAL_SUBMISSION_TABS.includes(requestedTab) ? requestedTab : 'features';
  const { submissionId } = useParams<{ submissionId: string }>();
  const numericSubmissionId = submissionId ? Number(submissionId) : undefined;
  const api = useApi();

  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.record(numericSubmissionId ?? 0),
    queryFn: numericSubmissionId
      ? ({ signal }) => api.submissions.getSubmissionRecordWithSecurity(numericSubmissionId, { signal })
      : skipToken
  });

  const featureGrid = useServerPaginatedGridState({ defaultSort: { field: 'submission_feature_id', sort: 'asc' } });
  const featuresQuery = useQuery({
    queryKey: submissionQueryKeys.features(numericSubmissionId ?? 0, featureGrid.apiPagination),
    queryFn:
      numericSubmissionId && activeTab === 'features'
        ? ({ signal }) =>
            api.submissions.getSubmissionFeatures(numericSubmissionId, featureGrid.apiPagination, { signal })
        : skipToken,
    placeholderData: keepPreviousDataWithin(submissionQueryKeys.submission(numericSubmissionId ?? 0))
  });
  const featureRows = useMemo(
    () =>
      featuresQuery.data?.features.map((feature) => ({
        submission_feature_id: feature.submission_feature_id,
        feature_type_name: feature.feature_type_name
      })) ?? [],
    [featuresQuery.data]
  );

  const submission = submissionQuery.data;

  const handleRowClick = (params: GridRowParams<SubmissionFeatureRow>, _event: MuiEvent<React.MouseEvent>) => {
    navigate(`/portal/submission/${submissionId}/feature/${params.row.submission_feature_id}${location.search}`);
  };

  const submissionErrorStatus = (submissionQuery.error as APIError | null)?.status;
  const featuresErrorStatus = (featuresQuery.error as APIError | null)?.status;
  if ([submissionErrorStatus, featuresErrorStatus].some((status) => status === 401 || status === 403)) {
    return <Navigate to="/forbidden" replace />;
  }

  return (
    <>
      <QueryErrorDialog error={submissionQuery.error} label="submission" />
      <QueryErrorDialog error={featuresQuery.error} label="submission features" />
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
        subheader={submission?.description && <Typography color="text.secondary">{submission.description}</Typography>}
        tabs={
          <TabGroup<PortalSubmissionTab>
            value={activeTab}
            onChange={(value) => {
              const next = new URLSearchParams(searchParams);
              next.set('tab', value);
              setSearchParams(next);
            }}
            ariaLabel="Submission sections"
            tabs={[
              { value: 'features', label: 'Features' },
              { value: 'uploads', label: 'Uploads' },
              { value: 'about', label: 'About' }
            ]}
          />
        }>
        {activeTab === 'features' && (
          <SubmissionFeatureTable
            rows={featureRows}
            rowCount={featuresQuery.data?.pagination.total ?? 0}
            isLoading={featuresQuery.isFetching && !featuresQuery.data}
            onRowClick={handleRowClick}
            paginationModel={featureGrid.paginationModel}
            onPaginationModelChange={featureGrid.handlePaginationChange}
            sortModel={featureGrid.sortModel}
            onSortModelChange={featureGrid.handleSortChange}
          />
        )}
        {activeTab === 'uploads' && submission && (
          <PortalSubmissionUploads submissionId={submission.submission_id} submissionUuid={submission.uuid} />
        )}
        {activeTab === 'about' && submission && <PortalSubmissionAbout submission={submission} />}
      </SubmissionDetailContent>
    </>
  );
};
