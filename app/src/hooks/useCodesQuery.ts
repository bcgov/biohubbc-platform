import { useQuery } from '@tanstack/react-query';
import { codeQueryKeys } from 'utils/query-keys/code-query-keys';
import { useApi } from './useApi';

/**
 * Loads every code set for the session. Configuration mutations invalidate this lookup when definitions or the default blueprint change.
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
