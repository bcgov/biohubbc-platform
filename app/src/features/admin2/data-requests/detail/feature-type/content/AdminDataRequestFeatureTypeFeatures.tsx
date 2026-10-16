import Typography from '@mui/material/Typography';
import { PageSection } from 'components/section/PageSection';
import { SEARCH_RESULT_VIEW, SEARCH_RESULT_VIEW_OPTIONS } from 'constants/search';
import { SearchResultContent } from 'features/search/result/content/SearchResultContent';
import { useSearchResultPagingSort } from 'features/search/result/hooks/useSearchResultPagingSort';
import { useSearchResults } from 'features/search/result/hooks/useSearchResults';
import { SearchResultMapContainer } from 'features/search/result/layout/map/SearchResultMapContainer';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildSubmissionPropertyValuePathResolvers } from 'utils/routes';

interface AdminDataRequestFeatureTypeFeaturesProps {
  /** The requested feature type to search. */
  featureType: string;
  /** The expression the data request limits the feature type with, or null when it asks for every feature. */
  expression: ExpressionTreeExpression | null;
}

/**
 * Features tab of a data request's feature type page: the features of that type the data request asks for, found by
 * running the feature search with the request's expression. Sorting and cursor pagination are kept in the URL exactly
 * as on the main search results page; the expression is fixed by the request.
 *
 * @param {AdminDataRequestFeatureTypeFeaturesProps} props The feature type and expression to search.
 * @returns {JSX.Element} The requested features as search results.
 */
export const AdminDataRequestFeatureTypeFeatures = ({
  featureType,
  expression
}: AdminDataRequestFeatureTypeFeaturesProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [view, setView] = useState<SEARCH_RESULT_VIEW>(SEARCH_RESULT_VIEW.TABLE);
  const pathResolvers = useMemo(
    () => buildSubmissionPropertyValuePathResolvers('/submission', location.search),
    [location.search]
  );

  const { rows, properties, isLoading, cursor, totalCount, setSearchParams } = useSearchResults(
    featureType,
    true,
    expression
  );
  const { activeSort, sortOptions, handleSortChange, handlePageChange, handlePageSizeChange } =
    useSearchResultPagingSort({ cursor, setSearchParams });

  return (
    <PageSection
      id="data-request-features"
      label={
        <>
          Features{' '}
          {totalCount !== undefined && (
            <Typography sx={{ fontSize: 'inherit' }} color="textSecondary" component="span">
              ({totalCount})
            </Typography>
          )}
        </>
      }>
      <SearchResultContent
        rows={rows}
        featureTypeProperties={properties}
        pathResolvers={pathResolvers}
        isLoading={isLoading}
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
          navigate(`/submission/${result.submission_id}/feature/${result.submission_feature_id}`)
        }
        onPageChange={handlePageChange}
        onPageSizeChange={handlePageSizeChange}
        mapContent={
          <SearchResultMapContainer
            featureTypeName={featureType}
            expressionTree={expression}
            isActive={view === SEARCH_RESULT_VIEW.MAP}
          />
        }
      />
    </PageSection>
  );
};
