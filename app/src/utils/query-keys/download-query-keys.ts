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
 * Key of one download's detail record.
 *
 * @param {string} downloadId The download.
 * @returns The download detail key.
 */
const detail = (downloadId: string) => [...download(downloadId), 'detail'] as const;

/**
 * Key of the feature types, and their exportable columns, a download materialized.
 *
 * @param {string} downloadId The download.
 * @returns The download feature types key.
 */
const featureTypes = (downloadId: string) => [...download(downloadId), 'feature-types'] as const;

/**
 * Key of one page of a download's versions.
 *
 * @param {string} downloadId The download.
 * @param {ApiPaginationRequestOptions} pagination The page and sort sent.
 * @returns The download versions key.
 */
const versions = (downloadId: string, pagination: ApiPaginationRequestOptions) =>
  [...download(downloadId), 'versions', { pagination }] as const;

/**
 * Key of one download version's record.
 *
 * @param {string} downloadId The download.
 * @param {string} downloadVersionId The version.
 * @returns The download version key.
 */
const version = (downloadId: string, downloadVersionId: string) =>
  [...download(downloadId), 'version', downloadVersionId, 'detail'] as const;

/**
 * Key of one page of the exports made from one download version.
 *
 * @param {string} downloadId The download.
 * @param {string} downloadVersionId The version.
 * @param {ApiPaginationRequestOptions} pagination The page and sort sent.
 * @returns The version exports key.
 */
const versionExports = (downloadId: string, downloadVersionId: string, pagination: ApiPaginationRequestOptions) =>
  [...download(downloadId), 'version', downloadVersionId, 'exports', { pagination }] as const;

/**
 * Query keys for downloads, ordered from broad to narrow so that each prefix names the set of queries a change
 * invalidates.
 */
export const downloadQueryKeys = { lists, list, download, detail, featureTypes, versions, version, versionExports };
