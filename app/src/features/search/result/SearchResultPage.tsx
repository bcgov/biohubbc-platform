import { Box, Divider, Paper } from '@mui/material';
import { PageHeader } from 'components/header/PageHeader';
import { CustomPagination } from 'components/pagination/CustomPagination';
import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useCartContext, useCodesContext, useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router';
import { PageTitle } from 'utils/RouteWithMeta';
import { normalizeQueryParam } from 'utils/query-param';
import { getSearchFeatureTypeRouteConfig } from 'utils/routes';
import { DownloadUrlDisplay } from './components/DownloadUrlDisplay';
import { SearchResultOptions } from './content/option/SearchResultOptions';
import { SearchResultToolbar } from './content/toolbar/SearchResultToolbar';
import { SearchResultSearch } from './header/SearchResultSearch';
import { useSearchResults } from './hooks/useSearchResults';
import { ResultPageContainer } from './layout/ResultPageContainer';
import { DownloadSidebar } from './sidebar/download/DownloadSidebar';
import { DOWNLOAD_SIDEBAR_VIEW } from './sidebar/download/toolbar/DownloadSidebarToolbar';
import { SearchSidebar } from './sidebar/search/SearchSidebar';
import {
  OmitListedRecommendedState,
  RecommendedFiltersInput,
  useRecommendedFilters
} from './sidebar/search/hooks/useRecommendedFilters';

export enum SEARCH_RESULT_OPTION_VIEW {
  LIST = 'list',
  TABLE = 'table'
}

/**
 * Feature search results page for expression-based searching.
 *
 * Use this route component for `/search/:featureType` result pages. It parses
 * the feature type from the URL, keeps the applied expression tree in local
 * state, and coordinates result pagination, sorting, view mode, cart actions,
 * and download sidebar state.
 *
 * @returns {JSX.Element} Feature search result page.
 */
