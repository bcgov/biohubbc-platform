import { Box, Typography } from '@mui/material';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { normalizeQueryParam } from 'utils/query-param';
import { SearchAutocomplete } from './autocomplete/SearchAutocomplete';
import { SearchSidebarOption, SidebarOption } from './option/SearchSidebarOption';

export interface FilterSectionProps {
  title: string;
  options: SidebarOption[]; // from search/API
  recommendedOptions: SidebarOption[]; // recommended based on query
  selectedValues: Array<string | number>; // from query params
  omitListedRecommendedIds: Set<string | number>; // IDs user dismissed
  searchPlaceholder?: string;
  checkbox?: boolean;
  onSearch?: (query: string) => void;
  onSelectOption: (option: SidebarOption) => void;
  onDeselectOption: (option: SidebarOption) => void;
  onRemoveRecommendedOption: (id: string | number) => void;
}

/**
 * Searchbar section:
 * - Caches options that have been interacted with
 * - Removing an option clears it from the cache and adds it to the omit list
 * - Clicking an option toggles it in the URL params, for search
 *
 * @param {FilterSectionProps} props
 * @returns {*}
 */
export const SearchSidebarSection = (props: FilterSectionProps) => {
  const {
    title,
    options,
    recommendedOptions,
    selectedValues,
    omitListedRecommendedIds,
    searchPlaceholder = 'Search...',
    checkbox = false,
    onSearch,
    onSelectOption,
    onDeselectOption,
    onRemoveRecommendedOption
  } = props;

  // Cache for main options (search results + selected values)
  const [cache, setCache] = useState<Map<string, SidebarOption>>(new Map());

  // Sync cache with selectedValues - update with proper labels from options if available
  useEffect(() => {
    setCache((prev) => {
      const next = new Map(prev);

      // Create a lookup map from options for fast access
      const optionsMap = new Map(options.map((opt) => [normalizeQueryParam(opt.value), opt]));

      selectedValues.forEach((val) => {
        const id = normalizeQueryParam(val);
        if (next.has(id)) {
          // Update existing cache entry with proper label if available
          const fullOption = optionsMap.get(id);
          if (fullOption) {
            next.set(id, fullOption);
          }
        } else {
          // Check if we have the full option data, otherwise use placeholder
          const fullOption = optionsMap.get(id);
          next.set(id, fullOption || { value: val, label: String(val) });
        }
      });
      return next;
    });
  }, [selectedValues, options]);

  // Handle checkbox changes
  const handleCheckboxChange = useCallback(
    (option: SidebarOption, willSelect: boolean) => {
      const id = normalizeQueryParam(option.value);

      if (willSelect) {
        // Add to cache
        setCache((prev) => new Map(prev).set(id, option));

        // Update selectedValues (query params)
        onSelectOption(option);

        // Transition from recommended → main
        onRemoveRecommendedOption(id);
      } else {
        // Only deselect, do NOT remove from cache
        onDeselectOption(option);
      }
    },
    [onSelectOption, onDeselectOption, onRemoveRecommendedOption]
  );

  // Handle remove action
  const handleRemove = useCallback(
    (option: SidebarOption, isSelected: boolean) => {
      const id = normalizeQueryParam(option.value);

      // Remove from cache
      setCache((prev) => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });

      if (isSelected) {
        onDeselectOption(option);
      }

      onRemoveRecommendedOption(id);
    },
    [onDeselectOption, onRemoveRecommendedOption]
  );

  // Compute active recommended options (exclude omitted)
  const activeRecommended = useMemo(
    () => recommendedOptions.filter((opt) => !omitListedRecommendedIds.has(normalizeQueryParam(opt.value))),
    [recommendedOptions, omitListedRecommendedIds]
  );

  // Merge cache + recommended, marking selected / recommended flags
  const mergedOptions = useMemo(() => {
    const selectedSet = new Set(selectedValues.map(normalizeQueryParam));
    const merged: Array<{ option: SidebarOption; isSelected: boolean; isRecommended: boolean }> = [];

    // Cache items first
    cache.forEach((option) => {
      const id = normalizeQueryParam(option.value);
      merged.push({ option, isSelected: selectedSet.has(id), isRecommended: false });
    });

    // Recommended items not in cache
    activeRecommended.forEach((option) => {
      const id = normalizeQueryParam(option.value);
      if (!cache.has(id)) {
        merged.push({ option, isSelected: selectedSet.has(id), isRecommended: true });
      }
    });

    // Sort by label
    merged.sort((a, b) => String(a.option.label).localeCompare(String(b.option.label)));
    return merged;
  }, [cache, activeRecommended, selectedValues]);

  // Handler for selecting an option in the autocomplete dropdown
  const handleAutocompleteSelect = useCallback(
    (option: SidebarOption | null) => {
      if (!option) {
        return;
      }

      const id = normalizeQueryParam(option.value);
      const isAlreadySelected = selectedValues.some((val) => normalizeQueryParam(val) === id);

      if (!isAlreadySelected) {
        // Only select if not already selected
        handleCheckboxChange(option, true);
      }
    },
    [selectedValues, handleCheckboxChange]
  );

  return (
    <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column' }}>
      {title && (
        <Typography sx={{ fontSize: 12, fontWeight: 600, color: '#697386', textTransform: 'uppercase', mb: 1 }}>
          {title}
        </Typography>
      )}

      <Box sx={{ mb: 1 }}>
        <SearchAutocomplete
          options={options}
          placeholder={searchPlaceholder}
          value={null}
          onInputChange={onSearch}
          onChange={(option) => option && handleAutocompleteSelect(option)}
        />
      </Box>

      <Box sx={{ maxHeight: '250px', overflowY: 'auto' }}>
        {mergedOptions.map(({ option, isSelected, isRecommended }) => {
          const id = normalizeQueryParam(option.value);
          return (
            <SearchSidebarOption
              key={id}
              option={option}
              checkbox={checkbox}
              selected={isSelected}
              recommended={isRecommended}
              onClick={() => handleCheckboxChange(option, !isSelected)}
              onCheckboxChange={() => handleCheckboxChange(option, !isSelected)}
              onRemove={() => handleRemove(option, isSelected)}
            />
          );
        })}
      </Box>
    </Box>
  );
};
