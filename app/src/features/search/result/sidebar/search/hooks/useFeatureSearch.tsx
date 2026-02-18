import { useDialogContext } from 'hooks/useContext';
import useDataLoader from 'hooks/useDataLoader';
import { debounce } from 'lodash-es';
import { useCallback, useEffect, useRef } from 'react';
import { SidebarOption } from '../components/section/option/SearchSidebarOption';

/**
 * Hook for searching features locally with debounced filtering.
 * Returns rows, loading state, and a search handler.
 */
export const useFeatureSearch = (initialOptions: SidebarOption[] = [], debounceMs = 300) => {
  const dialogContext = useDialogContext();

  // Data loader for local filtering
  const loader = useDataLoader(
    async (query: string): Promise<SidebarOption[]> => {
      if (!query) {
        return initialOptions;
      }
      // Local filtering (case-insensitive)
      return initialOptions.filter((option) => option.label.toLowerCase().includes(query.toLowerCase()));
    },
    // onError: display snackbar
    (error) => {
      dialogContext.setSnackbar({
        open: true,
        snackbarMessage: (error as Error).message
      });
    }
  );

  // --- Debounced refresh ---
  const debouncedRefreshRef = useRef(
    debounce((query: string) => {
      loader.refresh(query);
    }, debounceMs)
  ).current;

  const handleSearch = useCallback(
    (query: string) => {
      debouncedRefreshRef(query);
    },
    [debouncedRefreshRef]
  );

  // Cleanup debounce on unmount
  useEffect(() => () => debouncedRefreshRef.cancel(), [debouncedRefreshRef]);

  return {
    rows: loader.data ?? initialOptions,
    isLoading: loader.isLoading,
    handleSearch
  };
};
