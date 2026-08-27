import { AxiosInstance, type AxiosRequestConfig } from 'axios';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { IMartinSession } from 'interfaces/useMartinApi.interface';

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
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<IMartinSession> => {
    const body = expressionTree
      ? { feature_type: featureType, expression: expressionTree }
      : { feature_type: featureType };

    const { data } = await axios.post<IMartinSession>('/api/martin/token', body, {
      signal: options?.signal
    });

    return data;
  };

  return {
    createMartinSession
  };
};
