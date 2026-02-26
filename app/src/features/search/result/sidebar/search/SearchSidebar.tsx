import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { TypedURLSearchParams } from 'hooks/useSearchQuery';
import { useMemo } from 'react';
import { SidebarOption } from './components/section/option/SearchSidebarOption';
import { SearchSidebarFeatureTypes } from './feature-type/SearchSidebarFeatureType';
import { OmitListedRecommendedState, RecommendedFiltersState } from './hooks/useRecommendedFilters';
import { SearchSidebarProperties } from './property/SearchSidebarProperty';
import { SearchSidebarSpecies } from './species/SearchSidebarSpecies';

interface SearchSidebarProps {
  /**
   * Recommended filter options for all sections
   */
  recommended: RecommendedFiltersState;
  /**
   * Available feature type options
   */
  featureTypeOptions: SidebarOption[];
  /**
   * Current query parameters
   */
  queryParams: TypedURLSearchParams<Record<string, string>>;
  /**
   * Omitted recommended items per session
   */
  omitListedRecommended: OmitListedRecommendedState;
  /**
   * Callback for filter changes
   */
  onFilterChange: (update: { param: UrlParamKey; value: string; replace?: boolean }) => void;
  /**
   * Callback for omitting recommended items
   */
  onOmitListRecommended: (type: keyof OmitListedRecommendedState, id: string | number) => void;
}

/**
 * Renders sidebar for applying filters to the search
 * Manages feature types, species, and properties filter sections
 * @param {SearchSidebarProps} props
 * @returns {*}
 */
export const SearchSidebar = ({
  recommended,
  featureTypeOptions,
  queryParams,
  omitListedRecommended,
  onFilterChange,
  onOmitListRecommended
}: SearchSidebarProps) => {
  const selectedFeatureTypes = useMemo(() => queryParams.getAll(URL_PARAMS.FEATURE_TYPE).map(String), [queryParams]);

  const selectedSpecies = useMemo(() => queryParams.getAll(URL_PARAMS.SPECIES), [queryParams]);

  return (
    <>
      <SearchSidebarFeatureTypes
        recommended={recommended}
        featureTypeOptions={featureTypeOptions}
        selectedValues={selectedFeatureTypes}
        omitListedRecommendedIds={omitListedRecommended.feature_types}
        onFilterChange={onFilterChange}
        onOmitListRecommended={(id) => onOmitListRecommended('feature_types', id)}
      />

      <SearchSidebarSpecies
        recommended={recommended}
        selectedValues={selectedSpecies}
        omitListedRecommendedIds={omitListedRecommended.species}
        onFilterChange={onFilterChange}
        onOmitListRecommended={(id) => onOmitListRecommended('species', id)}
      />

      <SearchSidebarProperties
        recommended={recommended}
        queryParams={queryParams}
        omitListedRecommendedIds={omitListedRecommended.properties}
        onFilterChange={onFilterChange}
        onOmitListRecommended={(id) => onOmitListRecommended('properties', id)}
      />
    </>
  );
};
