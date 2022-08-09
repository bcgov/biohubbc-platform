import { ConfigContext } from 'contexts/configContext';
import { useContext } from 'react';
import useAdminApi from './api/useAdminApi';
import useAxios from './api/useAxios';
import useDatasetApi from './api/useDatasetApi';
import useN8NApi from './api/useN8NApi';
import useSearchApi, { usePublicSearchApi } from './api/useSearchApi';
import useSubmissionsApi from './api/useSubmissionsApi';
import useTaxonomyApi from './api/useTaxonomyApi';
import useUserApi from './api/useUserApi';

/**
 * Returns a set of supported api methods.
 *
 * @return {*} object whose properties are supported api methods.
 */
export const useApi = () => {
  const config = useContext(ConfigContext);
  const apiAxios = useAxios(config?.API_HOST);
  const n8nAxios = useAxios(config?.N8N_HOST);

  const user = useUserApi(apiAxios);

  const admin = useAdminApi(apiAxios);

  const n8n = useN8NApi(n8nAxios);

  const submissions = useSubmissionsApi(apiAxios);

  const taxonomy = useTaxonomyApi(apiAxios);

  const publicApis = {
    search: usePublicSearchApi(apiAxios)
  };

  const search = useSearchApi(apiAxios);

  const dataset = useDatasetApi(apiAxios);

  return {
    user,
    admin,
    n8n,
    submissions,
    public: publicApis,
    search,
    dataset,
    taxonomy
  };
};
