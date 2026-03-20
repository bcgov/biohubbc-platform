import { IFlattenedBlock } from '../models/submission-feature';
import type { TarCodesets } from '../services/ingestion/submission-ingestion-codes-service.interface';

export interface IExtractedBlocks {
  /** Dataset UUID from .dataset-id file */
  datasetId: string;
  /** Blocks grouped by type name */
  blocksByType: Map<string, IFlattenedBlock[]>;
  /** All blocks in a single flat array */
  allBlocks: IFlattenedBlock[];
  /** Filenames found in files/ directory (for media reference validation) */
  mediaFileNames: Set<string>;
  /** Contributor codesets loaded from codes/*.json files. */
  codesets: TarCodesets;
}

export interface IUploadedMediaFile {
  /** Original filename (e.g. "photo.jpg") */
  fileName: string;
  /** The S3 key the file was uploaded to */
  s3Key: string;
  /** File size in bytes from TAR header */
  byteSize: number;
}

export interface IUploadedCodesetFile {
  /** Original filename (e.g. "agency.json") */
  fileName: string;
  /** The S3 key the file was uploaded to */
  s3Key: string;
  /** File size in bytes from TAR header */
  byteSize: number;
}
