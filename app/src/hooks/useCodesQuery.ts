import { useQuery } from '@tanstack/react-query';
import { codeQueryKeys } from 'utils/query-keys/code-query-keys';
import { useApi } from './useApi';

/**
 * Loads every code set, once per session: codes are reference data that change only with a deployment.
 *
 * @returns The code sets query.
 */
export const useCodesQuery = () => {
  const api = useApi();

  return useQuery({
    queryKey: codeQueryKeys.all(),
    queryFn: ({ signal }) => api.codes.getAllCodeSets({ signal }),
    staleTime: Infinity
  });
};
