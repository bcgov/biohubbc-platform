import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import { PageSection } from 'components/section/PageSection';
import { ToggleButtons } from 'components/toggle-button/ToggleButtons';
import { URL_PARAMS } from 'constants/query-params';
import { SEARCH_RESULT_VIEW, SEARCH_RESULT_VIEW_OPTIONS } from 'constants/search';
import { SearchResultContent } from 'features/search/result/content/SearchResultPanel';
import { SearchResultSearch } from 'features/search/result/header/SearchResultSearch';
import { useSearchResultExpression } from 'features/search/result/hooks/useSearchResultExpression';
import { useSearchResultPagingSort } from 'features/search/result/hooks/useSearchResultPagingSort';
import { useSearchResults } from 'features/search/result/hooks/useSearchResults';
import { SearchResultMapContainer } from 'features/search/result/layout/map/SearchResultMapContainer';
import { SubmissionRecordWithSecurity } from 'interfaces/useSubmissionsApi.interface';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

interface SubmissionFeaturesProps {
  /** Submission whose features are searched. */
  submissionId: number;
  /** Feature types available in the submission's active feature graph. */
  featureTypes: SubmissionRecordWithSecurity['feature_types'];
}

/**
 * Renders searchable feature results scoped to one submission.
 *
 * Coordinates the selected feature type, expression search, sorting, pagination, result view,
 * and submission-scoped map session inside the Features section.
 *
 * @param {SubmissionFeaturesProps} props - Submission identifier and its available feature types.
 * @returns {JSX.Element} The submission's searchable Features section.
 */
export const SubmissionFeatures = ({ submissionId, featureTypes }: SubmissionFeaturesProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<SEARCH_RESULT_VIEW>(SEARCH_RESULT_VIEW.TABLE);
  const [selectedFeatureType, setSelectedFeatureType] = useState<string>();
  const submissionIds = useMemo(() => [submissionId], [submissionId]);
  const featureTypeOptions = useMemo(
    () => featureTypes.map((featureType) => ({ value: featureType, label: featureType })),
    [featureTypes]
  );
  const activeFeatureType = featureTypeOptions.some(({ value }) => value === selectedFeatureType)
    ? selectedFeatureType
    : featureTypeOptions[0]?.value;

  const { expressionTree, expressionApplyRevision, handleExpressionApply } = useSearchResultExpression();
  const { rows, properties, isLoading, searchParams, pagination, setSearchParams } = useSearchResults(
    activeFeatureType,
    Boolean(activeFeatureType),
    expressionTree,
    expressionApplyRevision,
    submissionIds
  );
  const { activeSort, sortOptions, handleSortChange, handlePageChange, handlePageSizeChange } =
    useSearchResultPagingSort({ pagination, setSearchParams });

  useEffect(() => setSelectedFeatureType(undefined), [submissionId]);

  return (
    <PageSection id="submission-features" label="Features">
      <Box sx={{ px: 2, py: 2 }}>
        <SearchResultSearch
          searchTerm={searchParams.get(URL_PARAMS.SEARCH_QUERY) || ''}
          expressionTree={expressionTree}
          onExpressionApply={handleExpressionApply}
        />
      </Box>

      <Divider />

      <Box sx={{ display: 'flex', minHeight: 0 }}>
        {activeFeatureType && (
          <>
            <Box component="aside" sx={{ width: 240, flexShrink: 0, overflowY: 'auto', px: 2, pt: 2, pb: 1 }}>
              <ToggleButtons
                views={featureTypeOptions}
                activeView={activeFeatureType}
                orientation="vertical"
                ariaLabel="Submission feature types"
                onViewChange={(featureType) => {
                  setSelectedFeatureType(featureType);
                  handlePageChange(1);
                }}
              />
            </Box>
            <Divider orientation="vertical" flexItem />
          </>
        )}

        <Box sx={{ display: 'flex', flex: 1, flexDirection: 'column', minWidth: 0 }}>
          <SearchResultContent
            rows={rows}
            featureTypeProperties={properties}
            isLoading={isLoading}
            pagination={pagination}
            sortOptions={sortOptions}
            activeSort={activeSort}
            view={view}
            viewOptions={SEARCH_RESULT_VIEW_OPTIONS}
            minHeight={520}
            toolbarPaddingY={2}
            onSortChange={handleSortChange}
            onViewChange={setView}
            onResultClick={(result) =>
              navigate(`/submission/${result.submission_id}/feature/${result.submission_feature_id}${location.search}`)
            }
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            mapContent={
              activeFeatureType ? (
                <SearchResultMapContainer
                  featureTypeName={activeFeatureType}
                  expressionTree={expressionTree}
                  submissionIds={submissionIds}
                  isActive={view === SEARCH_RESULT_VIEW.MAP}
                />
              ) : undefined
            }
          />
        </Box>
      </Box>
    </PageSection>
  );
};
