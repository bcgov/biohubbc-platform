import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { SubmissionFeaturePropertyIngestionRepository } from './submission-feature-property-ingestion-repository';

describe('SubmissionFeaturePropertyIngestionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertTimestampPropertiesBySubmissionUploadId', () => {
    it('executes SQL phase', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.insertTimestampPropertiesBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
    });
  });

  describe('clearUploadPropertyWorkingSetStagingBySubmissionUploadId', () => {
    it('clears resolved and typed staging rows in one upload-scoped statement', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.clearUploadPropertyWorkingSetStagingBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('DELETE FROM submission_upload_staging_typed_property_value');
      expect(sqlText).to.include('DELETE FROM submission_upload_staging_resolved_property');
      expect(sqlText).to.not.include('submission_upload_staging_valid_property_value');
    });
  });

  describe('populateDatetimeCandidateStagingBySubmissionUploadId', () => {
    it('builds candidates directly from typed staging rows', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.populateDatetimeCandidateStagingBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('FROM submission_upload_staging_typed_property_value v');
      expect(sqlText).to.include("WHERE v.property_type_name = 'datetime'");
      expect(sqlText).to.not.include('submission_upload_staging_valid_property_value');
    });
  });

  describe('populateArtifactCandidateStagingBySubmissionUploadId', () => {
    it('resolves artifact keys against exact tarball-relative upload artifact paths', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.populateArtifactCandidateStagingBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('btrim(c.raw_value #>>');
      expect(sqlText).to.include('ua.path = n.normalized_reference');
      expect(sqlText).to.not.include("'^/+'");
      expect(sqlText).to.not.include("LIKE 'files/%'");
      expect(sqlText).to.not.include('substring(r.relative_reference FROM 7)');
      expect(sqlText).to.not.include("regexp_replace(f.upload_relative_reference, '/{2,}', '/', 'g')");
    });
  });

  describe('populateCodeCandidateStagingBySubmissionUploadId', () => {
    it('resolves code property jsonb values into contributor code candidate staging', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.populateCodeCandidateStagingBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000', 77);

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('INSERT INTO submission_upload_staging_code_candidate');
      expect(sqlText).to.include('FROM submission_upload_staging_typed_property_value v');
      expect(sqlText).to.include("WHERE v.property_type_name = 'code'");
      expect(sqlText).to.include("jsonb_typeof(v.logical_value) = 'string'");
      expect(sqlText).to.include("regexp_split_to_array(btrim(v.logical_value #>> '{}'), '::')");
      expect(sqlText).to.include('LEFT JOIN contributor_codeset cc');
      expect(sqlText).to.include('LEFT JOIN contributor_codeset_code ccc');
      expect(sqlText).to.include('ccc.contributor_codeset_code_id');
    });
  });

  describe('populateTaxonCandidateStagingBySubmissionUploadId', () => {
    it('resolves taxon property jsonb values into taxon candidate staging', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.populateTaxonCandidateStagingBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('INSERT INTO submission_upload_staging_taxon_candidate');
      expect(sqlText).to.include('FROM submission_upload_staging_typed_property_value v');
      expect(sqlText).to.include("WHERE v.property_type_name = 'taxon'");
      expect(sqlText).to.include("jsonb_typeof(v.logical_value) = 'number'");
      expect(sqlText).to.include("(v.logical_value #>> '{}')::integer AS tsn");
      expect(sqlText).to.include('LEFT JOIN taxon t');
      expect(sqlText).to.include("t.itis_tsn = (v.logical_value #>> '{}')::integer");
      expect(sqlText).to.include('t.taxon_id');
    });
  });

  describe('populateFeatureCandidateStagingBySubmissionUploadId', () => {
    it('resolves feature property jsonb values into feature candidate staging', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.populateFeatureCandidateStagingBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('INSERT INTO submission_upload_staging_feature_candidate');
      expect(sqlText).to.include('FROM submission_upload_staging_typed_property_value v');
      expect(sqlText).to.include("WHERE v.property_type_name = 'feature'");
      expect(sqlText).to.include("jsonb_typeof(v.logical_value) = 'string'");
      expect(sqlText).to.include("regexp_split_to_array(btrim(v.logical_value #>> '{}'), '::')");
      expect(sqlText).to.include('LEFT JOIN submission_feature target');
      expect(sqlText).to.include('target.source_id = p.parsed_source_id');
    });
  });

  describe('insertCodePropertiesBySubmissionUploadId', () => {
    it('inserts resolved code candidates into submission_feature_property_code', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.insertCodePropertiesBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('INSERT INTO submission_feature_property_code');
      expect(sqlText).to.include('submission_feature_id');
      expect(sqlText).to.include('feature_type_property_id');
      expect(sqlText).to.include('contributor_codeset_code_id');
      expect(sqlText).to.include('FROM submission_upload_staging_code_candidate c');
      expect(sqlText).to.include('AND c.is_format_valid');
      expect(sqlText).to.include('AND c.contributor_codeset_code_id IS NOT NULL');
    });
  });

  describe('insertTaxonPropertiesBySubmissionUploadId', () => {
    it('inserts resolved taxon candidates into submission_feature_property_taxon', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.insertTaxonPropertiesBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('INSERT INTO submission_feature_property_taxon');
      expect(sqlText).to.include('submission_feature_id');
      expect(sqlText).to.include('feature_type_property_id');
      expect(sqlText).to.include('taxon_id');
      expect(sqlText).to.include('FROM submission_upload_staging_taxon_candidate c');
      expect(sqlText).to.include('AND c.taxon_id IS NOT NULL');
    });
  });

  describe('insertArtifactLinksBySubmissionUploadId', () => {
    it('inserts resolved artifact_key candidates into submission_feature_artifact', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.insertArtifactLinksBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('INSERT INTO submission_feature_artifact');
      expect(sqlText).to.include('SELECT DISTINCT');
      expect(sqlText).to.include('n.submission_feature_id');
      expect(sqlText).to.include('n.artifact_id');
      expect(sqlText).to.include('FROM submission_upload_staging_artifact_candidate n');
      expect(sqlText).to.include("AND COALESCE(n.normalized_reference, '') <> ''");
      expect(sqlText).to.include('AND n.artifact_id IS NOT NULL');
      expect(sqlText).to.include('ON CONFLICT (submission_feature_id, artifact_id) DO NOTHING');
    });
  });

  describe('getIngestionErrorCountBySubmissionUploadId', () => {
    it('returns the count value from the query', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: () => Promise.resolve(mockQueryResult([{ count: 7 }]))
      });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      const result = await repository.getIngestionErrorCountBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(result).to.equal(7);
    });
  });

  describe('getIngestionErrorCountsByCode', () => {
    it('returns grouped counts', async () => {
      const rows = [
        { error_code: 'TYPE_MISMATCH', error_count: 3 },
        { error_code: 'UNRESOLVED_TAXON', error_count: 1 }
      ];
      const mockDBConnection = getMockDBConnection({
        sql: () => Promise.resolve(mockQueryResult(rows))
      });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      const result = await repository.getIngestionErrorCountsByCode('550e8400-e29b-41d4-a716-446655440000');

      expect(result).to.eql(rows);
    });
  });

  describe('getIngestionErrorSummariesBySubmissionUploadId', () => {
    it('returns summary rows', async () => {
      const rows = [
        {
          property_name: 'count',
          feature_type_property_id: 22,
          error_code: 'TYPE_MISMATCH',
          error_message: 'Property value type mismatch',
          count: 3,
          details: null
        }
      ];
      const mockDBConnection = getMockDBConnection({
        sql: () => Promise.resolve(mockQueryResult(rows))
      });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      const result = await repository.getIngestionErrorSummariesBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000',
        10
      );

      expect(result).to.eql(rows);
    });
  });

  describe('recordReferenceErrorsBySubmissionUploadId', () => {
    it('counts reference errors in the grouped error phase', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.recordReferenceErrorsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('error_rows AS');
      expect(sqlText).to.include('grouped_errors AS');
      expect(sqlText).to.not.match(/error_rows AS \([\s\S]*COUNT\(\*\)::integer AS count[\s\S]*FROM expanded e/);
      expect(sqlText).to.match(/grouped_errors AS \([\s\S]*COUNT\(\*\)::integer AS count/);
    });
  });

  describe('recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId', () => {
    it('records one duplicate-source-id error per colliding source_id, excluding NULLs', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('grouped_errors AS');
      expect(sqlText).to.include("'DUPLICATE_FEATURE_SOURCE_ID'");
      expect(sqlText).to.include('HAVING COUNT(*) > 1');
      expect(sqlText).to.include('source_id IS NOT NULL');
      expect(sqlText).to.include('record_end_date IS NULL');
      expect(sqlText).to.include("jsonb_build_object('source_id', source_id)");
      expect(sqlText).to.include('ON CONFLICT');
      expect(sqlText).to.match(
        /ON CONFLICT\s*\(\s*submission_upload_id,\s*error_code,\s*feature_type_property_id,\s*property_name\s*\)/
      );
      expect(sqlText).to.not.include('NULLIF');
      expect(sqlText).to.not.include('submission_feature_id');
    });
  });

  describe('recordMissingRequiredPropertyErrorsBySubmissionUploadId', () => {
    it('uses an indexable raw-property anti-lookup for present required properties', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.recordMissingRequiredPropertyErrorsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('NOT EXISTS');
      expect(sqlText).to.include('FROM submission_feature');
      expect(sqlText).to.include('FROM submission_upload_staging_raw_property raw');
      expect(sqlText).to.include('raw.submission_upload_id');
      expect(sqlText).to.include('raw.submission_feature_id = sf.submission_feature_id');
      expect(sqlText).to.include('raw.property_name = rp.property_name');
      expect(sqlText).to.not.include('present_properties AS');
      expect(sqlText).to.not.include('FROM submission_upload_staging_raw_property\n        WHERE submission_upload_id');
      expect(sqlText).to.not.include('FROM submission_upload_staging_resolved_property rsp');
      expect(sqlText).to.not.include('SELECT DISTINCT\n          rsp.submission_feature_id');
    });
  });

  describe('recordPrimitiveValidationErrorsBySubmissionUploadId', () => {
    it('records primitive, cardinality, and unsupported type validation errors', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.recordPrimitiveValidationErrorsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('MULTIPLE_VALUES_NOT_ALLOWED');
      expect(sqlText).to.include('TYPE_MISMATCH');
      expect(sqlText).to.include('UNSUPPORTED_PROPERTY_TYPE');
      // `feature` must be in BOTH the string-type rule (single-line IN list) and the supported-type
      // allowlist (multi-line NOT IN list). Normalise whitespace so the multi-line list can be
      // reindented without breaking the assertion. `'artifact_key', 'feature')` is unique to the
      // string rule; `'taxon', 'feature'` is unique to the allowlist.
      const normalizedSql = sqlText.replace(/\s+/g, ' ');
      expect(normalizedSql).to.include("'artifact_key', 'feature')");
      expect(normalizedSql).to.include("'taxon', 'feature'");
    });
  });

  describe('insertFeatureRelationshipsBySubmissionUploadId', () => {
    it('ignores exact and inverse duplicate feature relationship conflicts', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.insertFeatureRelationshipsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('jsonb_array_elements');
      expect(sqlText).to.include("sf.data -> 'content'");
      expect(sqlText).to.include('SELECT DISTINCT');
      expect(sqlText).to.include('FROM resolved');
      expect(sqlText).to.include('target.source_id = e.reference_source_id');
      expect(sqlText).to.include('target.submission_upload_id');
      expect(sqlText).to.include('ON CONFLICT DO NOTHING');
      expect(sqlText).to.not.include('ON CONFLICT (source_feature_id, target_feature_id) DO NOTHING');
    });
  });
});