export const SearchResultPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { featureType } = useParams<{ featureType: string }>();
  const api = useApi();
  const { auth } = useAuthStateContext();

  const { codesDataLoader } = useCodesContext();
  const { features, pagination: cartPagination, addToCart, checkout } = useCartContext();
  const dialogContext = useDialogContext();

  const [expressionTree, setExpressionTree] = useState<ExpressionTreeExpression | null>(null);
  const [view, setView] = useState<SEARCH_RESULT_OPTION_VIEW>(SEARCH_RESULT_OPTION_VIEW.LIST);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadView, setDownloadView] = useState<DOWNLOAD_SIDEBAR_VIEW>(DOWNLOAD_SIDEBAR_VIEW.CART);

  const routeConfig = getSearchFeatureTypeRouteConfig(featureType, codesDataLoader.data?.feature_type_with_properties);
  const { rows, isLoading, searchParams, setSearchParams, removeSearchParam, pagination, filters } = useSearchResults(
    routeConfig?.featureTypeName ?? '',
    !!routeConfig,
    expressionTree
  );

  const searchQuery = searchParams.get(URL_PARAMS.SEARCH_QUERY) || undefined;
  const selectedFeatureType = searchParams.get(URL_PARAMS.FEATURE_TYPE) || routeConfig?.featureTypeName;
  const allFeatureTypes = useMemo(
    () => codesDataLoader.data?.feature_type_with_properties.map((ft) => ft.feature_type.display_name) ?? [],
    [codesDataLoader.data]
  );
  const featureTypes = useMemo(() => {
    const types = codesDataLoader.data?.feature_type_with_properties ?? [];

    return {
      options: types.map((type) => ({
        label: type.feature_type.name,
        value: type.feature_type.name
      }))
    };
  }, [codesDataLoader.data]);
  const { recommended, handleRefresh: refreshRecommended } = useRecommendedFilters();
  const [omitListedRecommended, setOmitListedRecommended] = useState<OmitListedRecommendedState>({
    species: new Set(),
    feature_types: new Set(),
    properties: new Set()
  });

  const computedOmitList = useMemo<OmitListedRecommendedState>(() => {
    const omit: OmitListedRecommendedState = {
      species: new Set(omitListedRecommended.species),
      feature_types: new Set(omitListedRecommended.feature_types),
      properties: new Set(omitListedRecommended.properties)
    };

    searchParams.getAll(URL_PARAMS.SPECIES).forEach((value) => omit.species.add(normalizeQueryParam(value)));
    searchParams.getAll(URL_PARAMS.FEATURE_TYPE).forEach((value) => omit.feature_types.add(normalizeQueryParam(value)));

    return omit;
  }, [omitListedRecommended, searchParams]);

  useEffect(() => {
    if (!allFeatureTypes.length) {
      return;
    }

    const recommendedFiltersInput: RecommendedFiltersInput = {
      species: searchQuery,
      feature_types: {
        filters: { feature_type: searchQuery },
        allFeatureTypes
      },
      properties: {
        filters: {
          feature_types: selectedFeatureType ? [selectedFeatureType] : undefined,
          ...(searchQuery ? { keyword: searchQuery } : {})
        },
        pagination: { page: 1, limit: 2 }
      }
    };

    refreshRecommended(recommendedFiltersInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedFeatureType, allFeatureTypes]);

  const handleExpressionApply = useCallback(
    (nextExpressionTree: ExpressionTreeExpression | null) => {
      setExpressionTree(nextExpressionTree);
      setSearchParams(
        {
          [URL_PARAMS.PAGE]: '1',
          ...(nextExpressionTree === null ? { [URL_PARAMS.SORT]: '', [URL_PARAMS.ORDER]: '' } : {})
        },
        true,
        nextExpressionTree
      );
    },
    [setSearchParams]
  );

  const handleFilterChange = useCallback(
    ({ param, value, replace }: { param: UrlParamKey; value: string; replace?: boolean }) => {
      const normalizedValue = normalizeQueryParam(value);
      const currentValues = searchParams.getAll(param).map((currentValue) => normalizeQueryParam(currentValue));

      if (currentValues.includes(normalizedValue)) {
        removeSearchParam(param, normalizedValue);
      } else {
        setSearchParams({ [param]: normalizedValue }, replace);
      }
    },
    [removeSearchParam, searchParams, setSearchParams]
  );

  const omitRecommended = useCallback(
    (type: keyof OmitListedRecommendedState, id: string | number) => {
      const normalized = normalizeQueryParam(id);

      const paramMap: Record<keyof OmitListedRecommendedState, UrlParamKey> = {
        species: URL_PARAMS.SPECIES,
        feature_types: URL_PARAMS.FEATURE_TYPE,
        properties: URL_PARAMS.FEATURE_TYPE
      };

      const param = paramMap[type];
      if (searchParams.has(param, normalized)) {
        removeSearchParam(param, normalized);
      }

      setOmitListedRecommended((prev) => ({
        ...prev,
        [type]: new Set(prev[type]).add(normalized)
      }));
    },
    [removeSearchParam, searchParams]
  );

  const activeSort = pagination?.sort ?? 'relevancy_score';
  const sortOrder = pagination?.order ?? 'desc';

  const sortOptions = useMemo(
    () => [
      { label: 'Date', value: 'create_date', direction: activeSort === 'create_date' ? sortOrder : 'desc' },
      { label: 'Name', value: 'feature_type_name', direction: activeSort === 'feature_type_name' ? sortOrder : 'desc' },
      { label: 'Relevance', value: 'relevancy_score', direction: activeSort === 'relevancy_score' ? sortOrder : 'desc' }
    ],
    [activeSort, sortOrder]
  );

  const handleSortChange = useCallback(
    (sort: string) => {
      if (sort === activeSort) {
        setSearchParams({ [URL_PARAMS.ORDER]: sortOrder === 'asc' ? 'desc' : 'asc' }, true);
      } else {
        setSearchParams({ [URL_PARAMS.SORT]: sort, [URL_PARAMS.ORDER]: 'desc' }, true);
      }
    },
    [activeSort, sortOrder, setSearchParams]
  );

  const handleAddAllToCart = useCallback(async () => {
    try {
      await addToCart(rows);
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    }
  }, [rows, addToCart, dialogContext]);

  /**
   * Download all features matching the legacy filter params.
   *
   * Downloading expression results is intentionally outside this branch's scope,
   * so this preserves the pre-existing filter-based download behavior.
   */
  const handleDownloadAll = useCallback(async () => {
    try {
      setIsDownloading(true);
      const { download_url: downloadUrl } = await api.search.createDownload(filters);

      if (auth.isAuthenticated) {
        dialogContext.setSnackbar({
          snackbarMessage: 'Download started. You can track its progress in your downloads.',
          open: true
        });
      } else {
        dialogContext.setOkDialog({
          dialogTitle: 'Download Started',
          dialogText:
            'Your download is being prepared. Use this URL to check its status and get download links when ready.',
          dialogContent: <DownloadUrlDisplay url={downloadUrl} />,
          open: true,
          onClose: () => dialogContext.setOkDialog({ open: false })
        });
      }
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    } finally {
      setIsDownloading(false);
    }
  }, [filters, api.search, dialogContext, auth.isAuthenticated]);

  const handlePageChange = useCallback(
    (page: number) => {
      setSearchParams({ [URL_PARAMS.PAGE]: String(page) });
    },
    [setSearchParams]
  );

  const handlePageSizeChange = useCallback(
    (limit: number) => {
      setSearchParams({ [URL_PARAMS.LIMIT]: String(limit), [URL_PARAMS.PAGE]: '1' });
    },
    [setSearchParams]
  );

  const handleCheckout = useCallback(async () => {
    try {
      await checkout();
      setDownloadView(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    }
  }, [checkout, dialogContext]);

  if (!codesDataLoader.isReady) {
    return null;
  }

  if (!routeConfig) {
    return <Navigate to="/page-not-found" replace />;
  }

  return (
    <ResultPageContainer
      rightSidebarTitle={downloadView === DOWNLOAD_SIDEBAR_VIEW.CART ? 'Cart' : 'Downloads'}
      leftSidebar={
        <SearchSidebar
          recommended={recommended}
          featureTypeOptions={featureTypes.options}
          queryParams={searchParams}
          omitListedRecommended={computedOmitList}
          onFilterChange={handleFilterChange}
          onOmitListRecommended={omitRecommended}
        />
      }
      rightSidebar={
        <DownloadSidebar
          features={features}
          itemCount={cartPagination?.total ?? 0}
          activeView={downloadView}
          onViewChange={setDownloadView}
          onDownload={handleCheckout}
        />
      }>
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <PageHeader>
          <SearchResultSearch
            searchTerm={searchQuery ?? ''}
            expressionTree={expressionTree}
            onExpressionApply={handleExpressionApply}
          />
        </PageHeader>

        <Paper sx={{ borderRadius: 0, flex: 1, display: 'flex', flexDirection: 'column', m: 1, minHeight: 0 }}>
          <Box sx={{ px: 2, py: 1 }}>
            <SearchResultToolbar
              view={view}
              onViewChange={setView}
              sortOptions={sortOptions}
              activeSort={activeSort}
              onSortChange={handleSortChange}
              handleAddAllToCart={handleAddAllToCart}
              handleDownloadAll={handleDownloadAll}
              isDownloading={isDownloading}
            />
          </Box>

          <Divider />

          <Box sx={{ flex: 1, overflow: 'auto' }}>
            <SearchResultOptions
              rows={rows}
              isLoading={isLoading}
              view={view}
              onClick={(result) =>
                navigate(
                  `/submission/${result.submission_id}/feature/${result.submission_feature_id}${location.search}`
                )
              }
            />
          </Box>

          <Divider />

          <Box sx={{ px: 2, py: 1 }}>
            <CustomPagination
              currentPage={pagination?.current_page ?? 1}
              pageSize={pagination?.per_page ?? 10}
              totalCount={pagination?.total ?? 0}
              lastPage={pagination?.last_page ?? 1}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </Box>
        </Paper>
        <PageTitle title={`Search Results - ${routeConfig.title}`} description={`List of ${routeConfig.title}`} />
      </Box>
    </ResultPageContainer>
  );
};
