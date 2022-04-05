import { ConfigContext } from 'contexts/configContext';
import { useContext } from 'react';
import useAdminApi from './api/useAdminApi';
import useAxios from './api/useAxios';
import useCodesApi from './api/useCodesApi';
import useN8NApi from './api/useN8NApi';
import { usePublicSearchApi } from './api/useSearchApi';
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

  const codes = useCodesApi(apiAxios);

  const user = useUserApi(apiAxios);

  const admin = useAdminApi(apiAxios);

  const n8n = useN8NApi(n8nAxios);

  const publicApis = {
    search: usePublicSearchApi(apiAxios)
  };

  return {
    codes,
    user,
    admin,
    n8n,
    public: publicApis
  };
};
