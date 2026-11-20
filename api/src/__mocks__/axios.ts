import { AxiosHeaders, AxiosResponse } from 'axios';

/**
 * Builds a successful axios response carrying `data`, for stubbing HTTP calls that resolve an
 * `AxiosResponse`.
 *
 * @template T The response body type.
 * @param {T} data The response body.
 * @return {*}  {AxiosResponse<T>} A 200 response with empty headers.
 */
export const mockAxiosResponse = <T>(data: T): AxiosResponse<T> => ({
  data,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() }
});
