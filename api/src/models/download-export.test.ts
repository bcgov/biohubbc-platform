import { expect } from 'chai';
import { describe } from 'mocha';
import { CreateDownloadExportPayload, CreateDownloadExportRequest, DownloadExportRecord } from './download-export';

describe('download-export model', () => {
  describe('DownloadExportRecord', () => {
    // Pinned separately from Zod's own suite: this test guards parity with the
    // `download_export_mode_check` DB CHECK constraint. If either drifts (new DB
    // value without Zod update, or vice versa), this flips.
    it('rejects an unknown mode value', () => {
      const result = DownloadExportRecord.safeParse({
        download_export_id: '00000000-0000-0000-0000-000000000000',
        download_id: '00000000-0000-0000-0000-000000000001',
        format: 'csv',
        status: 'pending',
        max_part_size_bytes: '524288000',
        mode: 'star',
        started_at: null,
        completed_at: null,
        error_message: null
      });

      expect(result.success).to.be.false;
    });
  });

  describe('CreateDownloadExportRequest', () => {
    it('accepts an empty body (max_part_size_bytes is optional)', () => {
      const result = CreateDownloadExportRequest.safeParse({});

      expect(result.success).to.be.true;
    });

    // Contract isolation invariant: `mode` is hard-coded server-side. A future
    // denormalized-mode addition will open it by extending this schema. This
    // test pins the isolation — if someone accidentally widens the Request
    // type, the failure surfaces here rather than as a silent production leak.
    it('strips unknown fields like mode (not in the Request schema)', () => {
      const result = CreateDownloadExportRequest.safeParse({ mode: 'denormalized' });

      expect(result.success).to.be.true;
      expect(result.data).to.not.have.property('mode');
    });
  });

  describe('CreateDownloadExportPayload', () => {
    // Literal pin: protects against accidental drift in the hard-coded shape
    // values. A typo like `format: 'CSV'` would silently write the wrong value.
    it('requires format === "csv" and mode === "per_feature_type"', () => {
      const wrongFormat = CreateDownloadExportPayload.safeParse({
        download_id: '00000000-0000-0000-0000-000000000001',
        format: 'parquet',
        mode: 'per_feature_type',
        max_part_size_bytes: '524288000'
      });
      const wrongMode = CreateDownloadExportPayload.safeParse({
        download_id: '00000000-0000-0000-0000-000000000001',
        format: 'csv',
        mode: 'denormalized',
        max_part_size_bytes: '524288000'
      });
      const correct = CreateDownloadExportPayload.safeParse({
        download_id: '00000000-0000-0000-0000-000000000001',
        format: 'csv',
        mode: 'per_feature_type',
        max_part_size_bytes: '524288000'
      });

      expect(wrongFormat.success).to.be.false;
      expect(wrongMode.success).to.be.false;
      expect(correct.success).to.be.true;
    });
  });
});
