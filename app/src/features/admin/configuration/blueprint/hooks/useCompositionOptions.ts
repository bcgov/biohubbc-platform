import { hashKey, QueryKey, useQuery } from '@tanstack/react-query';
import { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import useDebounce from 'hooks/useDebounce';
import { useEffect, useState } from 'react';
import { CompositionOptionsFetcher, ICompositionOptions } from '../dialog/CompositionOptions.interface';

/**
 * Manage top-ten option searches for a dialog, preserving selected labels.
 *
 * @param fetchOptions Feature-owned option loader.
 * @param enabled Whether the selector is currently available.
 * @param queryKey Domain and owning blueprint or assignment; changing it resets search.
 * @returns Prepared options and callbacks for a presentation-only field.
 */
export const useCompositionOptions = (
  fetchOptions: CompositionOptionsFetcher,
  enabled: boolean,
  queryKey: QueryKey
): ICompositionOptions => {
  const scopeId = hashKey(queryKey);
  const [query, setQuery] = useState({ scopeId, keyword: '' });
  const [selectedOption, setSelectedOption] = useState<ICustomAutocompleteOption<number> | null>(null);
  // A new parent must never be requested with the previous parent's keyword.
  const keyword = query.scopeId === scopeId ? query.keyword : '';

  const handleSearch = useDebounce((value: string) => {
    setQuery({ scopeId, keyword: value });
  }, 300);

  useEffect(() => () => handleSearch.cancel(), [handleSearch, scopeId, enabled]);

  useEffect(() => {
    setSelectedOption(null);
    setQuery({ scopeId, keyword: '' });
  }, [scopeId, enabled]);

  const optionsQuery = useQuery({
    queryKey: [...queryKey, keyword],
    queryFn: () => fetchOptions(keyword, { page: 1, limit: 10, sort: 'name', order: 'asc' }),
    enabled,
    staleTime: 0
  });

  const availableOptions = enabled ? (optionsQuery.data?.options ?? []) : [];
  const matchingOptions = availableOptions.map((option) => ({
    value: option.id,
    label: option.name
  }));
  const options =
    selectedOption && !matchingOptions.some((option) => option.value === selectedOption.value)
      ? [...matchingOptions, selectedOption]
      : matchingOptions;

  return {
    options,
    matchingOptions,
    loading: optionsQuery.isFetching,
    error: optionsQuery.error?.message ?? '',
    onSearch: handleSearch,
    onSelect: setSelectedOption
  };
};
