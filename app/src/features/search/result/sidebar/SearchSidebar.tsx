import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { TypedURLSearchParams } from 'hooks/useSearchQuery';
import { useCallback, useMemo } from 'react';
import { SidebarHeader } from './header/SearchSidebarHeader';
import { useFeatureSearch } from './hooks/useFeatureSearch';
import { usePropertySearch } from './hooks/usePropertySearch';
import { OmitListedRecommendedState, RecommendedFiltersState } from './hooks/useRecommendedFilters';
import { useSpeciesSearch } from './hooks/useSpeciesSearch';
import { SidebarOption } from './section/option/SearchSidebarOption';
import { SearchSidebarSection } from './section/SearchSidebarSection';

interface SearchSidebarProps {
  recommended: RecommendedFiltersState;
  featureOptions: SidebarOption[];
  queryParams: TypedURLSearchParams<Record<string, string>>;
  omitListedRecommended: OmitListedRecommendedState;
  onFilterChange: (update: { param: UrlParamKey; value: string; replace?: boolean }) => void;
  onOmitListRecommended: (type: keyof OmitListedRecommendedState, id: string | number) => void;
}

export const SearchSidebar = ({
  recommended,
  featureOptions,
  queryParams,
  omitListedRecommended,
  onFilterChange,
  onOmitListRecommended
}: SearchSidebarProps) => {
  /**
   * Search handlers for finding filter options, independent of the main search results.
   * Main search results are only updated when an option is selected.
   */
  const { rows: speciesOptions, handleSearch: handleSpeciesSearch } = useSpeciesSearch();
  const { rows: featureRows, handleSearch: handleFeatureSearch } = useFeatureSearch(featureOptions);
  const { rows: propertyRows, handleSearch: handlePropertySearch } = usePropertySearch();

  const selectedFeatures = useMemo(() => queryParams.getAll(URL_PARAMS.FEATURE_TYPE), [queryParams]);
  const selectedSpecies = useMemo(() => queryParams.getAll(URL_PARAMS.SPECIES), [queryParams]);
  const selectedProperties = useMemo(
    () => Array.from(queryParams.keys()).filter((key) => key !== URL_PARAMS.FEATURE_TYPE && key !== URL_PARAMS.SPECIES),
    [queryParams]
  );

  const selectedFeatureType = useMemo(() => queryParams.get(URL_PARAMS.FEATURE_TYPE) || '', [queryParams]);

  // SELECT: add to query params, trigger search with this filter
  const handleSelectOption = useCallback(
    (param: UrlParamKey, option: SidebarOption) => {
      onFilterChange({
        param,
        value: String(option.value),
        replace: false // multi-select: append
      });
    },
    [onFilterChange]
  );

  // DESELECT: remove from query params, trigger search without this filter
  const handleDeselectOption = useCallback(
    (param: UrlParamKey, value: string | number) => {
      onFilterChange({
        param,
        value: String(value),
        replace: undefined // signal removal
      });
    },
    [onFilterChange]
  );

  return (
    <>
      <SidebarHeader title="Filters" />

      <SearchSidebarSection
        title="Features"
        options={featureRows}
        recommendedOptions={recommended.feature_types}
        selectedValues={selectedFeatures.map(String)}
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
        onSearch={(query) => handlePropertySearch({ keyword: query, feature_types: [selectedFeatureType] })}
        onSelectOption={(opt) => handleSelectOption(String(opt.value) as UrlParamKey, opt)}
        onDeselectOption={(opt) => handleDeselectOption(String(opt.value) as UrlParamKey, opt.value)}
        onRemoveRecommendedOption={(id) => onOmitListRecommended('properties', id)}
      />
    </>
  );
};
