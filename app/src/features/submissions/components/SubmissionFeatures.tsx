import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Typography from '@mui/material/Typography';
import { PageSection } from 'components/section/PageSection';
import { FeatureTypeTabs } from 'components/tabs/FeatureTypeTabs';
import { URL_PARAMS } from 'constants/query-params';
import { SEARCH_RESULT_VIEW, SEARCH_RESULT_VIEW_OPTIONS } from 'constants/search';
import { SearchResultContent } from 'features/search/result/content/SearchResultContent';
import { SearchResultSearch } from 'features/search/result/header/SearchResultSearch';
import { useSearchResultExpression } from 'features/search/result/hooks/useSearchResultExpression';
import { useSearchResultPagingSort } from 'features/search/result/hooks/useSearchResultPagingSort';
import { useSearchResults } from 'features/search/result/hooks/useSearchResults';
import { SearchResultMapContainer } from 'features/search/result/layout/map/SearchResultMapContainer';
import { useSearchQueryParams } from 'hooks/useSearchQuery';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { getFeatureTypeDisplayLabel } from 'utils/feature-type';
import { buildSubmissionFeaturePath, buildSubmissionPropertyValuePathResolvers } from 'utils/routes';
import { SubmissionDownloadButton } from './download/SubmissionDownloadButton';

interface SubmissionFeaturesProps {
  /** Submission whose features are searched. */
  submissionId: number;
  /** Submission route base that result links open under, e.g. `/submission` or `/portal/submission`. */
  basePath: string;
  /** Feature types available in the submission's active feature graph. */
  featureTypes: SubmissionRecordWithSecurity['feature_types'];
}

/**
 * Renders searchable feature results scoped to one submission.
 *
 * Coordinates the selected feature type, expression search, sorting, pagination, result view,
 * and submission-scoped map session inside the Features section. The feature types are the same scrollable tabs as
 * the search result page, and results render as search results do, with a column per property.
 *
 * @param {SubmissionFeaturesProps} props - Submission identifier, route base, and its available feature types.
 * @returns {JSX.Element} The submission's searchable Features section.
 */
export const SubmissionFeatures = ({ submissionId, basePath, featureTypes }: SubmissionFeaturesProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathResolvers = useMemo(
    () => buildSubmissionPropertyValuePathResolvers(basePath, location.search),
    [basePath, location.search]
  );
  const [view, setView] = useState<SEARCH_RESULT_VIEW>(SEARCH_RESULT_VIEW.TABLE);
  const { searchParams: routeSearchParams } = useSearchQueryParams();
  const selectedFeatureType = routeSearchParams.get(URL_PARAMS.FEATURE_TYPE) ?? undefined;
  const submissionIds = useMemo(() => [submissionId], [submissionId]);
  const featureTypeOptions = useMemo(
    () => featureTypes.map((featureType) => ({ value: featureType, label: getFeatureTypeDisplayLabel(featureType) })),
    [featureTypes]
  );
  const activeFeatureType = featureTypeOptions.some(({ value }) => value === selectedFeatureType)
    ? selectedFeatureType
    : featureTypeOptions[0]?.value;

  const isFeatureTypeReady = Boolean(activeFeatureType) && selectedFeatureType === activeFeatureType;

  const { expressionTree, handleExpressionApply } = useSearchResultExpression();
  const { rows, properties, isLoading, searchParams, cursor, totalCount, setSearchParams, reload } = useSearchResults(
    activeFeatureType,
    isFeatureTypeReady,
    expressionTree,
    submissionIds
  );
  const { activeSort, sortOptions, handleSortChange, handlePageChange, handlePageSizeChange } =
    useSearchResultPagingSort({ cursor, setSearchParams });

  // A URL without a valid feature type has no submission paging context yet. Establish both
  // together before searching so pagination carried from global search is never applied here.
  useEffect(() => {
    if (activeFeatureType && !isFeatureTypeReady) {
      setSearchParams({ [URL_PARAMS.FEATURE_TYPE]: activeFeatureType });
    }
  }, [activeFeatureType, isFeatureTypeReady, setSearchParams]);

  if (!activeFeatureType) {
    return (
      <PageSection id="submission-features" label="Features">
        <Box p={2}>
          <Typography color="text.secondary">No searchable features available.</Typography>
        </Box>
      </PageSection>
    );
  }

  return (
    <PageSection
      id="submission-features"
      label="Features"
      headerContent={<SubmissionDownloadButton submissionId={submissionId} />}>
      <Box sx={{ px: 2 }}>
        <FeatureTypeTabs
          activeFeatureType={activeFeatureType}
          featureTypes={featureTypeOptions}
          onFeatureTypeChange={(featureType) => {
            setSearchParams({ [URL_PARAMS.FEATURE_TYPE]: featureType });
          }}
          ariaLabel="Submission feature types"
        />
      </Box>

      <Divider />

      <Box sx={{ px: 2, py: 2 }}>
        <SearchResultSearch
          searchTerm={searchParams.get(URL_PARAMS.SEARCH_QUERY) || ''}
          expressionTree={expressionTree}
          onExpressionApply={(expression) => {
            if (!handleExpressionApply(expression)) {
              reload();
            }
          }}
        />
      </Box>

      <Divider />

      <SearchResultContent
        rows={rows}
        featureTypeProperties={properties}
        pathResolvers={pathResolvers}
        isLoading={isLoading || !isFeatureTypeReady}
        cursor={cursor}
        totalCount={totalCount}
        sortOptions={sortOptions}
        activeSort={activeSort}
        view={view}
        viewOptions={SEARCH_RESULT_VIEW_OPTIONS}
        minHeight={520}
        toolbarPaddingY={2}
        onSortChange={handleSortChange}
        onViewChange={setView}
        onResultClick={(result) =>
          navigate(
            buildSubmissionFeaturePath(basePath, result.submission_id, result.submission_feature_id, location.search)
          )
        }
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        mapContent={
          <SearchResultMapContainer
            featureTypeName={activeFeatureType}
            expressionTree={expressionTree}
            submissionIds={submissionIds}
            isActive={isFeatureTypeReady && view === SEARCH_RESULT_VIEW.MAP}
          />
        }
      />
    </PageSection>
  );
};
