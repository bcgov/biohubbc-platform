import { expect } from 'chai';
import { describe } from 'mocha';
import { buildPartZipKey, parseExportPartKey, parseFeatureTypeFromParquetKey, shouldRollPart } from './export-utils';

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

    it('returns null for the group-keyed part-zip export key (5 segments, not 4)', () => {
      const result = parseFeatureTypeFromParquetKey(
        'downloads/dl-1/versions/ver-2/exports/grp-3/biohub-grp-3-part-1.zip',
        'dl-1'
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
    it('returns the exact group-keyed deterministic key for part N', () => {
      const key = buildPartZipKey('dl-1', 'ver-2', 'grp-3', 1);

      expect(key).to.equal('downloads/dl-1/versions/ver-2/exports/grp-3/biohub-grp-3-part-1.zip');
    });

    it('embeds the group id (not the version id) in the leaf filename', () => {
      const key = buildPartZipKey('dl-1', 'ver-2', 'grp-3', 1);
      const leaf = key.split('/').pop();

      expect(leaf).to.equal('biohub-grp-3-part-1.zip');
      expect(leaf).to.not.include('ver-2');
    });
  });

  describe('parseExportPartKey', () => {
    it('round-trips the ids built by buildPartZipKey', () => {
      const key = buildPartZipKey('dl-1', 'ver-2', 'grp-3', 4);

      expect(parseExportPartKey(key)).to.eql({
        downloadId: 'dl-1',
        downloadVersionId: 'ver-2',
        groupId: 'grp-3'
      });
    });

    it('throws on a non-export key shape (e.g. a parquet key)', () => {
      expect(() => parseExportPartKey('downloads/dl-1/observation/data.parquet')).to.throw(
        'unexpected export part key shape'
      );
    });
  });

  describe('shouldRollPart', () => {
    it('returns false when under the threshold', () => {
      expect(shouldRollPart(100n, 500n)).to.be.false;
    });

    it('returns true at the exact threshold (>= semantics)', () => {
      expect(shouldRollPart(500n, 500n)).to.be.true;
    });

    it('returns true over the threshold', () => {
      expect(shouldRollPart(501n, 500n)).to.be.true;
    });
  });
});
