import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useEffect } from 'react';
import { CursorPagination } from 'types/pagination';
import { useSearchPagination } from 'features/search/result/hooks/useSearchPagination';
import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';

/**
 * Loads cursor-paginated expression results and a matching count for one submission upload.
 *
 * The count is keyed on the expression alone, so paging and security changes (which invalidate only the
 * results) reuse it. Both keep the previous response on screen while the next one loads.
 *
 * @param {number} submissionId - Identifier of the submission that owns the upload.
 * @param {string} submissionUploadId - Identifier of the submission upload to search.
 * @param {ExpressionTreeExpression | null} expressionTree - Applied expression tree, or null to load all upload features.
 * @returns Upload feature rows, response metadata, count, loading state, cursor pagination, and URL search-param controls.
 */
export const useSubmissionUploadFeatureSearch = (
  submissionId: number,
  submissionUploadId: string,
  expressionTree: ExpressionTreeExpression | null
) => {
  const api = useApi();
  const { setSnackbar } = useDialogContext();
  const { searchParams, setSearchParams, cursorPagination } = useSearchPagination();
  const scope = { submissionId, submissionUploadId };

  const countQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureSearchCount(scope, expressionTree),
    queryFn: ({ signal }) =>
      api.admin.countSubmissionUploadFeatures(submissionId, submissionUploadId, expressionTree, { signal }),
    placeholderData: keepPreviousData
  });

  const resultsQuery = useQuery({
    queryKey: submissionUploadQueryKeys.featureSearchResults(scope, expressionTree, cursorPagination),
    queryFn: ({ signal }) =>
      api.admin.searchSubmissionUploadFeatures(submissionId, submissionUploadId, expressionTree, cursorPagination, {
        signal
      }),
    placeholderData: keepPreviousData
  });

  useEffect(() => {
    if (countQuery.error) {
      setSnackbar({ open: true, snackbarMessage: countQuery.error.message });
    }
  }, [countQuery.error, setSnackbar]);

  useEffect(() => {
    if (resultsQuery.error) {
      setSnackbar({ open: true, snackbarMessage: resultsQuery.error.message });
    }
  }, [resultsQuery.error, setSnackbar]);

  const response = resultsQuery.data;
  const pagination = response?.pagination;
  const cursor: CursorPagination = {
    limit: cursorPagination.limit,
    sort: pagination?.sort ?? cursorPagination.sort,
    order: pagination?.order ?? cursorPagination.order,
    next: pagination?.next_cursor ?? null,
    previous: pagination?.previous_cursor ?? null
  };

  return {
    rows: response?.features ?? [],
    response,
    isLoading: resultsQuery.isFetching,
    totalCount: countQuery.data?.total,
    cursor,
    searchParams,
    setSearchParams
  };
};
