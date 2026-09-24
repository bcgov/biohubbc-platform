import { ICustomAutocompleteOption } from 'components/fields/CustomAutocomplete';
import useDebounce from 'hooks/useDebounce';
import { useEffect, useState } from 'react';
import {
  CompositionOptionsFetcher,
  ICompositionAutocompleteResponse,
  ICompositionOptions
} from '../dialog/CompositionOptions.interface';

/**
 * Manage top-ten option searches for a dialog, preserving selected labels.
 *
 * @param fetchOptions Feature-owned option loader.
 * @param enabled Whether the selector is currently available.
 * @param scopeId Parent assignment identity; changing it resets search.
 * @returns Prepared options and callbacks for a presentation-only field.
 */
export const useCompositionOptions = (
  fetchOptions: CompositionOptionsFetcher,
  enabled: boolean,
  scopeId = 0
): ICompositionOptions => {
  const [query, setQuery] = useState({ scopeId, keyword: '' });
  const [optionsResponse, setOptionsResponse] = useState<ICompositionAutocompleteResponse>();
  const [selectedOption, setSelectedOption] = useState<ICustomAutocompleteOption<number> | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
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

  useEffect(() => {
    let active = true;

    /**
     * Fetch the first ten matches and discard responses superseded by another query.
     */
    const loadOptions = async () => {
      setOptionsResponse(undefined);
      setError('');
      setLoading(enabled);
      if (!enabled) {
        return;
      }
      try {
        const nextOptions = await fetchOptions(keyword, { page: 1, limit: 10, sort: 'name', order: 'asc' });
        if (active) {
          setOptionsResponse(nextOptions);
        }
      } catch (error) {
        if (active) {
          setError((error as Error).message);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadOptions();
    return () => {
      active = false;
    };
  }, [fetchOptions, enabled, keyword, scopeId]);

  const matchingOptions = (optionsResponse?.options ?? []).map((option) => ({
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
    loading,
    error,
    onSearch: handleSearch,
    onSelect: setSelectedOption
  };
};
