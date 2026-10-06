import { useQuery } from '@tanstack/react-query';
import { useApi } from 'hooks/useApi';
import { usePolicyContext } from 'hooks/useContext';

/**
 * Loads the route's policy detail, which every component on the policy page reads and writes through.
 *
 * @returns The policy detail query.
 */
export const usePolicyQuery = () => {
  const api = useApi();
  const { policyId, policyQueryKey } = usePolicyContext();

  return useQuery({
    queryKey: policyQueryKey,
    queryFn: ({ signal }) => api.policies.getPolicy(policyId, { signal })
  });
};
