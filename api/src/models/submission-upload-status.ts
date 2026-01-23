import { z } from 'zod';

export const SubmissionUploadStatus = z.object({
  submission_id: z.number(),
  upload: z.object({
    upload_id: z.string().uuid(),
    upload_status: z.enum(['pending', 'completed', 'aborted', 'expired', 'failed'])
  }),
  upload_archives: z.array(
    z
      .object({
        upload_archive_id: z.string().uuid(),
        archive_status: z.enum(['draft', 'blocked', 'pending', 'completed', 'failed']),
        byte_size: z.number().int().nullable().optional(),
        security: z.enum(['pending', 'clean', 'infected', 'error', 'skipped']).nullable().optional()
      })
      .nullable()
      .optional()
  ),
  artifacts: z.object({
    feature: z.object({
      count: z.number().int(),
      byte_size: z.number().int()
    }),
    attachment: z.object({
      count: z.number().int(),
      byte_size: z.number().int()
    })
  }),
  scans: z.array(
    z.object({
      artifact_security_scan_id: z.string().uuid(),
      scan_status: z.enum(['draft', 'blocked', 'pending', 'completed', 'failed']),
      scanner_version: z.string().optional(),
      scanned_at: z.string().optional(),
      results: z.object({}).passthrough() // passthrough for jsonb
    })
  ),
  scan_files: z.array(
    z.object({
      artifact_security_scan_file_id: z.string().uuid(),
      file_path: z.string(),
      result: z.enum(['pending', 'clean', 'infected', 'error', 'skipped'])
    })
  )
});

export type SubmissionUploadStatus = z.infer<typeof SubmissionUploadStatus>;
