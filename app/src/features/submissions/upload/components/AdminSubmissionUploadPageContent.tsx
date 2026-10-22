import { Box, Breadcrumbs, Button, Link, Skeleton, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { ComponentSwitch } from 'components/switch/ComponentSwitch';
import { RECONCILIATION_OUTCOMES } from 'constants/reconciliation';
import { SYSTEM_ROLE } from 'constants/roles';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { SubmissionUploadScope } from 'interfaces/useAdminApi.interface';
import { AdminPageLayout } from 'layouts/AdminPageLayout';
import { useEffect, useState } from 'react';
import { Link as RouterLink, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { hasAtLeastOneValidValue } from 'utils/authUtils';
import { submissionQueryKeys } from 'utils/query-keys/submission-query-keys';
import { adminSubmissionUploadQueryKeys } from '../submission-upload-query-keys';
import { AdminSubmissionUploadErrors } from './content/AdminSubmissionUploadErrors';
import { AdminSubmissionUploadMetadata } from './content/AdminSubmissionUploadMetadata';
import { AdminSubmissionUploadReconciliation } from './content/AdminSubmissionUploadReconciliation';
import { ReindexSubmissionUploadDialog } from './dialog/ReindexSubmissionUploadDialog';

interface AdminSubmissionUploadPageContentProps {
  scope: SubmissionUploadScope;
}

const ERRORS_TAB = 'errors';
const METADATA_TAB = 'metadata';

/**
 * Display an upload under the submission header, with one tab per reconciliation outcome, an Errors tab and a Metadata
 * tab. The outcome tabs share one feature types table and map; the selected tab decides which outcome they show. An
 * absent or unknown tab shows the first outcome. Once an outcome has been shown, the table and map stay mounted for
 * the life of the page, hidden behind the other tabs, so returning to an outcome does not rebuild them. System
 * administrators can reindex the upload from the header until it is accepted.
 *
 * @param {AdminSubmissionUploadPageContentProps} props Submission and upload to display.
 * @returns {JSX.Element} Administrative upload detail page.
 */
export const AdminSubmissionUploadPageContent = ({ scope }: AdminSubmissionUploadPageContentProps) => {
  const api = useApi();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab');
  const outcome = RECONCILIATION_OUTCOMES.find(({ route }) => route === tab) ?? RECONCILIATION_OUTCOMES[0];
  const isOutcomeTab = tab !== ERRORS_TAB && tab !== METADATA_TAB;
  const activeTab = isOutcomeTab ? outcome.route : tab;
  // The map frames its extent when it mounts, which needs a visible container: a page opened on another tab mounts
  // the outcome panel only once an outcome is first shown.
  const [hasShownOutcome, setHasShownOutcome] = useState(isOutcomeTab);
  const submissionQuery = useQuery({
    queryKey: submissionQueryKeys.record(scope.submissionId),
    queryFn: ({ signal }) => api.submissions.getSubmissionRecordWithSecurity(scope.submissionId, { signal })
  });
  const submission = submissionQuery.data;
  const authStateContext = useAuthStateContext();
  const canReindex = hasAtLeastOneValidValue([SYSTEM_ROLE.SYSTEM_ADMIN], authStateContext.biohubUserWrapper.roleNames);
  const [isReindexDialogOpen, setIsReindexDialogOpen] = useState(false);
  const uploadQuery = useQuery({
    queryKey: adminSubmissionUploadQueryKeys.record(scope),
    queryFn: ({ signal }) => api.admin.getAdminSubmissionUpload(scope, { signal }),
    enabled: canReindex
  });
  const blueprintQuery = useQuery({
    queryKey: adminSubmissionUploadQueryKeys.blueprint(scope),
    queryFn: ({ signal }) => api.admin.getSubmissionUploadBlueprint(scope, { signal }),
    enabled: canReindex
  });
  // Only an undecided upload can be re-indexed: a decided upload's features are fixed, and the server refuses it.
  const isReindexDisabled = !uploadQuery.data || uploadQuery.data.decision !== 'pending' || blueprintQuery.isPending;

  useEffect(() => {
    if (isOutcomeTab) {
      setHasShownOutcome(true);
    }
  }, [isOutcomeTab]);

  if (isAxiosError(submissionQuery.error) && submissionQuery.error.response?.status === 404) {
    return <Navigate to="/page-not-found" replace />;
  }
  return (
    <>
      <AdminPageLayout
        breadcrumbs={
          <Breadcrumbs aria-label="submission upload breadcrumb">
            <Link component={RouterLink} to="/admin" underline="hover" color="inherit">
              Administration
            </Link>
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
            <Typography variant="inherit" color="text.primary" aria-current="page">
              Upload
            </Typography>
          </Breadcrumbs>
        }
        title={submissionQuery.isPending ? <Skeleton width={240} height={48} /> : (submission?.name ?? 'Submission')}
        description={submission?.description}
        buttons={
          canReindex && (
            <Button
              size="small"
              variant="outlined"
              color="primary"
              disabled={isReindexDisabled}
              onClick={() => setIsReindexDialogOpen(true)}
              data-testid="reindex-upload-button">
              Reindex
            </Button>
          )
        }
        tabs={[
          ...RECONCILIATION_OUTCOMES.map(({ route, label }) => ({
            value: route,
            label,
            id: `upload-${route}-tab`,
            ariaControls: `upload-${route}-panel`
          })),
          {
            value: ERRORS_TAB,
            label: 'Errors',
            id: 'upload-errors-tab',
            ariaControls: 'upload-errors-panel'
          },
          {
            value: METADATA_TAB,
            label: 'About',
            id: 'upload-metadata-tab',
            ariaControls: 'upload-metadata-panel'
          }
        ]}
        activeTab={activeTab}
        onTabChange={(value) => {
          const next = new URLSearchParams(searchParams);
          next.set('tab', value);
          setSearchParams(next);
        }}>
        {(isOutcomeTab || hasShownOutcome) && (
          <Box
            role="tabpanel"
            id={`upload-${outcome.route}-panel`}
            aria-labelledby={`upload-${outcome.route}-tab`}
            hidden={!isOutcomeTab}>
            <AdminSubmissionUploadReconciliation
              scope={{ ...scope, reconciliation: outcome.reconciliation }}
              onFeatureTypeClick={(featureTypeName) =>
                navigate(
                  `/admin/submissions/${scope.submissionId}/uploads/${scope.submissionUploadId}/feature-types/${encodeURIComponent(featureTypeName)}?tab=${outcome.route}`
                )
              }
            />
          </Box>
        )}
        <ComponentSwitch
          switch={activeTab}
          components={{
            [ERRORS_TAB]: (
              <Box role="tabpanel" id="upload-errors-panel" aria-labelledby="upload-errors-tab">
                <AdminSubmissionUploadErrors scope={scope} />
              </Box>
            ),
            [METADATA_TAB]: (
              <Box role="tabpanel" id="upload-metadata-panel" aria-labelledby="upload-metadata-tab">
                <AdminSubmissionUploadMetadata scope={scope} />
              </Box>
            )
          }}
        />
      </AdminPageLayout>
      {canReindex && (
        <ReindexSubmissionUploadDialog
          open={isReindexDialogOpen}
          scope={scope}
          blueprint={blueprintQuery.data ?? null}
          onClose={() => setIsReindexDialogOpen(false)}
        />
      )}
    </>
  );
};
