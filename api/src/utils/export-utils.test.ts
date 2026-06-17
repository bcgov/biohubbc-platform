import { expect } from 'chai';
import { describe } from 'mocha';
import {
  buildParquetKey,
  buildPartZipKey,
  parseExportPartKey,
  parseFeatureTypeFromParquetKey,
  shouldRollPart
} from './export-utils';

describe('export-utils', () => {
  // Shared ids for the version-scoped Parquet key tests.
  const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';
  const DOWNLOAD_VERSION_ID = 'dddd0000-0000-0000-0000-000000000002';

  describe('buildParquetKey', () => {
    it('builds the version-scoped Parquet key in the documented segment order', () => {
      // Verifies: the key embeds downloadId, then versions/{versionId}, then the feature type, then data.parquet.
      const key = buildParquetKey('dl-1', 'ver-2', 'observation');

      expect(key).to.equal('downloads/dl-1/versions/ver-2/observation/data.parquet');
    });

    it('round-trips through parseFeatureTypeFromParquetKey', () => {
      // Verifies: parse is the exact inverse of build for the feature type when both ids match.
      const key = buildParquetKey(DOWNLOAD_ID, DOWNLOAD_VERSION_ID, 'observation');

      expect(parseFeatureTypeFromParquetKey(key, DOWNLOAD_ID, DOWNLOAD_VERSION_ID)).to.equal('observation');
    });
  });

  describe('parseFeatureTypeFromParquetKey', () => {
    it('returns the feature type name for a valid version-scoped Parquet key', () => {
      // Verifies: a 6-segment versioned key matching both ids resolves to its feature type.
      const result = parseFeatureTypeFromParquetKey(
        `downloads/${DOWNLOAD_ID}/versions/${DOWNLOAD_VERSION_ID}/observation/data.parquet`,
        DOWNLOAD_ID,
        DOWNLOAD_VERSION_ID
      );

      expect(result).to.equal('observation');
    });

    it('returns null for the OLD 4-segment (non-versioned) key shape', () => {
      // Verifies: the legacy `downloads/{id}/{type}/data.parquet` shape is no longer accepted.
      const result = parseFeatureTypeFromParquetKey(
        `downloads/${DOWNLOAD_ID}/observation/data.parquet`,
        DOWNLOAD_ID,
        DOWNLOAD_VERSION_ID
      );

      expect(result).to.be.null;
    });

    it('returns null when the download_id segment does not match', () => {
      // Verifies: a key for a different download is rejected even if the version id matches.
      const result = parseFeatureTypeFromParquetKey(
        `downloads/bbbb0000-0000-0000-0000-000000000999/versions/${DOWNLOAD_VERSION_ID}/observation/data.parquet`,
        DOWNLOAD_ID,
        DOWNLOAD_VERSION_ID
      );

      expect(result).to.be.null;
    });

    it('returns null when the download_version_id segment does not match (right download, wrong version)', () => {
      // Verifies: a key for a different version of the SAME download is rejected — recovery is version-scoped.
      const result = parseFeatureTypeFromParquetKey(
        `downloads/${DOWNLOAD_ID}/versions/dddd0000-0000-0000-0000-000000000999/observation/data.parquet`,
        DOWNLOAD_ID,
        DOWNLOAD_VERSION_ID
      );

      expect(result).to.be.null;
    });

    it('returns null for a versioned part-zip export key (wrong shape, 7 segments)', () => {
      // Verifies: the per-part export zip under `.../exports/...` is filtered out.
      const result = parseFeatureTypeFromParquetKey(
        `downloads/${DOWNLOAD_ID}/versions/${DOWNLOAD_VERSION_ID}/exports/grp-3/biohub-grp-3-part-1.zip`,
        DOWNLOAD_ID,
        DOWNLOAD_VERSION_ID
      );

      expect(result).to.be.null;
    });

    it('returns null when trailing segment is not data.parquet', () => {
      // Verifies: a 6-segment key whose leaf is not `data.parquet` is rejected.
      const result = parseFeatureTypeFromParquetKey(
        `downloads/${DOWNLOAD_ID}/versions/${DOWNLOAD_VERSION_ID}/observation/other.parquet`,
        DOWNLOAD_ID,
        DOWNLOAD_VERSION_ID
      );

      expect(result).to.be.null;
    });

    it('returns null on the wrong segment count', () => {
      // Verifies: a key with too few segments (5, missing the feature-type segment) is rejected.
      const result = parseFeatureTypeFromParquetKey(
        `downloads/${DOWNLOAD_ID}/versions/${DOWNLOAD_VERSION_ID}/data.parquet`,
        DOWNLOAD_ID,
        DOWNLOAD_VERSION_ID
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
