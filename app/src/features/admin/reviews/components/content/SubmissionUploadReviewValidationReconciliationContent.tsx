import Container from '@mui/material/Container';
import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { useServerPaginatedGridState } from 'hooks/useServerPaginatedGridState';
import { ISubmissionUploadReviewDetail, ReconciliationFeatureScope } from 'interfaces/useAdminApi.interface';
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { keepPreviousDataWithin } from 'utils/query-client';
import { submissionUploadQueryKeys } from '../../submission-upload-query-keys';
import { SubmissionUploadReviewValidationReconciliationHeader } from '../header/SubmissionUploadReviewValidationReconciliationHeader';
import { SubmissionUploadReviewValidationReconciliationFeatureTypesTable } from '../table/SubmissionUploadReviewValidationReconciliationFeatureTypesTable';

interface SubmissionUploadReviewValidationReconciliationContentProps {
  scope: ReconciliationFeatureScope;
  review: ISubmissionUploadReviewDetail;
  label: string;
}

/**
 * Load one page of the outcome's feature types and compose the header and Feature types section.
 * @param {SubmissionUploadReviewValidationReconciliationContentProps} props Validated outcome and review.
 * @returns {JSX.Element} Outcome layout with its feature types.
 */
export const SubmissionUploadReviewValidationReconciliationContent = ({
  scope,
  review,
  label
}: SubmissionUploadReviewValidationReconciliationContentProps) => {
  const api = useApi();
  const navigate = useNavigate();
  const location = useLocation();
  const { setSnackbar } = useDialogContext();
  const grid = useServerPaginatedGridState({ defaultSort: { field: 'feature_type_name', sort: 'asc' } });
  const filters = { reconciliation: scope.reconciliation };
  const featureTypesQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureTypes(scope, filters, grid.apiPagination),
    queryFn: ({ signal }) => api.admin.listSubmissionUploadFeatureTypes(scope, filters, grid.apiPagination, { signal }),
    placeholderData: keepPreviousDataWithin(submissionUploadQueryKeys.featureTypesAll(scope, filters))
  });

  useEffect(() => {
    if (featureTypesQuery.error) {
      setSnackbar({ open: true, snackbarMessage: featureTypesQuery.error.message });
    }
  }, [featureTypesQuery.error, setSnackbar]);

  return (
    <>
      <SubmissionUploadReviewValidationReconciliationHeader
        submissionId={scope.submissionId}
        review={review}
        label={label}
      />
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <SubmissionUploadReviewValidationReconciliationFeatureTypesTable
          featureTypes={featureTypesQuery.data?.feature_types ?? []}
          rowCount={featureTypesQuery.data?.pagination.total ?? 0}
          grid={grid}
          isLoading={featureTypesQuery.isLoading}
          hasError={featureTypesQuery.isError}
          onFeatureTypeClick={(featureTypeName) =>
            navigate(`${location.pathname}/feature-type/${encodeURIComponent(featureTypeName)}`)
          }
        />
      </Container>
    </>
  );
};
