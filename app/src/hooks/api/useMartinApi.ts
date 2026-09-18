import { AxiosInstance, type AxiosRequestConfig } from 'axios';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { CreateTileExtentSessionResponse, IMartinSession } from 'interfaces/useMartinApi.interface';

/**
 * Returns API methods for map Martin sessions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useMartinApi = (axios: AxiosInstance) => {
  /**
   * Create a Martin session for a search.
   *
   * The response carries a short lived token and the tile URL template to use with it. The token authorizes tiles for
   * this search only; the API resolves the caller's access and stores it server-side, so nothing sensitive travels in
   * the token itself.
   *
   * @param {string} featureType - Feature type being searched.
   * @param {(ExpressionTreeExpression | null)} [expressionTree] - Search expression, or null for an unfiltered view.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options]
   * @return {Promise<IMartinSession>}
   */
  const createMartinSession = async (
    featureType: string,
    expressionTree?: ExpressionTreeExpression | null,
    options?: Pick<AxiosRequestConfig, 'signal'> & { submissionIds?: number[] }
  ): Promise<IMartinSession> => {
    const body = {
      feature_type: featureType,
      ...(options?.submissionIds?.length ? { submissionIds: options.submissionIds } : {}),
      ...(expressionTree ? { expression: expressionTree } : {})
    };

    const { data } = await axios.post<IMartinSession>('/api/martin/token', body, {
      signal: options?.signal
    });

    return data;
  };

  /**
   * Create a tile session for a single submission feature's spatial properties.
   *
   * Authorized exactly as the feature detail endpoint is, so a caller who can read the feature can map it. The
   * returned token is scoped to this feature alone; the identifiers travel inside it, so requesting a different
   * feature means requesting a different session, which is authorized on its own merits.
   *
   * Returns a result with no token when the feature has no spatial properties to map.
   *
   * @param {number} submissionId
   * @param {number} submissionFeatureId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options]
   * @return {Promise<CreateTileExtentSessionResponse>}
   */
  const createSubmissionFeatureTileSession = async (
    submissionId: number,
    submissionFeatureId: number,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<CreateTileExtentSessionResponse> => {
    const { data } = await axios.post<CreateTileExtentSessionResponse>(
      `/api/submission/${submissionId}/features/${submissionFeatureId}/tile`,
      undefined,
      { signal: options?.signal }
    );

    return data;
  };

  /**
   * Create a tile session for the spatial properties of every active feature of a submission upload.
   *
   * Restricted to system administrators, for the upload review page. The API verifies that the upload belongs to the
   * submission before issuing a token scoped to that upload alone; the identifiers travel inside the token, so
   * requesting a different upload means requesting a different session.
   *
   * Returns a result with no token when the upload has no spatial properties to map.
   *
   * @param {number} submissionId
   * @param {string} submissionUploadId
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options]
   * @return {Promise<CreateTileExtentSessionResponse>}
   */
  const createSubmissionUploadTileSession = async (
    submissionId: number,
    submissionUploadId: string,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<CreateTileExtentSessionResponse> => {
    const { data } = await axios.post<CreateTileExtentSessionResponse>(
      `/api/administrative/submission/${submissionId}/upload/${submissionUploadId}/tile`,
      undefined,
      { signal: options?.signal }
    );

    return data;
  };

  return {
    createMartinSession,
    createSubmissionFeatureTileSession,
    createSubmissionUploadTileSession
  };
};
