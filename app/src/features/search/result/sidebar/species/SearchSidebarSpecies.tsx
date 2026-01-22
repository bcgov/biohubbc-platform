import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { SearchSidebarSection } from '../components/section/SearchSidebarSection';
import { SidebarOption } from '../components/section/option/SearchSidebarOption';
import { RecommendedFiltersState } from '../hooks/useRecommendedFilters';
import { useSpeciesSearch } from '../hooks/useSpeciesSearch';

interface SearchSidebarSpeciesProps {
  recommended: RecommendedFiltersState;
  selectedValues: string[];
  omitListedRecommendedIds: Set<string | number>;
  onFilterChange: (update: { param: UrlParamKey; value: string; replace?: boolean }) => void;
  onOmitListRecommended: (id: string | number) => void;
}

export const SearchSidebarSpecies = ({
  recommended,
  selectedValues,
  omitListedRecommendedIds,
  onFilterChange,
  onOmitListRecommended
}: SearchSidebarSpeciesProps) => {
  const { rows: speciesOptions, handleSearch: handleSpeciesSearch } = useSpeciesSearch();

  const handleSelectOption = (option: SidebarOption) => {
    onFilterChange({
      param: URL_PARAMS.SPECIES,
      value: String(option.value),
      replace: false
    });
  };

  const handleDeselectOption = (option: SidebarOption) => {
    onFilterChange({
      param: URL_PARAMS.SPECIES,
      value: String(option.value)
    });
  };

  const handleRemoveRecommendedOption = (id: string | number) => {
    onOmitListRecommended(id);
  };

  return (
    <SearchSidebarSection
      title="Species"
      options={speciesOptions}
      recommendedOptions={recommended.species}
      selectedValues={selectedValues}
      omitListedRecommendedIds={omitListedRecommendedIds}
      searchPlaceholder="Search species..."
      checkbox
      onSearch={handleSpeciesSearch}
      onSelectOption={handleSelectOption}
      onDeselectOption={handleDeselectOption}
      onRemoveRecommendedOption={handleRemoveRecommendedOption}
    />
  );
};
