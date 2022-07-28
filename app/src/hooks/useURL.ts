import qs, { ParsedQs } from 'qs';
import { useHistory, useLocation, useParams } from 'react-router';
import { jsonParseObjectKeys, jsonStringifyObjectKeys } from 'utils/Utils';

/**
 * Hook that helps with reading from and writing to the URL.
 *
 * @template QueryParams
 * @return {*}
 */
const useURL = <QueryParams extends Record<string, any> = ParsedQs>() => {
  const history = useHistory();
  const location = useLocation();
  const pathParams = useParams();
  const queryParams = qs.parse(location.search, { ignoreQueryPrefix: true });

  /**
   * Replaces any existing query params with new query params.
   *
   * @param {Record<string, any>} newQueryParams
   */
  const replaceQueryParams = (newQueryParams: Record<string, any>) => {
    const preppedNewQueryParams = jsonStringifyObjectKeys(newQueryParams);

    const stringifiedQueryParams = qs.stringify(preppedNewQueryParams);

    history.replace({ search: `?${stringifiedQueryParams}` });
  };

  /**
   * Appends new query params to any existing query params (will overwrite duplicates).
   *
   * @param {Record<string, any>} newQueryParams
   */
  const appendQueryParams = (newQueryParams: Record<string, any>) => {
    const preppedNewQueryParams = jsonStringifyObjectKeys(newQueryParams);

    const stringifiedQueryParams = qs.stringify({ ...queryParams, ...preppedNewQueryParams });

    history.replace({ search: `?${stringifiedQueryParams}` });
  };

  return {
    path: location.pathname,
    pathParams,
    queryParams: jsonParseObjectKeys(queryParams) as QueryParams,
    replaceQueryParams,
    appendQueryParams
  };
};

export default useURL;
