import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useRef } from 'react';

export interface ISpeciesSearchOption {
  label: string;
  value: number; // TSN is a number
}

/**
 * Hook for searching species with debounced API requests.
 * Returns rows, loading state, and a search handler.
 */
export const useSpeciesSearch = (debounceMs = 300) => {
  const api = useApi();
  const dialogContext = useDialogContext();

  // Data loader for species search
  const loader = useDataLoader(
    async (query: string): Promise<ISpeciesSearchOption[]> => {
      if (!query) {
        return [];
      }

      const data = await api.taxonomy.searchSpecies(query);

      return (
        data.searchResponse?.map((item) => ({
          label: item.scientificName,
          value: item.tsn
        })) ?? []
      );
    },
    (error: unknown) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (error as APIError).message
      });
    }
  );

  // Debounced refresh
  const debouncedRefreshRef = useRef(debounce((query: string) => loader.refresh(query), debounceMs)).current;

  const handleSearch = useCallback(
    (query: string) => {
      debouncedRefreshRef(query);
    },
    [debouncedRefreshRef]
  );

  // Cleanup debounce on unmount
  useEffect(() => () => debouncedRefreshRef.cancel(), [debouncedRefreshRef]);

  return {
    rows: loader.data ?? [],
    isLoading: loader.isLoading,
    handleSearch
  };
};
