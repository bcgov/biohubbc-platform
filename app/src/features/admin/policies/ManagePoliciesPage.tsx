import Box from '@mui/material/Box';
import { debounce } from 'lodash-es';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useCallback, useMemo, useState } from 'react';
import { ActivePoliciesList } from './components/ActivePoliciesList';

/**
 * Admin page for managing policies.
 *
 * Displays a searchable list of policies with create, edit, and delete functionality.
 * Search is debounced (300ms) to reduce API calls while typing.
 *
 * @returns {React.ReactElement} The policy management page
 */
export const ManagePoliciesPage: React.FC<React.PropsWithChildren> = () => {
  const biohubApi = useApi();
  /** Current search input value (updates immediately on keystroke) */
  const [searchTerm, setSearchTerm] = useState('');
  /** Debounced search term used for API queries */
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  /** Data loader for fetching policies with optional search filter */
  const policiesDataLoader = useDataLoader((search?: string) =>
    biohubApi.policies.getPolicies({ search: search || undefined })
  );
  policiesDataLoader.load(debouncedSearchTerm);

  /**
   * Debounced function to update search term and refresh policies.
   * Waits 300ms after last keystroke before triggering API call.
   */
  const debouncedRefresh = useMemo(
    () =>
      debounce((term: string) => {
        setDebouncedSearchTerm(term);
        policiesDataLoader.refresh(term);
      }, 300),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /**
   * Handle search input changes.
   * Updates local state immediately and triggers debounced API refresh.
   *
   * @param {string} term - The new search term
   */
  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);
      debouncedRefresh(term);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  return (
    <Box py={7}>
      <ActivePoliciesList
        policies={policiesDataLoader.data?.policies || []}
        refresh={() => policiesDataLoader.refresh(debouncedSearchTerm)}
        searchTerm={searchTerm}
        onSearch={handleSearch}
      />
    </Box>
  );
};
