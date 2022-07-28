import qs, { ParsedQs } from 'qs';
import { useHistory, useLocation, useParams } from 'react-router';

export const useURL = <QueryParams extends Record<string, any> = ParsedQs>() => {
  const history = useHistory();
  const location = useLocation();
  const pathParams = useParams();
  const queryParams = qs.parse(location.search, { ignoreQueryPrefix: true });

  const _jsonParseObject = (obj: Record<string, any>) => {
    const newObj = {};

    Object.entries(obj).forEach(([key, value]) => {
      newObj[key] = JSON.parse(value);
    });

    return newObj;
  };

  const _jsonStringifyObject = (obj: Record<string, any>) => {
    const newObj = {};

    Object.entries(obj).forEach(([key, value]) => {
      newObj[key] = JSON.stringify(value);
    });

    return newObj;
  };

  const setQueryParams = (newQueryParams: Record<string, any>) => {
    const preppedNewQueryParams = _jsonStringifyObject(newQueryParams);

    const stringifiedQueryParams = qs.stringify(preppedNewQueryParams);

    history.replace({ search: `?${stringifiedQueryParams}` });
  };

  const setQueryParamsAndNavigate = (newQueryParams: Record<string, any>) => {
    const preppedNewQueryParams = _jsonStringifyObject(newQueryParams);

    const stringifiedQueryParams = qs.stringify(preppedNewQueryParams);

    history.push({ search: `?${stringifiedQueryParams}` });
  };

  const appendQueryParams = (newQueryParams: Record<string, any>) => {
    const preppedNewQueryParams = _jsonStringifyObject(newQueryParams);

    const stringifiedQueryParams = qs.stringify({ ...queryParams, ...preppedNewQueryParams });

    history.replace({ search: `?${stringifiedQueryParams}` });
  };

  const appendQueryParamsAndNavigate = (newQueryParams: Record<string, any>) => {
    const preppedNewQueryParams = _jsonStringifyObject(newQueryParams);

    const stringifiedQueryParams = qs.stringify({ ...queryParams, ...preppedNewQueryParams });

    history.push({ search: `?${stringifiedQueryParams}` });
  };

  return {
    path: location.pathname,
    pathParams,
    queryParams: _jsonParseObject(queryParams) as QueryParams,
    setQueryParams,
    setQueryParamsAndNavigate,
    appendQueryParams,
    appendQueryParamsAndNavigate
  };
};
