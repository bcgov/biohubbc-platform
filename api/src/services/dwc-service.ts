import { GetObjectOutput } from 'aws-sdk/clients/s3';
import { HTTP400 } from '../errors/http-error';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile } from '../utils/media/media-file';
import { parseUnknownMedia } from '../utils/media/media-utils';
import { DBService } from './db-service';

export class DarwinCoreService extends DBService {
  /**
   * Parse out submission file to convert to DWArchive file
   *
   * @param {GetObjectOutput} s3File
   * @return {*}  {Promise<DWCArchive>}
   * @memberof DarwinCoreService
   */
  async prepDWCArchive(s3File: GetObjectOutput): Promise<DWCArchive> {
    const parsedMedia = parseUnknownMedia(s3File);

    if (!parsedMedia) {
      throw new HTTP400('Failed to parse submission, file was empty');
    }

    if (!(parsedMedia instanceof ArchiveFile)) {
      throw new HTTP400('Failed to parse submission, not a valid DwC Archive Zip file');
    }

    const dwcArchive = new DWCArchive(parsedMedia);

    return dwcArchive;
  }
}
