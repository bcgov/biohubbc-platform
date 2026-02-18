import { z } from 'zod';

export const DownloadStatusZod = z.enum(['pending', 'processing', 'ready', 'downloaded', 'failed']);

export enum DownloadStatusEnum {
  PENDING = 'pending',
  PROCESSING = 'processing',
  READY = 'ready',
  DOWNLOADED = 'downloaded',
  FAILED = 'failed'
}
