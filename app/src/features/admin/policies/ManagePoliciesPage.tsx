import Box from '@mui/material/Box';
import { useApi } from 'hooks/useApi';
import useDataLoader from 'hooks/useDataLoader';
import ActivePoliciesList from './components/ActivePoliciesList';

/**
 * Page to display policy management data/functionality.
 *
 * @return {*}
 */
const ManagePoliciesPage: React.FC<React.PropsWithChildren> = () => {
  const biohubApi = useApi();

  const policiesDataLoader = useDataLoader(() => biohubApi.policies.getPolicies());
  policiesDataLoader.load();

  return (
    <Box py={7}>
      <ActivePoliciesList policies={policiesDataLoader.data?.policies || []} refresh={policiesDataLoader.refresh} />
    </Box>
  );
};

export default ManagePoliciesPage;
