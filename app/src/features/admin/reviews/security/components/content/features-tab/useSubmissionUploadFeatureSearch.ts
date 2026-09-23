import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ISubmissionUploadReviewSecurityFeatureResponse } from 'interfaces/useAdminApi.interface';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useCallback, useEffect, useState } from 'react';
import { CursorPagination } from 'types/pagination';
import { isAbortError } from 'utils/request';
import { useSearchPagination } from 'features/search/result/hooks/useSearchPagination';

/**
 * Loads cursor-paginated expression results and a matching count for one submission upload.
 *
 * @param {number} submissionId - Identifier of the submission that owns the upload.
 * @param {string} submissionUploadId - Identifier of the submission upload to search.
 * @param {ExpressionTreeExpression | null} expressionTree - Applied expression tree, or null to load all upload features.
 * @param {number} expressionApplyRevision - Apply counter that refreshes results when the expression is submitted.
 * @param {number} refreshRevision - External refresh counter used to reload feature security classifications.
 * @returns Upload feature rows, response metadata, count, loading state, cursor pagination, and URL search-param controls.
 */
export const useSubmissionUploadFeatureSearch = (
  submissionId: number,
  submissionUploadId: string,
  expressionTree: ExpressionTreeExpression | null,
  expressionApplyRevision: number,
  refreshRevision: number
) => {
  const { searchSubmissionUploadFeatures, countSubmissionUploadFeatures } = useApi().admin;
  const { setSnackbar } = useDialogContext();
  const { searchParams, setSearchParams, cursorPagination } = useSearchPagination();
  const [response, setResponse] = useState<ISubmissionUploadReviewSecurityFeatureResponse>();
  const [totalCount, setTotalCount] = useState<number>();
  const [isLoading, setIsLoading] = useState(true);

  const reportRequestError = useCallback(
    (error: unknown) => {
      if (!isAbortError(error)) {
        setSnackbar({ open: true, snackbarMessage: (error as Error).message });
      }
    },
    [setSnackbar]
  );

  useEffect(() => {
    const controller = new AbortController();
    /**
     * Loads the total matching feature count unless this request has been cancelled.
     *
     * @returns {Promise<void>} Resolves after updating the count or reporting an error.
     */
    const loadCount = async () => {
      try {
        const response = await countSubmissionUploadFeatures(submissionId, submissionUploadId, expressionTree, {
          signal: controller.signal
        });
        if (!controller.signal.aborted) {
          setTotalCount(response.total);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          reportRequestError(error);
        }
      }
    };
    void loadCount();
    return () => controller.abort();
  }, [
    countSubmissionUploadFeatures,
    expressionApplyRevision,
    expressionTree,
    reportRequestError,
    submissionId,
    submissionUploadId
  ]);

  useEffect(() => {
    const controller = new AbortController();
    /**
     * Loads the current feature page while preserving existing results during refresh.
     *
     * @returns {Promise<void>} Resolves after updating results and loading state or reporting an error.
     */
    const loadResults = async () => {
      try {
        setIsLoading(true);
        const response = await searchSubmissionUploadFeatures(
          submissionId,
          submissionUploadId,
          expressionTree,
          cursorPagination,
          { signal: controller.signal }
        );
        if (!controller.signal.aborted) {
          setResponse(response);
        }
      } catch (error) {
        if (!controller.signal.aborted) {
          reportRequestError(error);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };
    void loadResults();
    return () => controller.abort();
  }, [
    cursorPagination,
    expressionApplyRevision,
    expressionTree,
    refreshRevision,
    reportRequestError,
    searchSubmissionUploadFeatures,
    submissionId,
    submissionUploadId
  ]);

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
    isLoading,
    totalCount,
    cursor,
    searchParams,
    setSearchParams
  };
};
