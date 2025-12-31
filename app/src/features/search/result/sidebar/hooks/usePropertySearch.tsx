import { APIError } from 'hooks/api/useAxios';
import { useApi } from 'hooks/useApi';
import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import {
  ISearchPropertyFilters,
  SearchPropertyResponse,
  SearchPropertyResult
} from 'interfaces/useSearchApi.interface';
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useRef } from 'react';
import { SidebarOption } from '../section/option/SearchSidebarOption';

/**
 * Hook for searching properties with debounced API requests.
 * Returns rows, loading state, and a search handler.
 */
export const usePropertySearch = (debounceMs = 300) => {
  const api = useApi();
  const dialogContext = useDialogContext();

  // Data loader for property search
  const loader = useDataLoader(
    async (filter: ISearchPropertyFilters): Promise<SidebarOption[]> => {
      const data: SearchPropertyResponse = await api.search.searchProperties(filter, {
        page: 1,
        limit: 10
      });

      // Flatten grouped results into SidebarOption[]
      const grouped = data.properties;
      const allResults: SearchPropertyResult[] = [
        ...(grouped.string ?? []),
        ...(grouped.number ?? []),
        ...(grouped.datetime ?? []),
        ...(grouped.spatial ?? [])
      ];

      return allResults.map((p) => ({
        label: p.property_name,
        value: p.feature_property_id
      }));
    },
    // onError: show snackbar
    (error: unknown) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (error as APIError).message
      });
    }
  );

  // --- Debounced refresh ---
  const debouncedRefreshRef = useRef(
    debounce((filter: ISearchPropertyFilters) => loader.refresh(filter), debounceMs)
  ).current;

  const handleSearch = useCallback(
    (filter: ISearchPropertyFilters) => {
      debouncedRefreshRef(filter);
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
