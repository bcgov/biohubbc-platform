import { describe, expect, it } from 'vitest';
import { SubmissionYupSchema } from './CreateSubmissionPage';

describe('submission archive validation', () => {
  it.each(['submission.tar', 'submission.tar.gz', 'SUBMISSION.TAR.GZ'])(
    'accepts %s without relying on browser MIME types',
    async (name) => {
      await expect(
        SubmissionYupSchema.validateAt('file', { file: new File(['archive'], name) })
      ).resolves.toBeInstanceOf(File);
    }
  );

  it.each(['submission.gz', 'submission.zip', 'submission.tar.gz.exe'])(
    'rejects unsupported archive %s',
    async (name) => {
      await expect(SubmissionYupSchema.validateAt('file', { file: new File(['archive'], name) })).rejects.toThrow(
        'Only .tar and .tar.gz files are supported'
      );
    }
  );
});
