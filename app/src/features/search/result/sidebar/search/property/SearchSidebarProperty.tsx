import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { TypedURLSearchParams } from 'hooks/useSearchQuery';
import { useCallback, useMemo } from 'react';
import { SidebarOption } from '../components/section/option/SearchSidebarOption';
import { SearchSidebarSection } from '../components/section/SearchSidebarSection';
import { usePropertySearch } from '../hooks/usePropertySearch';
import { RecommendedFiltersState } from '../hooks/useRecommendedFilters';

interface SearchSidebarPropertiesProps {
  recommended: RecommendedFiltersState;
  queryParams: TypedURLSearchParams<Record<string, string>>;
  omitListedRecommendedIds: Set<string | number>;
  onFilterChange: (update: { param: UrlParamKey; value: string; replace?: boolean }) => void;
  onOmitListRecommended: (id: string | number) => void;
}

/**
 * Renders the Properties filter section in the search sidebar
 * Properties are dynamic query parameters filtered from pagination/metadata params
 * @param {SearchSidebarPropertiesProps} props
 * @returns {*}
 */
export const SearchSidebarProperties = ({
  recommended,
  queryParams,
  omitListedRecommendedIds,
  onFilterChange,
  onOmitListRecommended
}: SearchSidebarPropertiesProps) => {
  const { rows: propertyRows, handleSearch } = usePropertySearch();

  /**
   * Get property params by filtering out pagination and metadata params
   * @returns {string[]} Array of property parameter keys
   */
  const selectedProperties = useMemo(() => {
    const EXCLUDED_PARAMS = new Set([
      URL_PARAMS.SEARCH_QUERY,
      URL_PARAMS.FEATURE_TYPE,
      URL_PARAMS.SPECIES,
      URL_PARAMS.PAGE,
      URL_PARAMS.LIMIT,
      URL_PARAMS.SORT,
      URL_PARAMS.ORDER
    ]);

    return Array.from(queryParams.keys()).filter((key) => !EXCLUDED_PARAMS.has(key as UrlParamKey));
  }, [queryParams]);

  const selectedFeatureTypes = useMemo(() => queryParams.getAll(URL_PARAMS.FEATURE_TYPE), [queryParams]);

  /**
   * SELECT: add to query params, trigger search with this filter
   */
  const handleSelectOption = useCallback(
    (option: SidebarOption) => {
      onFilterChange({
        param: String(option.value) as UrlParamKey,
        value: String(option.value),
        replace: false
      });
    },
    [onFilterChange]
  );

  /**
   * DESELECT: remove from query params, trigger search without this filter
   */
  const handleDeselectOption = useCallback(
    (option: SidebarOption) => {
      onFilterChange({
        param: String(option.value) as UrlParamKey,
        value: String(option.value),
        replace: undefined
      });
    },
    [onFilterChange]
  );

  /**
   * REMOVE: omit from recommended list
   */
  const handleRemoveRecommendedOption = useCallback(
    (id: string | number) => {
      onOmitListRecommended(id);
    },
    [onOmitListRecommended]
  );

  /**
   * Handle property search with current feature type filter
   */
  const handlePropertySearch = useCallback(
    (query: string) => {
      handleSearch({ keyword: query, feature_types: selectedFeatureTypes });
    },
    [handleSearch, selectedFeatureTypes]
  );

  return (
    <SearchSidebarSection
      title="Properties"
      options={propertyRows}
      recommendedOptions={recommended.properties}
      selectedValues={selectedProperties}
      omitListedRecommendedIds={omitListedRecommendedIds}
      searchPlaceholder="Search properties..."
      checkbox
      onSearch={handlePropertySearch}
      onSelectOption={handleSelectOption}
      onDeselectOption={handleDeselectOption}
      onRemoveRecommendedOption={handleRemoveRecommendedOption}
    />
  );
};
