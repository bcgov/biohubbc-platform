import { ConfigContext } from 'contexts/configContext';
import { useContext } from 'react';
import useAdminApi from './api/useAdminApi';
import useAxios from './api/useAxios';
import useDatasetApi from './api/useDatasetApi';
import useSearchApi, { usePublicSearchApi } from './api/useSearchApi';
import useSecurityApi from './api/useSecurityApi';
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

  const user = useUserApi(apiAxios);

  const admin = useAdminApi(apiAxios);

  const security = useSecurityApi(apiAxios);

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
    submissions,
    public: publicApis,
    search,
    dataset,
    taxonomy,
    security
  };
};
