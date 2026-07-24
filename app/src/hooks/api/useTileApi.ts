import { AxiosInstance, type AxiosRequestConfig } from 'axios';
import { ExpressionTreeExpression } from 'interfaces/expression.interface';
import { CreateTileSessionResponse } from 'interfaces/useTileApi.interface';

/**
 * Returns API methods for map tile sessions.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useTileApi = (axios: AxiosInstance) => {
  /**
   * Create a tile session for a search.
   *
   * The response carries a short lived token and the tile URL template to use with it. The token authorizes tiles for
   * this search only; the API resolves the caller's access and stores it server-side, so nothing sensitive travels in
   * the token itself.
   *
   * Returns an over-cap result instead of a token when the search matches more features than can be mapped.
   *
   * @param {string} featureType - Feature type being searched.
   * @param {(ExpressionTreeExpression | null)} [expressionTree] - Search expression, or null for an unfiltered view.
   * @param {Pick<AxiosRequestConfig, 'signal'>} [options]
   * @return {Promise<CreateTileSessionResponse>}
   */
  const createTileSession = async (
    featureType: string,
    expressionTree?: ExpressionTreeExpression | null,
    options?: Pick<AxiosRequestConfig, 'signal'>
  ): Promise<CreateTileSessionResponse> => {
    const body = expressionTree
      ? { feature_type: featureType, expression: expressionTree }
      : { feature_type: featureType };

    const { data } = await axios.post<CreateTileSessionResponse>('/api/tile/token', body, {
      signal: options?.signal
    });

    return data;
  };

  return {
    createTileSession
  };
};
