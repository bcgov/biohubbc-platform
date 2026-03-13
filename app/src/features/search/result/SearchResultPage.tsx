import { Box, Divider, Paper } from '@mui/material';
import { PageHeader } from 'components/header/PageHeader';
import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useCartContext, useCodesContext, useDialogContext } from 'hooks/useContext';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { normalizeQueryParam } from 'utils/query-param';
import { SearchResultOptions } from './content/option/SearchResultOptions';
import { Pagination } from 'components/pagination/Pagination';
import { SearchResultToolbar } from './content/toolbar/SearchResultToolbar';
import { SearchResultHeader } from './header/SearchResultHeader';
import { useSearchResults } from './hooks/useSearchResults';
import { ResultPageContainer } from './layout/ResultPageContainer';
import { DownloadSidebar } from './sidebar/download/DownloadSidebar';
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

export const SearchResultPage = () => {
  const navigate = useNavigate();
  const { rows, isLoading, searchParams, setSearchParams, removeSearchParam, pagination, filters } = useSearchResults();
  const api = useApi();
  const { codesDataLoader } = useCodesContext();
  const { features, pagination: cartPagination, addToCart, checkout } = useCartContext();
  const dialogContext = useDialogContext();

  const [view, setView] = useState<SEARCH_RESULT_OPTION_VIEW>(SEARCH_RESULT_OPTION_VIEW.LIST);
  const [isDownloading, setIsDownloading] = useState(false);
  const { recommended, handleRefresh: refreshRecommended } = useRecommendedFilters();

  /**
   * --------------------
   * Derived data
   * --------------------
   */
  const featureTypes = useMemo(() => {
    const types = codesDataLoader.data?.feature_type_with_properties ?? [];

    return {
      tabs: types.map((t) => ({
        value: t.feature_type.feature_type_name,
        label: t.feature_type.feature_type_name
      })),
      options: types.map((t) => ({
        label: t.feature_type.feature_type_name,
        value: t.feature_type.feature_type_name
      })),
      allNames: types.map((t) => t.feature_type.feature_type_display_name)
    };
  }, [codesDataLoader.data]);

  const searchQuery = searchParams.get(URL_PARAMS.SEARCH_QUERY) || undefined;
  const featureType = searchParams.get(URL_PARAMS.FEATURE_TYPE) || undefined;
  const allFeatureTypes = useMemo(
    () =>
      codesDataLoader.data?.feature_type_with_properties.map((ft) => ft.feature_type.feature_type_display_name) ?? [],
    [codesDataLoader.data]
  );

  /**
   * --------------------
   * Recommended filters
   * --------------------
   */
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

    searchParams.getAll(URL_PARAMS.SPECIES).forEach((v) => omit.species.add(normalizeQueryParam(v)));
    searchParams.getAll(URL_PARAMS.FEATURE_TYPE).forEach((v) => omit.feature_types.add(normalizeQueryParam(v)));

    return omit;
  }, [omitListedRecommended, searchParams]);

  useEffect(() => {
    if (!featureTypes.allNames.length) {
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
          feature_types: featureType ? [featureType] : undefined,
          ...(searchQuery ? { keyword: searchQuery } : {})
        },
        pagination: { page: 1, limit: 2 }
      }
    };

    refreshRecommended(recommendedFiltersInput);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, featureType, allFeatureTypes]);

  /**
   * --------------------
   * Query param helpers
   * --------------------
   */
  const handleFilterChange = useCallback(
    ({ param, value, replace }: { param: UrlParamKey; value: string; replace?: boolean }) => {
      const normalizedValue = normalizeQueryParam(value);
      const currentValues = searchParams.getAll(param).map((val) => normalizeQueryParam(val));

      // Check if the value is already selected
      if (currentValues.includes(normalizedValue)) {
        // If it's selected, remove it from the URL (deselect it)
        removeSearchParam(param, normalizedValue);
      } else {
        // If it's not selected, add it to the URL (select it)
        setSearchParams({ [param]: normalizedValue }, replace);
      }
    },
    [setSearchParams, removeSearchParam, searchParams]
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
    [searchParams, removeSearchParam]
  );

  /**
   * --------------------
   * Sorting
   * --------------------
   */
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

  /**
   * --------------------
   * Add to cart logic
   * --------------------
   */
  const handleAddAllToCart = useCallback(async () => {
    try {
      await addToCart(rows);
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    }
  }, [rows, addToCart, dialogContext]);

  /**
   * Download all features matching the current search filters in one click.
   * Bypasses the shopping cart — sends filters to POST /api/download which resolves
   * them to feature IDs server-side and creates a download record.
   */
  const handleDownloadAll = useCallback(async () => {
    try {
      setIsDownloading(true);
      await api.search.createDownload(filters);
      dialogContext.setSnackbar({
        snackbarMessage: 'Download started. You can track its progress in your downloads.',
        open: true
      });
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    } finally {
      setIsDownloading(false);
    }
  }, [filters, api.search, dialogContext]);

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
      const download = await checkout();

      if (download?.download_id) {
        // Navigate to the download
        navigate(`/download/${download.download_id}`);
      }
    } catch (error) {
      dialogContext.setSnackbar({ snackbarMessage: (error as APIError).message, open: true });
    }
  }, [checkout, dialogContext, navigate]);

  return (
    <ResultPageContainer
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
        <DownloadSidebar features={features} itemCount={cartPagination?.total ?? 0} onDownload={handleCheckout} />
      }>
      <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <PageHeader>
          <SearchResultHeader
            searchTerm={searchQuery ?? ''}
            onSubmit={(value) => handleFilterChange({ param: URL_PARAMS.SEARCH_QUERY, value, replace: true })}
            onClear={() => removeSearchParam(URL_PARAMS.SEARCH_QUERY)}
            isSubmitting={isLoading}
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
            <SearchResultOptions rows={rows} isLoading={isLoading} view={view} />
          </Box>

          <Divider />

          <Box sx={{ px: 2, py: 1 }}>
            <Pagination
              currentPage={pagination?.current_page ?? 1}
              pageSize={pagination?.per_page ?? 10}
              totalCount={pagination?.total ?? 0}
              lastPage={pagination?.last_page ?? 1}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          </Box>
        </Paper>
      </Box>
    </ResultPageContainer>
  );
};
