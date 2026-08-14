import { LoadingGuard } from 'components/loading/LoadingGuard';
import { URL_PARAMS } from 'constants/query-params';
import { SEARCH_RESULT_VIEW, SEARCH_RESULT_VIEW_OPTIONS } from 'constants/search';
import dayjs from 'dayjs';
import { CreateDataRequestDialog } from 'features/data-request/components/CreateDataRequestDialog';
import { useCodesContext } from 'hooks/useContext';
import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router';
import { PageTitle } from 'utils/RouteWithMeta';
import { getSearchFeatureTypeRouteConfig } from 'utils/routes';
import { buildSearchFeatureTypeLinks } from '../utils/search-feature-type-links';
import { SearchResultPanel } from './content/SearchResultPanel';
import { SearchResultMapContainer } from './layout/map/SearchResultMapContainer';
import { SearchResultSecuredAlert } from './content/SearchResultSecuredAlert';
import { SearchResultPageHeader } from './header/SearchResultPageHeader';
import { useSearchResultDataRequest } from './hooks/useSearchResultDataRequest';
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
  const { expressionTree, expressionApplyRevision, handleExpressionApply } = useSearchResultExpression();
  const { rows, properties, hasMoreSecuredFeatures, isLoading, searchParams, setSearchParams, pagination } =
    useSearchResults(routeConfig?.featureTypeName, Boolean(routeConfig), expressionTree, expressionApplyRevision);
  const { activeSort, sortOptions, handleSortChange, handlePageChange, handlePageSizeChange } =
    useSearchResultPagingSort({ pagination, setSearchParams });
  const { handleResultClick, handleFeatureTypeTabChange } = useSearchResultNavigation(featureTypeLinks);
  const {
    downloadView,
    isCreateDownloadDialogOpen,
    isSubmittingDownload,
    handleOpenCreateDownload,
    handleCreateDownload,
    handleCancelCreateDownload
  } = useSearchResultDownload({ featureType, expressionTree, isLoading, pagination });
  const {
    isCreateDataRequestDialogOpen,
    isSubmittingDataRequest,
    handleOpenCreateDataRequest,
    handleCreateDataRequest,
    handleCancelCreateDataRequest
  } = useSearchResultDataRequest({ featureType: routeConfig?.featureTypeName, expressionTree });

  const searchQuery = searchParams.get(URL_PARAMS.SEARCH_QUERY) || '';
  // Show the "request access" banner when the search matched secured features hidden from the caller,
  // not merely because visible rows the caller can already see are secured.
  const hasHiddenSecuredResults = hasMoreSecuredFeatures;

  if (routeConfig) {
    return (
      <LoadingGuard>
        <ResultPageContainer rightSidebarTitle={downloadView} rightSidebar={<DownloadSidebar />}>
          <SearchResultPageHeader
            activeFeatureType={routeConfig.featureTypeName}
            featureTypeLinks={featureTypeLinks}
            searchTerm={searchQuery}
            expressionTree={expressionTree}
            onExpressionApply={handleExpressionApply}
            onFeatureTypeChange={handleFeatureTypeTabChange}
          />

          {hasHiddenSecuredResults && <SearchResultSecuredAlert onRequestAccess={handleOpenCreateDataRequest} />}

          <SearchResultPanel
            rows={rows}
            featureTypeProperties={properties}
            isLoading={isLoading}
            pagination={pagination}
            sortOptions={sortOptions}
            activeSort={activeSort}
            view={view}
            viewOptions={SEARCH_RESULT_VIEW_OPTIONS}
            isCreateDownloadDisabled={isSubmittingDownload || isLoading || pagination === undefined}
            onCreateDownloadClick={handleOpenCreateDownload}
            onSortChange={handleSortChange}
            onViewChange={setView}
            onResultClick={handleResultClick}
            onPageChange={handlePageChange}
            onPageSizeChange={handlePageSizeChange}
            mapContent={
              <SearchResultMapContainer
                featureTypeName={routeConfig.featureTypeName}
                expressionTree={expressionTree ?? null}
                isActive={view === SEARCH_RESULT_VIEW.MAP}
              />
            }
          />

          <PageTitle title={`Search Results - ${routeConfig.title}`} description={`List of ${routeConfig.title}`} />

          <CreateDownloadDialog
            open={isCreateDownloadDialogOpen}
            isSubmitting={isSubmittingDownload}
            defaultName={`${routeConfig.featureTypeName} - ${dayjs().format('YYYY-MM-DD HH:mm')}`}
            onCancel={handleCancelCreateDownload}
            onSave={handleCreateDownload}
          />

          <CreateDataRequestDialog
            open={isCreateDataRequestDialogOpen}
            isSubmitting={isSubmittingDataRequest}
            initialReason=""
            onCancel={handleCancelCreateDataRequest}
            onSave={handleCreateDataRequest}
          />
        </ResultPageContainer>
      </LoadingGuard>
    );
  }

  if (codesDataLoader.isReady) {
    return <Navigate to="/page-not-found" replace />;
  }

  return <LoadingGuard isLoading />;
};
