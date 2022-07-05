import { ArchiveFile, MediaFile, MediaValidation } from '../media-file';

export enum EML_FILE_TYPES {
  EML = 'eml',
  META = 'meta'
}

export type emlFiles = { [name in EML_FILE_TYPES]?: MediaFile };

export class EMLFile {
  rawFile: ArchiveFile;

  mediaValidation: MediaValidation;

  eml: emlFiles;

  constructor(archiveFile: ArchiveFile) {
    this.rawFile = archiveFile;

    this.mediaValidation = new MediaValidation(this.rawFile.fileName);

    this.eml = {};

    this._initArchiveFiles();
  }

  _initArchiveFiles() {
    for (const rawFile of this.rawFile.mediaFiles) {
      switch (rawFile.name) {
        case EML_FILE_TYPES.EML:
          this.eml[EML_FILE_TYPES.EML] = rawFile;
          break;
        case EML_FILE_TYPES.META:
          this.eml[EML_FILE_TYPES.META] = rawFile;
      }
    }
  }
}
