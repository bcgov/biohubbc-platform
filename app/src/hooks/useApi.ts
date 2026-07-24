import { useConfigContext } from 'hooks/useContext';
import useAdminApi from './api/useAdminApi';
import { useApiKeysApi } from './api/useApiKeysApi';
import useArtifactApi from './api/useArtifactApi';
import useAxios from './api/useAxios';
import { useDownloadApi } from './api/useDownloadApi';
import { useDownloadExportApi } from './api/useDownloadExportApi';
import useCodesApi from './api/useCodesApi';
import { useDataRequestApi } from './api/useDataRequestApi';
import { useFeaturesApi } from './api/useFeaturesApi';
import { useGalleryApi } from './api/useGalleryApi';
import { useObjectStorageApi } from './api/useObjectStorageApi';
import usePoliciesApi from './api/usePoliciesApi';
import { useSearchApi } from './api/useSearchApi';
import { useTileApi } from './api/useTileApi';
import useSecurityApi from './api/useSecurityApi';
import useSubmissionsApi from './api/useSubmissionsApi';
import { useSubmissionsStatusApi } from './api/useSubmissionStatusApi';
import useTaxonomyApi from './api/useTaxonomyApi';
import { useTeamPoliciesApi } from './api/useTeamPoliciesApi';
import { useTeamsApi } from './api/useTeamsApi';
import { useTicketsApi } from './api/useTicketsApi';
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

  const submissionStatus = useSubmissionsStatusApi(apiAxios);

  const features = useFeaturesApi(apiAxios);

  const taxonomy = useTaxonomyApi(apiAxios);

  const artifact = useArtifactApi(apiAxios);

  const security = useSecurityApi(apiAxios);

  const codes = useCodesApi(apiAxios);

  const policies = usePoliciesApi(apiAxios);

  const search = useSearchApi(apiAxios);

  const tile = useTileApi(apiAxios);

  const teams = useTeamsApi(apiAxios);

  const download = useDownloadApi(apiAxios);

  const downloadExport = useDownloadExportApi(apiAxios);

  const gallery = useGalleryApi(apiAxios);

  const teamPolicies = useTeamPoliciesApi(apiAxios);

  const tickets = useTicketsApi(apiAxios);

  const dataRequest = useDataRequestApi(apiAxios);

  const apiKeys = useApiKeysApi(apiAxios);

  const objectStorage = useObjectStorageApi();

  return {
    user,
    admin,
    submissions,
    submissionStatus,
    features,
    taxonomy,
    security,
    artifact,
    codes,
    policies,
    search,
    tile,
    teams,
    download,
    downloadExport,
    gallery,
    teamPolicies,
    tickets,
    dataRequest,
    apiKeys,
    objectStorage
  };
};
