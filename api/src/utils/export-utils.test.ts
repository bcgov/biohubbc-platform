import { expect } from 'chai';
import { describe } from 'mocha';
import { buildPartZipKey, parseFeatureTypeFromParquetKey, shouldRollChunk } from './export-utils';

describe('export-utils', () => {
  describe('parseFeatureTypeFromParquetKey', () => {
    it('returns the feature type name for a valid Parquet key', () => {
      const result = parseFeatureTypeFromParquetKey(
        'downloads/aaaa0000-0000-0000-0000-000000000001/observation/data.parquet',
        'aaaa0000-0000-0000-0000-000000000001'
      );

      expect(result).to.equal('observation');
    });

    it('returns null when the download_id segment does not match', () => {
      const result = parseFeatureTypeFromParquetKey(
        'downloads/bbbb0000-0000-0000-0000-000000000999/observation/data.parquet',
        'aaaa0000-0000-0000-0000-000000000001'
      );

      expect(result).to.be.null;
    });

    it('returns null for a part-zip export key (wrong shape)', () => {
      const result = parseFeatureTypeFromParquetKey(
        'downloads/aaaa0000-0000-0000-0000-000000000001/exports/eid/biohub-eid-part-1.zip',
        'aaaa0000-0000-0000-0000-000000000001'
      );

      expect(result).to.be.null;
    });

    it('returns null when trailing segment is not data.parquet', () => {
      const result = parseFeatureTypeFromParquetKey(
        'downloads/aaaa0000-0000-0000-0000-000000000001/observation/other.parquet',
        'aaaa0000-0000-0000-0000-000000000001'
      );

      expect(result).to.be.null;
    });
  });

  describe('buildPartZipKey', () => {
    it('returns the exact deterministic key for part N', () => {
      const key = buildPartZipKey('aaaa0000-0000-0000-0000-000000000001', 'dddd0000-0000-0000-0000-000000000001', 3);

      expect(key).to.equal(
        'downloads/aaaa0000-0000-0000-0000-000000000001/exports/dddd0000-0000-0000-0000-000000000001/biohub-dddd0000-0000-0000-0000-000000000001-part-3.zip'
      );
    });
  });

  describe('shouldRollChunk', () => {
    it('returns false when under the threshold', () => {
      expect(shouldRollChunk(100n, 500n)).to.be.false;
    });

    it('returns true at the exact threshold (>= semantics)', () => {
      expect(shouldRollChunk(500n, 500n)).to.be.true;
    });

    it('returns true over the threshold', () => {
      expect(shouldRollChunk(501n, 500n)).to.be.true;
    });
  });
});
