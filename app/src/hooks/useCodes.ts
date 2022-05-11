import { IGetAllCodeSetsResponse } from 'interfaces/useCodesApi.interface';
import { useApi } from './useApi';
import useDataLoader, { DataLoader } from './useDataLoader';

/**
 * Hook that fetches app code sets.
 *
 * @export
 * @return {*}  {DataLoader<IGetAllCodeSetsResponse>}
 */
export default function useCodes(): DataLoader<IGetAllCodeSetsResponse> {
  const api = useApi();

  return useDataLoader<IGetAllCodeSetsResponse>(api.codes.getAllCodeSets);
}
