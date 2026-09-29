import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Key prefix of every page of the current user's downloads.
 *
 * @returns The downloads list key prefix.
 */
const lists = () => [QUERY_KEY_ROOT.DOWNLOAD, 'list'] as const;

/**
 * Key of one page of the current user's downloads, each with its exports.
 *
 * @param {ApiPaginationRequestOptions} pagination The page.
 * @returns The downloads list key.
 */
const list = (pagination: ApiPaginationRequestOptions) => [...lists(), { pagination }] as const;

/**
 * Key prefix of everything cached for one download.
 *
 * @param {string} downloadId The download.
 * @returns The download key prefix.
 */
const download = (downloadId: string) => [QUERY_KEY_ROOT.DOWNLOAD, downloadId] as const;

/**
 * Key of the feature types, and their exportable columns, a download materialized.
 *
 * @param {string} downloadId The download.
 * @returns The download feature types key.
 */
const featureTypes = (downloadId: string) => [...download(downloadId), 'feature-types'] as const;

/**
 * Query keys for downloads, ordered from broad to narrow so that each prefix names the set of queries a change
 * invalidates.
 */
export const downloadQueryKeys = { lists, list, download, featureTypes };
