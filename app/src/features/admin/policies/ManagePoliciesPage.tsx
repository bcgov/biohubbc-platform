import Box from '@mui/material/Box';
import { debounce } from 'lodash-es';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import { useCallback, useMemo, useState } from 'react';
import ActivePoliciesList from './components/ActivePoliciesList';

/**
 * Page to display policy management data/functionality.
 *
 * @return {*}
 */
const ManagePoliciesPage: React.FC<React.PropsWithChildren> = () => {
  const biohubApi = useApi();
  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState('');

  const policiesDataLoader = useDataLoader((search?: string) =>
    biohubApi.policies.getPolicies({ search: search || undefined })
  );
  policiesDataLoader.load(debouncedSearchTerm);

  const debouncedRefresh = useMemo(
    () =>
      debounce((term: string) => {
        setDebouncedSearchTerm(term);
        policiesDataLoader.refresh(term);
      }, 300),
    [policiesDataLoader]
  );

  const handleSearch = useCallback(
    (term: string) => {
      setSearchTerm(term);
      debouncedRefresh(term);
    },
    [debouncedRefresh]
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

export default ManagePoliciesPage;
