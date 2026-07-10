import { AxiosInstance } from 'axios';
import { GalleryDownloadsResponse } from 'interfaces/useGalleryApi.interface';
import { ApiPaginationRequestOptions } from 'types/pagination';

/**
 * Returns API methods for gallery management.
 *
 * @param {AxiosInstance} axios
 * @return {*} object whose properties are supported api methods.
 */
export const useGalleryApi = (axios: AxiosInstance) => {
  /**
   * Get paginated downloads for a public gallery by its slug.
   *
   * @param {string} slug
   * @param {ApiPaginationRequestOptions} [pagination] - Optional pagination params (page, limit, sort, order).
   * @return {Promise<GalleryDownloadsResponse>}
   */
  const getGalleryDownloadsBySlug = async (
    slug: string,
    pagination?: ApiPaginationRequestOptions
  ): Promise<GalleryDownloadsResponse> => {
    const { data } = await axios.get<GalleryDownloadsResponse>(`/api/gallery/slug/${slug}/download`, {
      params: pagination
    });
    return data;
  };

  return { getGalleryDownloadsBySlug };
};
