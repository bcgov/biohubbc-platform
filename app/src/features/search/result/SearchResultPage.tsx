import { LoadingGuard } from 'components/loading/LoadingGuard';
import { DOWNLOAD_SIDEBAR_VIEW } from 'constants/download';
import { URL_PARAMS } from 'constants/query-params';
import { SEARCH_RESULT_VIEW, SEARCH_RESULT_VIEW_OPTIONS } from 'constants/search';
import { useCodesContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { PageTitle } from 'utils/RouteWithMeta';
import { getSearchFeatureTypeRouteConfig } from 'utils/routes';
import { buildSearchFeatureTypeLinks } from '../utils/search-feature-type-links';
import { SearchResultSecuredAlert } from './content/SearchResultSecuredAlert';
import { SearchResultPanel } from './content/SearchResultPanel';
import { SearchResultPageHeader } from './header/SearchResultPageHeader';
import { useSearchResultCartActions } from './hooks/useSearchResultCartActions';
import { useSearchResultDownload } from './hooks/useSearchResultDownload';
import { useSearchResultExpression } from './hooks/useSearchResultExpression';
import { useSearchResultNavigation } from './hooks/useSearchResultNavigation';
import { useSearchResultPagingSort } from './hooks/useSearchResultPagingSort';
import { useSearchResults } from './hooks/useSearchResults';
import { ResultPageContainer } from './layout/ResultPageContainer';
import { CreateDownloadDialog } from './sidebar/download/CreateDownloadDialog';
import { DownloadSidebar } from './sidebar/download/DownloadSidebar';

/**
 * Route-level coordinator for `/search/:featureType` result pages.
 *
 * Page-specific behavior lives in `hooks/`; presentational sections live under
 * `content/` and `header/` so this component only resolves route metadata and
 * wires the search result screen together.
 *
 * @returns {JSX.Element} Feature search result page.
 */
export const SearchResultPage = () => {
  const { featureType } = useParams<{ featureType: string }>();
  const { codesDataLoader } = useCodesContext();
  const [view, setView] = useState<SEARCH_RESULT_VIEW>(SEARCH_RESULT_VIEW.TABLE);

  const routeConfig = getSearchFeatureTypeRouteConfig(featureType, codesDataLoader.data?.feature_type_with_properties);
  const featureTypeLinks = useMemo(
    () => buildSearchFeatureTypeLinks(codesDataLoader.data?.feature_type_with_properties),
    [codesDataLoader.data?.feature_type_with_properties]
  );
  const featureTypeOptions = useMemo(
    () =>
      (codesDataLoader.data?.feature_type_with_properties ?? []).map((type) => ({
        label: type.feature_type.name,
        value: type.feature_type.name
      })),
    [codesDataLoader.data?.feature_type_with_properties]
  );

  const { expressionTree, expressionApplyRevision, handleExpressionApply } = useSearchResultExpression();
  const { rows, isLoading, searchParams, setSearchParams, pagination } = useSearchResults(
    routeConfig?.featureTypeName,
    Boolean(routeConfig),
    expressionTree,
    expressionApplyRevision
  );
  const { cart, handleAddAllToCart } = useSearchResultCartActions(rows);
  const { activeSort, sortOptions, handleSortChange, handlePageChange, handlePageSizeChange } =
    useSearchResultPagingSort({ pagination, setSearchParams });
  const { handleResultClick, handleFeatureTypeTabChange, handleRequestAccess } =
    useSearchResultNavigation(featureTypeLinks);
  const {
    downloadView,
    setDownloadView,
    isCreateDownloadDialogOpen,
    isSubmittingDownload,
    handleOpenCreateDownload,
    handleCreateDownload,
    handleCancelCreateDownload,
    handleCheckout
  } = useSearchResultDownload({ featureType, expressionTree, isLoading, pagination });

  const searchQuery = searchParams.get(URL_PARAMS.SEARCH_QUERY) || '';
  const hasSecuredResults = rows.some((row) => row.is_secured);

  return (
    <LoadingGuard isLoading={!codesDataLoader.isReady}>
      {!routeConfig ? (
        <Navigate to="/page-not-found" replace />
      ) : (
        <ResultPageContainer
          rightSidebarTitle={downloadView === DOWNLOAD_SIDEBAR_VIEW.CART ? 'Cart' : 'Downloads'}
          rightSidebar={
            <DownloadSidebar
              cart={cart}
              activeView={downloadView}
              onViewChange={setDownloadView}
              onDownload={handleCheckout}
            />
          }>
          <SearchResultPageHeader
            activeFeatureType={routeConfig.featureTypeName}
            featureTypeLinks={featureTypeLinks}
            searchTerm={searchQuery}
            expressionTree={expressionTree}
            onExpressionApply={handleExpressionApply}
            onFeatureTypeChange={handleFeatureTypeTabChange}
          />

          {hasSecuredResults && <SearchResultSecuredAlert onRequestAccess={handleRequestAccess} />}

          <SearchResultPanel
            rows={rows}
            isLoading={isLoading}
            pagination={pagination}
            sortOptions={sortOptions}
            activeSort={activeSort}
            view={view}
            viewOptions={SEARCH_RESULT_VIEW_OPTIONS}
            isCreateDownloadDisabled={isSubmittingDownload || isLoading || pagination === undefined}
            onAddAllToCart={handleAddAllToCart}
            onCreateDownloadClick={handleOpenCreateDownload}
            onSortChange={handleSortChange}
            onViewChange={setView}
            onResultClick={handleResultClick}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
          />

          <PageTitle title={`Search Results - ${routeConfig.title}`} description={`List of ${routeConfig.title}`} />

          <CreateDownloadDialog
            open={isCreateDownloadDialogOpen}
            isSubmitting={isSubmittingDownload}
            defaultName={`${routeConfig.title} download`}
            defaultFeatureType={routeConfig.featureTypeName}
            featureTypeOptions={featureTypeOptions}
            onCancel={handleCancelCreateDownload}
            onSave={handleCreateDownload}
          />
        </ResultPageContainer>
      )}
    </LoadingGuard>
  );
};
