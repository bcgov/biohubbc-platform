import Stack from '@mui/material/Stack';
import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { PageSection } from 'components/section/PageSection';
import { SubmissionUploadMap } from 'features/admin/reviews/components/map/SubmissionUploadMap';
import { SubmissionUploadReviewValidationReconciliationFeatureTypesTable } from 'features/admin/reviews/components/table/SubmissionUploadReviewValidationReconciliationFeatureTypesTable';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { useApi } from 'hooks/useApi';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ReconciliationFeatureScope } from 'interfaces/useAdminApi.interface';
import { useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { keepPreviousDataWithin } from 'utils/query-client';

interface AdminSubmissionUploadReconciliationProps {
  scope: ReconciliationFeatureScope;
  onFeatureTypeClick: (featureTypeName: string) => void;
}

/**
 * Display one server-paginated page of the feature types, and the map, of one reconciliation outcome of an upload. Stays mounted across outcome
 * tabs, as do the grid and the map inside it: a different outcome only changes the rows listed and the features
 * mapped.
 *
 * @param {AdminSubmissionUploadReconciliationProps} props Upload and outcome to display, and the feature type handler.
 * @returns {JSX.Element} Feature types and Map sections, or a redirect when the upload is not the submission's.
 */
export const AdminSubmissionUploadReconciliation = ({
  scope,
  onFeatureTypeClick
}: AdminSubmissionUploadReconciliationProps) => {
  const api = useApi();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'feature_type_name', sort: 'asc' } });
  const { handlePaginationChange } = grid;
  const { pageSize } = grid.paginationModel;
  const filters = { reconciliation: scope.reconciliation };
  const featureTypesQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureTypes(scope, filters, grid.apiPagination),
    queryFn: ({ signal }) => api.admin.listSubmissionUploadFeatureTypes(scope, filters, grid.apiPagination, { signal }),
    placeholderData: keepPreviousDataWithin(submissionUploadQueryKeys.featureTypesAll(scope, filters))
  });

  // The grid outlives the outcome it shows, so each outcome starts from its first page.
  useEffect(() => {
    handlePaginationChange({ page: 0, pageSize });
  }, [scope.reconciliation, pageSize, handlePaginationChange]);

  if (isAxiosError(featureTypesQuery.error) && featureTypesQuery.error.response?.status === 404) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <Stack spacing={4}>
      <SubmissionUploadReviewValidationReconciliationFeatureTypesTable
        featureTypes={featureTypesQuery.data?.feature_types ?? []}
        rowCount={featureTypesQuery.data?.pagination.total ?? 0}
        grid={grid}
        isLoading={featureTypesQuery.isLoading}
        hasError={featureTypesQuery.isError}
        onFeatureTypeClick={onFeatureTypeClick}
      />
      <PageSection id="upload-map" label="Map">
        <SubmissionUploadMap
          submissionId={scope.submissionId}
          submissionUploadId={scope.submissionUploadId}
          reconciliation={scope.reconciliation}
        />
      </PageSection>
    </Stack>
  );
};
