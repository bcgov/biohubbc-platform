import { Box, Divider, Paper, Stack } from '@mui/material';
import { PageHeader } from 'components/header/PageHeader';
import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useCodesContext } from 'hooks/useContext';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { normalizeQueryParam } from 'utils/query-param';
import { SearchResultOptions } from './content/option/SearchResultOptions';
import { SearchResultToolbar } from './content/toolbar/SearchResultToolbar';
import { SearchResultHeader } from './header/SearchResultHeader';
import { useSearchResults } from './hooks/useSearchResults';
import {
  OmitListedRecommendedState,
  RecommendedFiltersInput,
  useRecommendedFilters
} from './sidebar/hooks/useRecommendedFilters';
import { SearchSidebar } from './sidebar/SearchSidebar';

export enum SEARCH_RESULT_OPTION_VIEW {
  LIST = 'list',
  TABLE = 'table'
}

export const SearchResultPage = () => {
  const { rows, isLoading, searchParams, setSearchParams, removeSearchParam, pagination } = useSearchResults();
  const { codesDataLoader } = useCodesContext();

  const hasBeenCalled = useRef(false);

  const [view, setView] = useState<SEARCH_RESULT_OPTION_VIEW>(SEARCH_RESULT_OPTION_VIEW.LIST);
  const { recommended, handleRefresh: refreshRecommended } = useRecommendedFilters();

  // Track omitListed recommended items (per session only)
  const [omitListedRecommended, setOmitListedRecommended] = useState<OmitListedRecommendedState>({
    species: new Set(),
    feature_types: new Set(),
    properties: new Set()
  });

  const tabs = useMemo(
    () =>
      codesDataLoader.data?.feature_type_with_properties.map((type) => ({
        value: type.feature_type.feature_type_name,
        label: type.feature_type.feature_type_name
      })) ?? [],
    [codesDataLoader.data]
  );

  const featureTypeOptions = useMemo(
    () =>
      tabs.map((tab) => ({
        label: tab.label ?? tab.value,
        value: tab.value
      })),
    [tabs]
  );

  // Extract primitive values for dependency tracking
  const searchQuery = useMemo(() => searchParams.get(URL_PARAMS.SEARCH_QUERY) || undefined, [searchParams]);
  const featureType = useMemo(() => searchParams.get(URL_PARAMS.FEATURE_TYPE) || undefined, [searchParams]);
  const allFeatureTypes = useMemo(
    () =>
      codesDataLoader.data?.feature_type_with_properties.map((ft) => ft.feature_type.feature_type_display_name) ?? [],
    [codesDataLoader.data]
  );

  // Build omitList from selected filters + manually omitListed items
  const computedOmitListedRecommended = useMemo(() => {
    const omitList: OmitListedRecommendedState = {
      species: new Set(omitListedRecommended.species),
      feature_types: new Set(omitListedRecommended.feature_types),
      properties: new Set(omitListedRecommended.properties)
    };

    // Add currently selected filters to the omitList
    if (searchParams.has(URL_PARAMS.SPECIES)) {
      const speciesValues = searchParams.getAll(URL_PARAMS.SPECIES);
      speciesValues.forEach((val) => omitList.species.add(normalizeQueryParam(val)));
    }

    if (searchParams.has(URL_PARAMS.FEATURE_TYPE)) {
      const featureTypeValues = searchParams.getAll(URL_PARAMS.FEATURE_TYPE);
      featureTypeValues.forEach((val) => omitList.feature_types.add(normalizeQueryParam(val)));
    }

    // Note: Properties are filtered by feature type, so we don't omitList them globally
    // They're handled per feature type in the sidebar

    return omitList;
  }, [omitListedRecommended, searchParams]);

  // Refresh recommended filters when search query or filters change
  useEffect(() => {
    // Skip if feature types haven't loaded yet
    if (allFeatureTypes.length === 0) {
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
   * REMOVE RECOMMENDED: omitList it, deselect if selected, and trigger search
   */
  const handleOmitListRecommended = useCallback(
    (type: keyof OmitListedRecommendedState, id: string | number) => {
      const normalizedId = normalizeQueryParam(id);

      // Map type to URL param
      const paramMap: Record<keyof OmitListedRecommendedState, UrlParamKey> = {
        species: URL_PARAMS.SPECIES,
        feature_types: URL_PARAMS.FEATURE_TYPE,
        properties: URL_PARAMS.FEATURE_TYPE
      };

      const param = paramMap[type];

      // Deselect if currently selected
      if (param && searchParams.has(param, normalizedId)) {
        removeSearchParam(param, normalizedId);
      }

      // OmitList it (store normalized value)
      setOmitListedRecommended((prev) => ({
        ...prev,
        [type]: new Set([...prev[type], normalizedId])
      }));
    },
    [searchParams, removeSearchParam]
  );

  /**
   * UPDATE FILTERS: select/deselect options from query params
   */
  const handleFilterChange = useCallback(
    ({ param, value, replace }: { param: UrlParamKey; value: string; replace?: boolean }) => {
      const normalizedValue = normalizeQueryParam(value);
      hasBeenCalled.current = true;

      if (replace === undefined) {
        // DESELECT: remove from query params
        removeSearchParam(param, normalizedValue);
      } else {
        // SELECT: add to query params (or replace if replace=true)
        setSearchParams({ [param]: normalizedValue }, replace);
      }
    },
    [setSearchParams, removeSearchParam]
  );

  // Sort handling
  const sortOptionsBase = useMemo(
    () => [
      { label: 'Date', value: 'create_date' },
      { label: 'Name', value: 'feature_type_name' },
      { label: 'Relevance', value: 'relevancy_score' }
    ],
    []
  );

  const activeSort = pagination?.sort ?? 'relevancy_score';
  const sortOrder = pagination?.order ?? 'desc';

  /**
   * Handle sort option changes
   */
  const handleSortChange = useCallback(
    (sort: string) => {
      if (sort === activeSort) {
        setSearchParams({ [URL_PARAMS.ORDER]: sortOrder === 'asc' ? 'desc' : 'asc' }, true);
      } else {
        setSearchParams(
          {
            [URL_PARAMS.SORT]: sort,
            [URL_PARAMS.ORDER]: 'desc'
          },
          true
        );
      }
    },
    [activeSort, sortOrder, setSearchParams]
  );

  const sortOptions = useMemo(
    () =>
      sortOptionsBase.map((opt) => ({
        ...opt,
        direction: opt.value === activeSort ? sortOrder : 'desc'
      })),
    [activeSort, sortOrder, sortOptionsBase]
  );

  return (
    <Stack direction="row" flex="1 1 100%" height="100%" overflow="hidden">
      {/* Sidebar */}
      <Paper
        sx={{
          width: 300,
          flexShrink: 0,
          position: 'sticky',
          top: 0,
          height: '100%',
          p: 2,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid',
          borderColor: 'divider',
          boxShadow: '4px 0 6px -2px rgba(0,0,0,0.025)'
        }}>
        <SearchSidebar
          recommended={recommended}
          featureTypeOptions={featureTypeOptions}
          queryParams={searchParams}
          omitListedRecommended={computedOmitListedRecommended}
          onFilterChange={handleFilterChange}
          onOmitListRecommended={handleOmitListRecommended}
        />
      </Paper>

      {/* Main content */}
      <Box flex="1 1 auto" display="flex" flexDirection="column" overflow="hidden">
        {/* Sticky headers */}
        <Box flexShrink={0}>
          <PageHeader>
            <SearchResultHeader
              searchTerm={searchParams.get(URL_PARAMS.SEARCH_QUERY) ?? ''}
              onSubmit={(searchTerm) =>
                handleFilterChange({
                  param: URL_PARAMS.SEARCH_QUERY,
                  value: searchTerm,
                  replace: true
                })
              }
              onClear={() => removeSearchParam(URL_PARAMS.SEARCH_QUERY)}
              isSubmitting={isLoading}
            />
          </PageHeader>
        </Box>

        {/* Scrollable content */}
        <Box flex="1 1 auto" overflow="auto" p={1}>
          <Paper
            sx={{
              boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
              height: '100%',
              display: 'flex',
              flexDirection: 'column'
            }}>
            {/* Toolbar */}
            <Box px={2} py={1} flexShrink={0}>
              <SearchResultToolbar
                view={view}
                onViewChange={setView}
                sortOptions={sortOptions}
                activeSort={activeSort}
                onSortChange={handleSortChange}
              />
            </Box>

            <Divider />

            {/* Scrollable results */}
            <Box flex="1 1 auto" overflow="auto">
              <SearchResultOptions rows={rows} isLoading={isLoading && !hasBeenCalled} view={view} />
            </Box>
          </Paper>
        </Box>
      </Box>
    </Stack>
  );
};
