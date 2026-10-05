import { QUERY_KEY_ROOT } from 'constants/query-keys';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Key of one page of a gallery's downloads.
 *
 * @param {string} slug The gallery's slug.
 * @param {ApiPaginationRequestOptions} pagination The page sent.
 * @returns The gallery downloads key.
 */
const downloads = (slug: string, pagination: ApiPaginationRequestOptions) =>
  [QUERY_KEY_ROOT.GALLERY, slug, 'downloads', { pagination }] as const;

/**
 * Query keys for galleries.
 */
export const galleryQueryKeys = { downloads };
