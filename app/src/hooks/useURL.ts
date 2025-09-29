import qs, { ParsedQs } from 'qs';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { jsonParseObjectProperties, jsonStringifyObjectProperties } from 'utils/Utils';

type QueryParams = Record<string, any> | ParsedQs;

/**
 * Hook that helps with reading from and writing to the URL.
 *
 * @template Q - type of the query parameters object
 */
const useURL = <Q extends QueryParams = ParsedQs>() => {
  const navigate = useNavigate();
  const location = useLocation();
  const pathParams = useParams();

  // Parse query params from current location.search (strip ?)
  const queryParams = qs.parse(location.search, { ignoreQueryPrefix: true });

  /**
   * Replaces any existing query params with new query params.
   */
  const replaceQueryParams = (newQueryParams: Record<string, any>) => {
    const preppedNewQueryParams = jsonStringifyObjectProperties(newQueryParams);
    const stringifiedQueryParams = qs.stringify(preppedNewQueryParams);
    navigate({ search: `?${stringifiedQueryParams}` }, { replace: true });
  };

  /**
   * Appends new query params to any existing query params (will overwrite duplicates).
   */
  const appendQueryParams = (newQueryParams: Record<string, any>) => {
    const preppedNewQueryParams = jsonStringifyObjectProperties(newQueryParams);
    const mergedParams = { ...queryParams, ...preppedNewQueryParams };
    const stringifiedQueryParams = qs.stringify(mergedParams);
    navigate({ search: `?${stringifiedQueryParams}` }, { replace: true });
  };

  return {
    path: location.pathname,
    pathParams,
    queryParams: jsonParseObjectProperties(queryParams) as Q,
    replaceQueryParams,
    appendQueryParams
  };
};

export default useURL;
