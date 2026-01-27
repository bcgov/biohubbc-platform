import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useCallback } from 'react';
import { SidebarOption } from '../components/section/option/SearchSidebarOption';
import { SearchSidebarSection } from '../components/section/SearchSidebarSection';
import { useFeatureSearch } from '../hooks/useFeatureSearch';
import { RecommendedFiltersState } from '../hooks/useRecommendedFilters';

interface SearchSidebarFeatureTypesProps {
  recommended: RecommendedFiltersState;
  featureTypeOptions: SidebarOption[];
  selectedValues: string[];
  omitListedRecommendedIds: Set<string | number>;
  onFilterChange: (update: { param: UrlParamKey; value: string; replace?: boolean }) => void;
  onOmitListRecommended: (id: string | number) => void;
}

/**
 * Renders the Feature Types filter section in the search sidebar
 * @param {SearchSidebarFeatureTypesProps} props
 * @returns {*}
 */
export const SearchSidebarFeatureTypes = ({
  recommended,
  featureTypeOptions,
  selectedValues,
  omitListedRecommendedIds,
  onFilterChange,
  onOmitListRecommended
}: SearchSidebarFeatureTypesProps) => {
  const { rows: featureRows, handleSearch: handleFeatureSearch } = useFeatureSearch(featureTypeOptions);

  /**
   * SELECT: add to query params, trigger search with this filter
   */
  const handleSelectOption = useCallback(
    (option: SidebarOption) => {
      onFilterChange({
        param: URL_PARAMS.FEATURE_TYPE,
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
        param: URL_PARAMS.FEATURE_TYPE,
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

  return (
    <SearchSidebarSection
      title="Feature Types"
      options={featureRows}
      recommendedOptions={recommended.feature_types}
      selectedValues={selectedValues}
      omitListedRecommendedIds={omitListedRecommendedIds}
      searchPlaceholder="Search features..."
      checkbox
      onSearch={handleFeatureSearch}
      onSelectOption={handleSelectOption}
      onDeselectOption={handleDeselectOption}
      onRemoveRecommendedOption={handleRemoveRecommendedOption}
    />
  );
};
