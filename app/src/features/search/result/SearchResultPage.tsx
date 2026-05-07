import { Box, Divider, Paper } from '@mui/material';
import { PageHeader } from 'components/header/PageHeader';
import { CustomPagination } from 'components/pagination/CustomPagination';
import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useAuthStateContext } from 'hooks/useAuthStateContext';
import { useCartContext, useCodesContext, useDialogContext } from 'hooks/useContext';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { ISearchPropertyFilters } from 'interfaces/useSearchApi.interface';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { CreateDownloadDialog } from './sidebar/download/CreateDownloadDialog';
import { ICreateDownloadFormValues } from './sidebar/download/CreateDownloadForm';
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
  const [downloadView, setDownloadView] = useState<DOWNLOAD_SIDEBAR_VIEW>(DOWNLOAD_SIDEBAR_VIEW.CART);
  const [isCreateDownloadDialogOpen, setIsCreateDownloadDialogOpen] = useState(false);
  const [isSubmittingDownload, setIsSubmittingDownload] = useState(false);
  // Synchronous mutex for createDownload to close the gap between click and the React re-render
  // that disables the EditDialog save button. Refs update synchronously; state does not.
  const isSubmittingDownloadRef = useRef(false);

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

    const propertyFilters: ISearchPropertyFilters = {
      feature_types: selectedFeatureType ? [selectedFeatureType] : undefined
    };

    if (searchQuery) {
      propertyFilters.keyword = searchQuery;
    }

    const recommendedFiltersInput: RecommendedFiltersInput = {
      species: searchQuery,
      feature_types: {
        filters: { feature_type: searchQuery },
        allFeatureTypes
      },
      properties: {
        filters: propertyFilters,
        pagination: { page: 1, limit: 2 }
      }
    };

    refreshRecommended(recommendedFiltersInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, selectedFeatureType, allFeatureTypes]);

  const handleExpressionApply = useCallback(
    (nextExpressionTree: ExpressionTreeExpression | null) => {
      setExpressionTree(nextExpressionTree);

      const nextParams: Partial<Record<UrlParamKey, string>> = {
        [URL_PARAMS.PAGE]: '1'
      };

      if (nextExpressionTree === null) {
        nextParams[URL_PARAMS.SORT] = '';
        nextParams[URL_PARAMS.ORDER] = '';
      }

      setSearchParams(nextParams);
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
   * Anonymous Bulk Download. Preserved verbatim from the prior `handleDownloadAll` auth branch.
   *
   * The current `POST /api/download` body schema requires authenticated session metadata that the
   * anonymous path does not produce, so this flow is broken end-to-end against the merged backend
   * but kept in place until a separate ticket reconciles it.
   */
  const handleAnonymousDownloadAll = useCallback(async () => {
    if (isSubmittingDownloadRef.current) {
      return;
    }
    isSubmittingDownloadRef.current = true;
    try {
      setIsSubmittingDownload(true);
      const { download_url: downloadUrl } = await api.search.createDownload(filters);

      dialogContext.setOkDialog({
        dialogTitle: 'Download Started',
        dialogText:
          'Your download is being prepared. Use this URL to check its status and get download links when ready.',
        dialogContent: <DownloadUrlDisplay url={downloadUrl} />,
        open: true,
        onClose: () => dialogContext.setOkDialog({ open: false })
      });
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    } finally {
      setIsSubmittingDownload(false);
      isSubmittingDownloadRef.current = false;
    }
  }, [filters, api.search, dialogContext]);

  /**
   * Resolve the toolbar `Create Download` click. Anonymous users still hit the legacy URL-display
   * flow; authenticated users with at least one matching feature open the create-download dialog.
   * Authenticated users whose current search has zero results see an OkDialog instead — sparing
   * them from filling in metadata for an empty download.
   */
  const handleOpenCreateDownload = useCallback(() => {
    if (!auth.isAuthenticated) {
      handleAnonymousDownloadAll();
      return;
    }

    if ((pagination?.total ?? 0) === 0) {
      dialogContext.setOkDialog({
        open: true,
        dialogTitle: 'Create Download',
        dialogText: 'There are no features matching your current search to download.',
        onClose: () => dialogContext.setOkDialog({ open: false })
      });
      return;
    }

    setIsCreateDownloadDialogOpen(true);
  }, [auth.isAuthenticated, pagination?.total, dialogContext, handleAnonymousDownloadAll]);

  /**
   * Submit handler for the create-download dialog. Posts the form values plus the page-level
   * expression tree as a single `CreateDownloadRequest`, then switches the right sidebar to the
   * Downloads view so the user can watch the new job progress.
   *
   * `expression` is forwarded as the literal page state. The expression-builder popover already
   * strips builder-only `ui_id` fields at apply time, so the page state is wire-clean by
   * construction; a second sanitizer here would duplicate the contract guarantee. The key must
   * be present (the backend uses `.nullable()`, not `.optional()`); when no expression is
   * applied, the page state is `null` and is sent as `null`.
   */
  const handleCreateDownload = useCallback(
    async (values: ICreateDownloadFormValues) => {
      if (isSubmittingDownloadRef.current) {
        return;
      }
      isSubmittingDownloadRef.current = true;
      try {
        setIsSubmittingDownload(true);
        await api.download.createDownload({
          name: values.name,
          description: values.description,
          featureTypes: values.featureTypes,
          expression: expressionTree
        });
        setIsCreateDownloadDialogOpen(false);
        setDownloadView(DOWNLOAD_SIDEBAR_VIEW.DOWNLOADS);
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: 'Download created. Track its progress in the Downloads sidebar.'
        });
      } catch (error) {
        dialogContext.setSnackbar({
          open: true,
          snackbarMessage: (error as APIError).message
        });
      } finally {
        setIsSubmittingDownload(false);
        isSubmittingDownloadRef.current = false;
      }
    },
    [api.download, dialogContext, expressionTree]
  );

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
              onCreateDownloadClick={handleOpenCreateDownload}
              isCreateDownloadDisabled={isSubmittingDownload}
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
      <CreateDownloadDialog
        open={isCreateDownloadDialogOpen}
        isSubmitting={isSubmittingDownload}
        defaultName={`${routeConfig.title} download`}
        defaultFeatureType={routeConfig.featureTypeName}
        featureTypeOptions={featureTypes.options}
        onCancel={() => setIsCreateDownloadDialogOpen(false)}
        onSave={handleCreateDownload}
      />
    </ResultPageContainer>
  );
};
