import { skipToken, useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ISubmissionUploadReviewDetail, ReconciliationFeatureScope } from 'interfaces/useAdminApi.interface';
import { useEffect } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousDataWithin } from 'utils/query-client';
import { submissionUploadQueryKeys } from '../../submission-upload-query-keys';
import {
  ReconciliationTab,
  SubmissionUploadReviewValidationReconciliationHeader
} from '../header/SubmissionUploadReviewValidationReconciliationHeader';
import { SubmissionUploadReviewValidationReconciliationFeatureDataTable } from '../table/SubmissionUploadReviewValidationReconciliationFeatureDataTable';
import { SubmissionUploadReviewValidationReconciliationFeatureTypesTable } from '../table/SubmissionUploadReviewValidationReconciliationFeatureTypesTable';

interface SubmissionUploadReviewValidationReconciliationContentProps {
  scope: ReconciliationFeatureScope;
  review: ISubmissionUploadReviewDetail;
  label: string;
}

/**
 * Compose the outcome header with the active tab: one page of the outcome's feature types, or one page of its
 * features' raw submitted data. Both grids keep their page and sort while the other tab is shown, and only the active
 * tab's page is loaded.
 * @param {SubmissionUploadReviewValidationReconciliationContentProps} props Validated outcome and review.
 * @returns {JSX.Element} Outcome layout with the active tab's table.
 */
export const SubmissionUploadReviewValidationReconciliationContent = ({
  scope,
  review,
  label
}: SubmissionUploadReviewValidationReconciliationContentProps) => {
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { setSnackbar } = useDialogContext();
  const activeTab: ReconciliationTab = searchParams.get('tab') === 'features' ? 'features' : 'feature-types';
  const featureTypesGrid = useServerPaginatedGridState({ defaultSort: { field: 'feature_type_name', sort: 'asc' } });
  const featureDataGrid = useServerPaginatedGridState({ defaultSort: { field: 'submission_feature_id', sort: 'asc' } });
  const featureTypesQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureTypes(scope, featureTypesGrid.apiPagination),
    queryFn:
      activeTab === 'feature-types'
        ? ({ signal }) => api.admin.listSubmissionUploadFeatureTypes(scope, featureTypesGrid.apiPagination, { signal })
        : skipToken,
    placeholderData: keepPreviousDataWithin(submissionUploadQueryKeys.featureTypesAll(scope))
  });
  const featureDataQuery = useQuery({
    queryKey: submissionUploadQueryKeys.reconciliationFeatureData(scope, featureDataGrid.apiPagination),
    queryFn:
      activeTab === 'features'
        ? ({ signal }) => api.admin.getReconciliationFeatureData(scope, featureDataGrid.apiPagination, { signal })
        : skipToken,
    placeholderData: keepPreviousDataWithin(submissionUploadQueryKeys.reconciliationFeatureDataAll(scope))
  });
  const error = featureTypesQuery.error ?? featureDataQuery.error;

  useEffect(() => {
    if (error) {
      setSnackbar({ open: true, snackbarMessage: error.message });
    }
  }, [error, setSnackbar]);

  return (
    <SubmissionUploadReviewValidationReconciliationHeader
      submissionId={scope.submissionId}
      review={review}
      label={label}
      activeTab={activeTab}
      onTabChange={(tab) => {
        const next = new URLSearchParams(searchParams);
        next.set('tab', tab);
        setSearchParams(next);
      }}>
      {activeTab === 'feature-types' ? (
        <SubmissionUploadReviewValidationReconciliationFeatureTypesTable
          featureTypes={featureTypesQuery.data?.feature_types ?? []}
          rowCount={featureTypesQuery.data?.pagination.total ?? 0}
          grid={featureTypesGrid}
          isLoading={featureTypesQuery.isLoading}
          hasError={featureTypesQuery.isError}
          onFeatureTypeClick={(featureTypeName) =>
            navigate(`${location.pathname}/feature-type/${encodeURIComponent(featureTypeName)}`)
          }
        />
      ) : (
        <SubmissionUploadReviewValidationReconciliationFeatureDataTable
          features={featureDataQuery.data?.features ?? []}
          rowCount={featureDataQuery.data?.pagination.total ?? 0}
          grid={featureDataGrid}
          isLoading={featureDataQuery.isLoading}
          hasError={featureDataQuery.isError}
        />
      )}
    </SubmissionUploadReviewValidationReconciliationHeader>
  );
};
