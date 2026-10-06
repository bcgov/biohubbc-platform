import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { skipToken, useQuery } from '@tanstack/react-query';
import { ToggleButtons } from 'components/toggle-button/ToggleButtons';
import { URL_PARAMS } from 'constants/query-params';
import { SEARCH_RESULT_VIEW, SEARCH_RESULT_VIEW_OPTIONS } from 'constants/search';
import { SearchResultContent } from 'features/search/result/content/SearchResultContent';
import { useSearchPagination } from 'features/search/result/hooks/useSearchPagination';
import { useSearchResultPagingSort } from 'features/search/result/hooks/useSearchResultPagingSort';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import { ReconciliationFeatureCounts, ReconciliationFeatureScope } from 'interfaces/useAdminApi.interface';
import { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CursorPagination } from 'types/pagination';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';
import { keepPreviousDataWithin } from 'utils/query-client';
import { buildSubmissionFeaturePath, buildSubmissionPropertyValuePathResolvers } from 'utils/routes';
import { submissionUploadQueryKeys } from '../../submission-upload-query-keys';

interface SubmissionUploadReviewValidationReconciliationFeaturesProps {
  scope: ReconciliationFeatureScope;
  reviewId: string;
  featureTypes: ReconciliationFeatureCounts['feature_types'];
}

const TABLE_VIEW_OPTIONS = SEARCH_RESULT_VIEW_OPTIONS.filter(({ value }) => value === SEARCH_RESULT_VIEW.TABLE);

/**
 * Coordinate feature-type selection and cursor-paginated property rows for one outcome.
 * @param {SubmissionUploadReviewValidationReconciliationFeaturesProps} props Outcome scope and available types.
 * @returns {JSX.Element} Feature-type sidebar and reusable property table.
 */
export const SubmissionUploadReviewValidationReconciliationFeatures = ({
  scope,
  reviewId,
  featureTypes
}: SubmissionUploadReviewValidationReconciliationFeaturesProps) => {
  const api = useApi();
  const { setSnackbar } = useDialogContext();
  const navigate = useNavigate();
  const location = useLocation();
  const { searchParams, setSearchParams, cursorPagination } = useSearchPagination();
  const selectedType = searchParams.get(URL_PARAMS.FEATURE_TYPE);
  const activeType =
    featureTypes.find(({ feature_type_name }) => feature_type_name === selectedType) ?? featureTypes[0];
  const featureType = activeType?.feature_type_name ?? '';
  const ready = Boolean(featureType) && selectedType === featureType;
  const resultsQuery = useQuery({
    queryKey: submissionUploadQueryKeys.reconciliationFeaturePage(scope, featureType, cursorPagination),
    queryFn: ready
      ? ({ signal }) => api.admin.getReconciliationFeatures(scope, featureType, cursorPagination, { signal })
      : skipToken,
    placeholderData: keepPreviousDataWithin(submissionUploadQueryKeys.reconciliationFeatures(scope, featureType))
  });

  useEffect(() => {
    if (featureType && !ready) {
      setSearchParams({ [URL_PARAMS.FEATURE_TYPE]: featureType });
    }
  }, [featureType, ready, setSearchParams]);

  useEffect(() => {
    if (resultsQuery.error) {
      setSnackbar({ open: true, snackbarMessage: resultsQuery.error.message });
    }
  }, [resultsQuery.error, setSnackbar]);

  const pagination = resultsQuery.data?.pagination;
  const cursor: CursorPagination = {
    limit: cursorPagination.limit,
    sort: pagination?.sort ?? cursorPagination.sort,
    order: pagination?.order ?? cursorPagination.order,
    next: pagination?.next_cursor ?? null,
    previous: pagination?.previous_cursor ?? null
  };
  const { activeSort, sortOptions, handleSortChange, handlePageChange, handlePageSizeChange } =
    useSearchResultPagingSort({ cursor, setSearchParams });
  const reviewPath = `/admin/submission/${scope.submissionId}/upload/${scope.submissionUploadId}/review/${reviewId}`;
  const pathResolvers = useMemo(
    () => ({
      ...buildSubmissionPropertyValuePathResolvers('/submission', location.search),
      getSubmissionFeaturePath: (submissionId: number, featureId: number) => {
        if (submissionId !== scope.submissionId) {
          return buildSubmissionFeaturePath('/submission', submissionId, featureId, location.search);
        }
        return `${reviewPath}/feature/${featureId}${location.search}`;
      }
    }),
    [location.search, reviewPath, scope.submissionId]
  );
  const typeOptions = featureTypes.map(({ feature_type_name }) => ({
    value: feature_type_name,
    label: getFeatureTypeDisplayLabel(feature_type_name)
  }));

  return (
    <Box sx={{ display: 'flex', minHeight: 0 }}>
      <Box component="aside" sx={{ width: 240, flexShrink: 0, overflowY: 'auto', px: 2, pt: 2, pb: 1 }}>
        <ToggleButtons
          views={typeOptions}
          activeView={featureType}
          orientation="vertical"
          ariaLabel="Reconciliation feature types"
          onViewChange={(value) => setSearchParams({ [URL_PARAMS.FEATURE_TYPE]: value })}
        />
      </Box>
      <Divider orientation="vertical" flexItem />
      <Box sx={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0 }}>
        <SearchResultContent
          rows={resultsQuery.data?.features ?? []}
          featureTypeProperties={resultsQuery.data?.properties ?? []}
          featureTypePropertiesPath={`${location.pathname}/feature-type/${encodeURIComponent(featureType)}${location.search}`}
          pathResolvers={pathResolvers}
          isLoading={!ready || (resultsQuery.isFetching && !resultsQuery.data)}
          cursor={cursor}
          totalCount={activeType?.count}
          sortOptions={sortOptions}
          activeSort={activeSort}
          view={SEARCH_RESULT_VIEW.TABLE}
          viewOptions={TABLE_VIEW_OPTIONS}
          minHeight={520}
          toolbarPaddingY={2}
          onSortChange={handleSortChange}
          onViewChange={() => {}}
          onResultClick={(result) =>
            navigate(
              `${location.pathname}/feature-type/${encodeURIComponent(result.feature_type_name)}${location.search}`
            )
          }
          onPageChange={handlePageChange}
          onPageSizeChange={handlePageSizeChange}
        />
      </Box>
    </Box>
  );
};
