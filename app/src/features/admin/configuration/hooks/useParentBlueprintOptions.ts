import { useApi } from 'hooks/useApi';
import useDebounce from 'hooks/useDebounce';
import { IBlueprintsResponse } from 'interfaces/useBlueprintsApi.interface';
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
  const [response, setResponse] = useState<IBlueprintsResponse>();
  const [selectedOption, setSelectedOption] = useState<IParentBlueprintOption | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchError, setSearchError] = useState('');

  const search = useDebounce((value: string) => {
    setKeyword(value);
  }, 300);

  useEffect(() => () => search.cancel(), [search, enabled]);

  useEffect(() => {
    setKeyword('');
    setSelectedOption(null);
  }, [enabled]);

  useEffect(() => {
    let active = true;

    /**
     * Load the first ten matching blueprints; ignore responses superseded by another search or unmount.
     */
    const loadBlueprints = async () => {
      setIsLoading(enabled);
      setSearchError('');
      setResponse(undefined);
      if (!enabled) {
        return;
      }
      try {
        const result = await api.blueprints.getBlueprints(
          { keyword },
          { page: 1, limit: 10, sort: 'name', order: 'asc' }
        );
        if (active) {
          setResponse(result);
        }
      } catch (error) {
        if (active) {
          setSearchError((error as Error).message);
        }
      } finally {
        if (active) {
          setIsLoading(false);
        }
      }
    };

    loadBlueprints();
    return () => {
      active = false;
    };
  }, [api.blueprints, enabled, keyword]);

  const searchOptions = (response?.blueprints ?? []).map((blueprint) => ({
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
    loading: isLoading,
    error: searchError,
    onSearch: search,
    onSelect: setSelectedOption
  };
};
