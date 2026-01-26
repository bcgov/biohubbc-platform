import { URL_PARAMS, UrlParamKey } from 'constants/query-params';
import { useApi } from 'hooks/useApi';
import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchSidebarSection } from '../components/section/SearchSidebarSection';
import { SidebarOption } from '../components/section/option/SearchSidebarOption';
import { RecommendedFiltersState } from '../hooks/useRecommendedFilters';
import { ISpeciesSearchOption, useSpeciesSearch } from '../hooks/useSpeciesSearch';

interface SearchSidebarSpeciesProps {
  recommended: RecommendedFiltersState;
  selectedValues: string[]; // URL params are strings
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
  const api = useApi();
  const { rows: speciesOptions, handleSearch: handleSpeciesSearch } = useSpeciesSearch();

  // Cache for missing species fetched from the API
  const [speciesCache, setSpeciesCache] = useState<ISpeciesSearchOption[]>([]);

  // Track which IDs we've already fetched
  const fetchedIdsRef = useRef<Set<string>>(new Set());

  // Determine which selectedValues are missing and haven't been fetched yet
  const missingSpeciesIds = useMemo(() => {
    const allOptions = new Set([
      ...speciesOptions.map((option) => String(option.value)),
      ...speciesCache.map((option) => String(option.value))
    ]);

    return selectedValues.filter((selected) => !allOptions.has(selected) && !fetchedIdsRef.current.has(selected));
  }, [selectedValues, speciesOptions, speciesCache]);

  // Fetch missing species once
  useEffect(() => {
    if (missingSpeciesIds.length === 0) {
      return;
    }

    const fetchMissingSpecies = async () => {
      // Mark these IDs as being fetched
      missingSpeciesIds.forEach((id) => fetchedIdsRef.current.add(id));

      try {
        const { searchResponse } = await api.taxonomy.getSpeciesFromIds(missingSpeciesIds.map(Number));

        const options: ISpeciesSearchOption[] = searchResponse.map((species) => ({
          label: species.scientificName,
          value: species.tsn
        }));

        setSpeciesCache((prev) => [...prev, ...options]);
      } catch (err) {
        console.error('Failed to fetch missing species', err);
        // Remove from fetched set on error so it can be retried
        missingSpeciesIds.forEach((id) => fetchedIdsRef.current.delete(id));
      }
    };

    fetchMissingSpecies();
  }, [missingSpeciesIds, api.taxonomy]);

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
    onOmitListRecommended(String(id));
  };

  // Combine live species options + cache and cast value to string
  const allSpeciesOptions = useMemo(
    () =>
      [...speciesOptions, ...speciesCache].map((option) => ({
        label: option.label,
        value: String(option.value)
      })),
    [speciesOptions, speciesCache]
  );

  return (
    <SearchSidebarSection
      title="Species"
      options={allSpeciesOptions}
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
