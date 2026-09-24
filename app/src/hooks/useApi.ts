import { useConfigContext } from 'hooks/useContext';
import { useMemo } from 'react';
import useAdminApi from './api/useAdminApi';
import { useApiKeysApi } from './api/useApiKeysApi';
import useArtifactApi from './api/useArtifactApi';
import useAxios from './api/useAxios';
import useCodesApi from './api/useCodesApi';
import { useContributorsApi } from './api/useContributorsApi';
import { useDataRequestApi } from './api/useDataRequestApi';
import { useDownloadApi } from './api/useDownloadApi';
import { useDownloadExportApi } from './api/useDownloadExportApi';
import { useFeaturesApi } from './api/useFeaturesApi';
import { useGalleryApi } from './api/useGalleryApi';
import { useMartinApi } from './api/useMartinApi';
import { useObjectStorageApi } from './api/useObjectStorageApi';
import usePoliciesApi from './api/usePoliciesApi';
import { useSearchApi } from './api/useSearchApi';
import useSecurityApi from './api/useSecurityApi';
import { useSubmissionsStatusApi } from './api/useSubmissionStatusApi';
import useSubmissionsApi from './api/useSubmissionsApi';
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

  const contributors = useContributorsApi(apiAxios);

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

  const martin = useMartinApi(apiAxios);

  const teams = useTeamsApi(apiAxios);

  const download = useDownloadApi(apiAxios);

  const downloadExport = useDownloadExportApi(apiAxios);

  const gallery = useGalleryApi(apiAxios);

  const teamPolicies = useTeamPoliciesApi(apiAxios);

  const tickets = useTicketsApi(apiAxios);

  const dataRequest = useDataRequestApi(apiAxios);

  const apiKeys = useApiKeysApi(apiAxios);

  const objectStorage = useObjectStorageApi();

  const apis = {
    contributors,
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
    martin,
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

  // Every sub-api is a set of closures over `apiAxios` (or, for object storage, over nothing), so
  // the object only needs to change when the axios instance does. Returning a stable object keeps
  // `api` usable as an effect or callback dependency without re-triggering on every render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => apis, [apiAxios]);
};
