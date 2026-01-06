import { useConfigContext } from 'hooks/useContext';
import useAdminApi from './api/useAdminApi';
import useArtifactApi from './api/useArtifactApi';
import useAxios from './api/useAxios';
import useCodesApi from './api/useCodesApi';
import { useFeaturesApi } from './api/useFeaturesApi';
import usePoliciesApi from './api/usePoliciesApi';
import { useSearchApi } from './api/useSearchApi';
import useSecurityApi from './api/useSecurityApi';
import useSubmissionsApi from './api/useSubmissionsApi';
import useTaxonomyApi from './api/useTaxonomyApi';
import { useTeamPoliciesApi } from './api/useTeamPoliciesApi';
import { useTeamsApi } from './api/useTeamsApi';
import useUserApi from './api/useUserApi';

/**
 * Returns a set of supported api methods.
 *
 * @return {*} object whose properties are supported api methods.
 */
export const useApi = () => {
  const config = useConfigContext();

  const apiAxios = useAxios(config?.API_HOST);

  const user = useUserApi(apiAxios);

  const admin = useAdminApi(apiAxios);

  const submissions = useSubmissionsApi(apiAxios);

  const features = useFeaturesApi(apiAxios);

  const taxonomy = useTaxonomyApi(apiAxios);

  const artifact = useArtifactApi(apiAxios);

  const security = useSecurityApi(apiAxios);

  const codes = useCodesApi(apiAxios);

  const policies = usePoliciesApi(apiAxios);

  const search = useSearchApi(apiAxios);

  const teams = useTeamsApi(apiAxios);

  const teamPolicies = useTeamPoliciesApi(apiAxios);

  return {
    user,
    admin,
    submissions,
    features,
    taxonomy,
    security,
    artifact,
    codes,
    policies,
    search,
    teams,
    teamPolicies
  };
};
