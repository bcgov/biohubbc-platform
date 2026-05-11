import axios from 'axios';

interface IUploadFileToUrlParams {
  url: string;
  file: File;
  contentType?: string;
}

/**
 * Returns object storage upload methods for presigned URLs.
 *
 * @return {*} object whose properties are supported api methods.
 */
export const useObjectStorageApi = () => {
  /**
   * Upload a file directly to a presigned object storage URL.
   *
   * This intentionally uses the default axios client instead of the authenticated API client because presigned object
   * storage URLs are absolute external URLs and must not receive the app API base URL or bearer token.
   *
   * @param {IUploadFileToUrlParams} params Upload parameters.
   * @returns {Promise<void>} Resolves after object storage accepts the file.
   */
  const uploadFileToUrl = async (params: IUploadFileToUrlParams): Promise<void> => {
    const { url, file, contentType = 'application/octet-stream' } = params;

    await axios.put(url, file, {
      headers: {
        'Content-Type': contentType
      },
      timeout: 30000
    });
  };

  return {
    uploadFileToUrl
  };
};
