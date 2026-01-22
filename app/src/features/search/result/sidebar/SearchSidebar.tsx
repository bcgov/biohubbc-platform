import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { TypedURLSearchParams } from 'hooks/useSearchQuery';
import { useCallback, useEffect, useMemo } from 'react';
import { SidebarHeader } from './header/SearchSidebarHeader';
import { useFeatureSearch } from './hooks/useFeatureSearch';
import { usePropertySearch } from './hooks/usePropertySearch';
import { OmitListedRecommendedState, RecommendedFiltersState } from './hooks/useRecommendedFilters';
import { useSpeciesSearch } from './hooks/useSpeciesSearch';
import { SidebarOption } from './section/option/SearchSidebarOption';
import { SearchSidebarSection } from './section/SearchSidebarSection';

interface SearchSidebarProps {
  recommended: RecommendedFiltersState;
  featureTypeOptions: SidebarOption[];
  queryParams: TypedURLSearchParams<Record<string, string>>;
  omitListedRecommended: OmitListedRecommendedState;
  onFilterChange: (update: { param: UrlParamKey; value: string; replace?: boolean }) => void;
  onOmitListRecommended: (type: keyof OmitListedRecommendedState, id: string | number) => void;
}

/**
 * Renders sidebar for applying filters to the search
 * @param {SearchSidebarProps} props
 * @returns {*}
 */
export const SearchSidebar = (props: SearchSidebarProps) => {
  const { recommended, featureTypeOptions, queryParams, omitListedRecommended, onFilterChange, onOmitListRecommended } =
    props;

  /**
   * Search handlers for finding filter options, independent of the main search results.
   * Main search results are only updated when an option is selected.
   */
  const { rows: speciesOptions, handleSearch: handleSpeciesSearch } = useSpeciesSearch();
  const { rows: featureRows, handleSearch: handleFeatureSearch } = useFeatureSearch(featureTypeOptions);
  const { rows: propertyRows, handleSearch: handlePropertySearch } = usePropertySearch();

  const selectedFeatureTypes = useMemo(() => queryParams.getAll(URL_PARAMS.FEATURE_TYPE), [queryParams]);
  const selectedSpecies = useMemo(() => queryParams.getAll(URL_PARAMS.SPECIES), [queryParams]);

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

  /**
   * Load selected species that aren't in the options array yet
   * by searching for them via their TSN
   */
  useEffect(() => {
    selectedSpecies.forEach((tsn) => {
      // Check if this TSN is already in the options
      const isInOptions = speciesOptions.some((opt) => String(opt.value) === tsn);

      // If not in options, search for it to load the full option with label
      if (!isInOptions) {
        handleSpeciesSearch(tsn);
      }
    });
  }, [selectedSpecies, speciesOptions, handleSpeciesSearch]);

  /**
   * SELECT: add to query params, trigger search with this filter
   */
  const handleSelectOption = useCallback(
    (param: UrlParamKey, option: SidebarOption) => {
      onFilterChange({
        param,
        value: String(option.value),
        replace: false // appends the value, for arrays like ?q=456&q=789
      });
    },
    [onFilterChange]
  );

  /**
   * DESELECT: remove from query params, trigger search without this filter
   */
  const handleDeselectOption = useCallback(
    (param: UrlParamKey, value: string | number) => {
      onFilterChange({
        param,
        value: String(value),
        replace: undefined
      });
    },
    [onFilterChange]
  );

  return (
    <>
      <SidebarHeader title="Filters" />

      <SearchSidebarSection
        title="Feature Types"
        options={featureRows}
        recommendedOptions={recommended.feature_types}
        selectedValues={selectedFeatureTypes.map(String)}
        omitListedRecommendedIds={omitListedRecommended.feature_types}
        searchPlaceholder="Search features..."
        checkbox
        onSearch={handleFeatureSearch}
        onSelectOption={(opt) => handleSelectOption(URL_PARAMS.FEATURE_TYPE, opt)}
        onDeselectOption={(opt) => handleDeselectOption(URL_PARAMS.FEATURE_TYPE, opt.value)}
        onRemoveRecommendedOption={(id) => onOmitListRecommended('feature_types', id)}
      />

      <SearchSidebarSection
        title="Species"
        options={speciesOptions}
        recommendedOptions={recommended.species}
        selectedValues={selectedSpecies}
        omitListedRecommendedIds={omitListedRecommended.species}
        searchPlaceholder="Search species..."
        checkbox
        onSearch={handleSpeciesSearch}
        onSelectOption={(opt) => handleSelectOption(URL_PARAMS.SPECIES, opt)}
        onDeselectOption={(opt) => handleDeselectOption(URL_PARAMS.SPECIES, opt.value)}
        onRemoveRecommendedOption={(id) => onOmitListRecommended('species', id)}
      />

      <SearchSidebarSection
        title="Properties"
        options={propertyRows}
        recommendedOptions={recommended.properties}
        selectedValues={selectedProperties.map(String)}
        omitListedRecommendedIds={omitListedRecommended.properties}
        searchPlaceholder="Search properties..."
        checkbox
        onSearch={(query) => handlePropertySearch({ keyword: query, feature_types: selectedFeatureTypes })}
        onSelectOption={(opt) => handleSelectOption(String(opt.value) as UrlParamKey, opt)}
        onDeselectOption={(opt) => handleDeselectOption(String(opt.value) as UrlParamKey, opt.value)}
        onRemoveRecommendedOption={(id) => onOmitListRecommended('properties', id)}
      />
    </>
  );
};
