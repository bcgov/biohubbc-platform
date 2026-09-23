import { useApi } from 'hooks/useApi';
import useDebounce from 'hooks/useDebounce';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { IParentBlueprintOption, IParentBlueprintOptions } from '../dialog/ParentBlueprintOptions.interface';

/**
 * Search the first ten parent blueprints while the creation dialog is open.
 * Keep a selected parent's label available outside the current results.
 *
 * @param enabled Whether a new blueprint is being configured.
 * @returns Prepared parent options and selection callbacks.
 */
export const useParentBlueprintOptions = (enabled: boolean): IParentBlueprintOptions => {
  const api = useApi();
  const [keyword, setKeyword] = useState('');
  const [selectedOption, setSelectedOption] = useState<IParentBlueprintOption | null>(null);

  const search = useDebounce((value: string) => {
    setKeyword(value);
  }, 300);

  useEffect(() => () => search.cancel(), [search, enabled]);

  useEffect(() => {
    setKeyword('');
    setSelectedOption(null);
  }, [enabled]);

  const query = useQuery({
    queryKey: ['configuration', 'blueprints', keyword, { page: 1, limit: 10, sort: 'name', order: 'asc' }],
    queryFn: () => api.blueprints.getBlueprints({ keyword }, { page: 1, limit: 10, sort: 'name', order: 'asc' }),
    enabled
  });

  const searchOptions = (query.data?.blueprints ?? []).map((blueprint) => ({
    value: blueprint.blueprint_id,
    label: blueprint.name,
    description: `Version ${blueprint.version_number}`
  }));
  const options =
    selectedOption && !searchOptions.some((option) => option.value === selectedOption.value)
      ? [...searchOptions, selectedOption]
      : searchOptions;

  return {
    options,
    searchOptions,
    loading: query.isFetching,
    error: query.error?.message ?? '',
    onSearch: search,
    onSelect: setSelectedOption
  };
};
