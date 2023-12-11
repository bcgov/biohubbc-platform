import { AxiosInstance } from 'axios';
import {
  IArtifact,
  IHandlebarsTemplates,
  IListRelatedDatasetsResponse,
  SubmissionRecord
} from 'interfaces/useDatasetApi.interface';
import { IKeywordSearchResponse } from 'interfaces/useSearchApi.interface';

/**
 * Returns a set of supported api methods for working with datasets.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
const useDatasetApi = (axios: AxiosInstance) => {
  /**
   * Fetch all datasets.
   *
   * @return {*}  {Promise<IElasticsearchResponse<{ datasetTitle: string[] }>>}
   */
  const listAllDatasets = async (): Promise<IKeywordSearchResponse[]> => {
    const { data } = await axios.get(`api/dwc/eml/search`);

    return data;
  };

  /**
   * Fetch all submissions that have not completed security review.
   *
   * @return {*}  {(Promise<
   *     (SubmissionRecord & { feature_type_id: number; feature_type: string })[]
   *   >)}
   */
  const getUnreviewedSubmissions = async (): Promise<
    (SubmissionRecord & { feature_type_id: number; feature_type: string })[]
  > => {
    const { data } = await axios.get(`api/administrative/submission/unreviewed`);

    return data;
  };

  /**
   * Fetch all submissions that have completed security review.
   *
   * @return {*}  {(Promise<
   *     (SubmissionRecord & { feature_type_id: number; feature_type: string })[]
   *   >)}
   */
  const getReviewedSubmissions = async (): Promise<
    (SubmissionRecord & { feature_type_id: number; feature_type: string })[]
  > => {
    const { data } = await axios.get(`api/administrative/submission/reviewed`);

    return data;
  };

  /**
   * Fetch dataset metadata by datasetId.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<any>}
   */
  const getDatasetEML = async (datasetId: string): Promise<any> => {
    const { data } = await axios.get(`api/dwc/submission/${datasetId}/get`);

    return data;
  };

  /**
   * Fetch dataset artifacts by datasetId.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<any>}
   */
  const getDatasetArtifacts = async (datasetId: string): Promise<IArtifact[]> => {
    const { data } = await axios.get(`api/dwc/submission/${datasetId}/artifacts`);

    return data;
  };

  /**
   * Fetch the signed URL of an artifact by its artifact ID.
   *
   * @return {*}  {Promise<string>}
   */
  const getArtifactSignedUrl = async (artifactId: number): Promise<string> => {
    const { data } = await axios.get<string>(`api/artifact/${artifactId}/getSignedUrl`);

    return data;
  };

  /**
   * Fetch the signed handlebar template for a given dataset ID.
   *
   * @param {string} datasetId
   * @return {*}  {Promise<string>}
   */
  const getHandleBarsTemplateByDatasetId = async (datasetId: string): Promise<IHandlebarsTemplates> => {
    const { data } = await axios.get<IHandlebarsTemplates>(`api/dwc/submission/${datasetId}/handlebar`);

    return data;
  };

  /**
   * Fetch a list of datasets related to the given dataset
   *
   * @param {string} datasetId
   * @return {*}  {Promise<IRelatedDataset>}
   */
  const getRelatedDatasets = async (datasetId: string): Promise<IListRelatedDatasetsResponse> => {
    const { data } = await axios.get<IListRelatedDatasetsResponse>(`api/dwc/submission/${datasetId}/related`);

    return data;
  };

  return {
    listAllDatasets,
    getUnreviewedSubmissions,
    getReviewedSubmissions,
    getDatasetEML,
    getDatasetArtifacts,
    getArtifactSignedUrl,
    getHandleBarsTemplateByDatasetId,
    getRelatedDatasets
  };
};

export default useDatasetApi;
