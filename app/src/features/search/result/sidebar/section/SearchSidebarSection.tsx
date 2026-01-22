import { Typography } from '@mui/material';
import { Box } from '@mui/system';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { SearchAutocomplete } from './autocomplete/SearchAutocomplete';
import { SearchSidebarOption, SidebarOption } from './option/SearchSidebarOption';

/**
 * Filter section configuration and state
 *
 * OPERATIONS:
 * 1. SELECT - adds option to query params, triggers search with that filter
 * 2. DESELECT - removes option from query params, triggers search without that filter, option stays in cache
 * 3. REMOVE - removes option from recommended list permanently (omitListed), deselects if selected,
 *    triggers search without that filter
 */
export interface FilterSectionProps {
  title: string;
  options: SidebarOption[]; // searchable options (from search/API)
  recommendedOptions: SidebarOption[]; // recommended options, based on the query params
  selectedValues: Array<string | number>; // applied options, based on the query params
  omitListedRecommendedIds: Set<string | number>; // recommended options that have been dismissed by the user
  searchPlaceholder?: string;
  checkbox?: boolean;
  onSearch?: (query: string) => void;
  onSelectOption: (option: SidebarOption) => void;
  onDeselectOption: (option: SidebarOption) => void;
  onRemoveRecommendedOption: (id: string | number) => void;
}

interface MergedOption {
  option: SidebarOption;
  isRecommended: boolean;
  isSelected: boolean;
  source: 'search' | 'recommended';
}

export const SearchSidebarSection = ({
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
}: FilterSectionProps) => {
  // Cache for displaying search results (populated via search API)
  const [searchResultsCache, setSearchResultsCache] = useState<Map<string | number, SidebarOption>>(new Map());

  /**
   * Normalize value to lowercase for case-insensitive comparisons
   */
  const normalizeValue = useCallback((value: string | number | undefined): string | number => {
    if (value === undefined || value === null) {
      return '';
    }
    return String(value).toLowerCase();
  }, []);

  /**
   * Sync cache with selectedValues from URL params
   * Ensures all selected values are cached so they display as selected checkboxes
   */
  useEffect(() => {
    setSearchResultsCache((prev) => {
      const next = new Map(prev);
      const normalizedSelectedSet = new Set(selectedValues.map((val) => normalizeValue(val)));

      // Add selected values to cache if not already there
      selectedValues.forEach((value) => {
        const normalized = normalizeValue(value);

        // Check if already in cache (by normalized value)
        const alreadyCached = Array.from(next.values()).some((opt) => normalizeValue(opt.value) === normalized);

        if (!alreadyCached) {
          // Create a minimal placeholder option for selected values not yet loaded
          next.set(value, {
            value,
            label: String(value)
          } as SidebarOption);
        }
      });

      // Remove unselected values from cache
      for (const [key, option] of next.entries()) {
        const normalized = normalizeValue(option.value);
        if (!normalizedSelectedSet.has(normalized)) {
          next.delete(key);
        }
      }

      return next;
    });
  }, [selectedValues, normalizeValue]);

  const handleCheckboxChange = useCallback(
    (option: SidebarOption, willBeSelected: boolean) => {
      if (willBeSelected) {
        setSearchResultsCache((prev) => new Map(prev).set(option.value, option));
        onSelectOption(option);
      } else {
        onDeselectOption(option);
      }
    },
    [onSelectOption, onDeselectOption]
  );

  // Normalize selected values for comparison
  const normalizedSelectedValues = useMemo(
    () => selectedValues.map((val) => normalizeValue(val)),
    [selectedValues, normalizeValue]
  );

  // Active recommended options (not omitListed)
  const activeRecommended = useMemo(
    () => recommendedOptions.filter((opt) => !omitListedRecommendedIds.has(normalizeValue(opt.value))),
    [recommendedOptions, omitListedRecommendedIds, normalizeValue]
  );

  // Search results from cache
  const searchResults = useMemo(() => Array.from(searchResultsCache.values()), [searchResultsCache]);

  // Merge all options into a single array, sorted by name
  const mergedOptions = useMemo(() => {
    const merged: MergedOption[] = [];
    const seenIds = new Set<string | number>();

    // Add search results
    searchResults.forEach((option) => {
      const normalizedValue = normalizeValue(option.value);
      merged.push({
        option,
        isRecommended: false,
        isSelected: normalizedSelectedValues.includes(normalizedValue),
        source: 'search'
      });
      seenIds.add(normalizedValue);
    });

    // Add recommended options
    activeRecommended.forEach((option) => {
      const normalizedValue = normalizeValue(option.value);
      if (!seenIds.has(normalizedValue)) {
        merged.push({
          option,
          isRecommended: true,
          isSelected: normalizedSelectedValues.includes(normalizedValue),
          source: 'recommended'
        });
        seenIds.add(normalizedValue);
      }
    });

    // Sort by option label/name
    merged.sort((a, b) => {
      const aLabel = String(a.option.label || a.option.value).toLowerCase();
      const bLabel = String(b.option.label || b.option.value).toLowerCase();
      return aLabel.localeCompare(bLabel);
    });

    return merged;
  }, [searchResults, activeRecommended, normalizedSelectedValues, normalizeValue]);

  /**
   * Handle remove action: clears from URL params and omits from recommended list
   * @param {SidebarOption} option - The option being removed
   * @param {boolean} isSelected - Whether the option is currently selected
   */
  const handleRemoveOption = useCallback(
    (option: SidebarOption, isSelected: boolean) => {
      const normalizedValue = normalizeValue(option.value);

      // Remove from search cache
      setSearchResultsCache((prev) => {
        const next = new Map(prev);
        next.delete(option.value);
        return next;
      });

      // Deselect if currently selected (removes from URL params)
      if (isSelected) {
        onDeselectOption(option);
      }

      // Always omit from recommended list, regardless of source
      onRemoveRecommendedOption(normalizedValue);
    },
    [normalizeValue, onDeselectOption, onRemoveRecommendedOption]
  );

  return (
    <Box sx={{ mb: 2, display: 'flex', flexDirection: 'column' }}>
      {title && (
        <Typography
          sx={{
            fontSize: 12,
            fontWeight: 600,
            color: '#697386',
            textTransform: 'uppercase',
            mb: 1
          }}>
          {title}
        </Typography>
      )}

      <Box sx={{ mb: 1 }}>
        <SearchAutocomplete
          options={options}
          placeholder={searchPlaceholder}
          value={null}
          onInputChange={onSearch}
          onChange={(option) => option && handleCheckboxChange(option, true)}
        />
      </Box>

      <Box sx={{ maxHeight: '250px', overflowY: 'auto' }}>
        {/* Render merged options sorted by name */}
        {mergedOptions.map(({ option, isRecommended, isSelected }) => {
          const normalizedValue = normalizeValue(option.value);

          return (
            <SearchSidebarOption
              key={normalizedValue}
              option={option}
              recommended={isRecommended}
              checkbox={checkbox}
              selected={isSelected}
              onCheckboxChange={() => handleCheckboxChange(option, !isSelected)}
              onClick={() => handleCheckboxChange(option, !isSelected)}
              onRemove={() => handleRemoveOption(option, isSelected)}
            />
          );
        })}
      </Box>
    </Box>
  );
};
