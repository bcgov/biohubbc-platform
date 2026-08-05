import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { isSubmissionFeatureActive } from './sql-fragments';
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

  describe('property table inserts', () => {
    const cases: {
      name: string;
      method: keyof SubmissionFeaturePropertyIngestionRepository;
      stagedAlias: string;
      featureAlias: string;
    }[] = [
      {
        name: 'timestamp',
        method: 'insertTimestampPropertiesBySubmissionUploadId',
        stagedAlias: 'p',
        featureAlias: 'feature'
      },
      {
        name: 'geometry',
        method: 'insertGeometryPropertiesBySubmissionUploadId',
        stagedAlias: 'p',
        featureAlias: 'feature'
      },
      {
        name: 'string',
        method: 'insertStringPropertiesBySubmissionUploadId',
        stagedAlias: 'v',
        featureAlias: 'feature'
      },
      {
        name: 'number',
        method: 'insertNumberPropertiesBySubmissionUploadId',
        stagedAlias: 'v',
        featureAlias: 'feature'
      },
      {
        name: 'boolean',
        method: 'insertBooleanPropertiesBySubmissionUploadId',
        stagedAlias: 'v',
        featureAlias: 'feature'
      },
      {
        name: 'code',
        method: 'insertCodePropertiesBySubmissionUploadId',
        stagedAlias: 'c',
        featureAlias: 'feature'
      },
      {
        name: 'feature',
        method: 'insertFeaturePropertiesBySubmissionUploadId',
        stagedAlias: 'c',
        featureAlias: 'src'
      },
      {
        name: 'taxon',
        method: 'insertTaxonPropertiesBySubmissionUploadId',
        stagedAlias: 'c',
        featureAlias: 'feature'
      },
      {
        name: 'artifact',
        method: 'insertArtifactPropertiesBySubmissionUploadId',
        stagedAlias: 'n',
        featureAlias: 'feature'
      }
    ];

    for (const testCase of cases) {
      it(`uses staged Blueprint provenance for ${testCase.name} properties`, async () => {
        const sqlStub = sinon.stub().resolves(mockQueryResult([]));
        const mockDBConnection = getMockDBConnection({ sql: sqlStub });
        const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

        await (repository[testCase.method] as (uploadId: string) => Promise<void>).call(
          repository,
          '550e8400-e29b-41d4-a716-446655440000'
        );

        const sqlText = sqlStub.firstCall.args[0].text as string;
        expect(sqlText).to.include(`${testCase.stagedAlias}.blueprint_feature_type_property_id`);
        expect(sqlText).to.include('submission_feature');
        expect(sqlText).to.include(
          `${testCase.featureAlias}.submission_feature_id = ${testCase.stagedAlias}.submission_feature_id`
        );
        expect(sqlText).to.include(isSubmissionFeatureActive(testCase.featureAlias));
        expect(sqlText).to.include('FROM submission_upload_feature staged');
        expect(sqlText).to.include('staged.submission_upload_id =');
        expect(sqlText).to.include(`staged.submission_feature_id = ${testCase.stagedAlias}.submission_feature_id`);
        expect(sqlText).to.not.include(`${testCase.featureAlias}.submission_upload_id =`);
        expect(sqlText).to.not.include('bftp_audit');
      });
    }
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

  describe('deletePropertyRecordsBySubmissionUploadId', () => {
    it('deletes typed artifact property rows instead of feature-level artifact links', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.deletePropertyRecordsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('FROM submission_upload_feature staged');
      expect(sqlText).to.include('staged.submission_feature_id IS NOT NULL');
      expect(sqlText).to.include(isSubmissionFeatureActive('feature'));
      expect(sqlText).to.include('DELETE FROM submission_feature_property_artifact');
      expect(sqlText).to.not.include('DELETE FROM submission_feature_artifact');
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
      expect(sqlText).to.include('v.blueprint_feature_type_property_id');
      expect(sqlText).to.include("WHERE v.property_type_name = 'datetime'");
      expect(sqlText).to.not.include('submission_upload_staging_valid_property_value');
    });

    it('accepts short UTC offsets (+HH / -HH) in datetime regex patterns', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.populateDatetimeCandidateStagingBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      const sqlText = sqlStub.firstCall.args[0].text as string;
      // Short-offset form: (:\d{2})? makes the minutes optional in both datetime arms
      expect(sqlText).to.include('(:\\d{2})?');
      // The old fixed-width form (no optional group) must not appear
      expect(sqlText).to.not.include('[+-]\\d{2}:\\d{2})?$');
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
      expect(sqlText).to.include('v.blueprint_feature_type_property_id');
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
      expect(sqlText).to.include('v.blueprint_feature_type_property_id');
      expect(sqlText).to.include("WHERE v.property_type_name = 'taxon'");
      expect(sqlText).to.include("jsonb_typeof(v.logical_value) = 'number'");
      expect(sqlText).to.include("(v.logical_value #>> '{}')::integer AS tsn");
      expect(sqlText).to.include('LEFT JOIN taxon t');
      expect(sqlText).to.include("t.itis_tsn = (v.logical_value #>> '{}')::integer");
      expect(sqlText).to.include('t.taxon_id');
      expect(sqlText).to.include('t.record_end_date IS NULL');
    });
  });

  describe('getUnresolvedTaxonTsnsBySubmissionUploadId', () => {
    it('returns the distinct unresolved taxon TSNs for the upload', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([{ tsn: 180542 }, { tsn: 180541 }]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      const response = await repository.getUnresolvedTaxonTsnsBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000'
      );

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('SELECT DISTINCT c.tsn');
      expect(sqlText).to.include('FROM submission_upload_staging_taxon_candidate c');
      expect(sqlText).to.include('LEFT JOIN taxon t');
      expect(sqlText).to.include('t.record_end_date IS NULL');
      expect(sqlText).to.include('c.taxon_id IS NULL');
      expect(sqlText).to.include('t.parent_taxon_id IS NULL');
      expect(sqlText).to.include("lower(t.rank) <> 'kingdom'");
      expect(sqlText).to.include('t.rank IS NULL');
      expect(response).to.eql([180542, 180541]);
    });
  });

  describe('resolveTaxonCandidateTaxonIdsBySubmissionUploadId', () => {
    it('backfills taxon_id for previously-unresolved taxon candidate rows', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.resolveTaxonCandidateTaxonIdsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('UPDATE submission_upload_staging_taxon_candidate c');
      expect(sqlText).to.include('SET taxon_id = t.taxon_id');
      expect(sqlText).to.include('FROM taxon t');
      expect(sqlText).to.include('t.itis_tsn = c.tsn');
      expect(sqlText).to.include('t.record_end_date IS NULL');
    });
  });

  describe('populateFeatureCandidateStagingBySubmissionUploadId', () => {
    it('resolves feature property jsonb values into feature candidate staging', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.populateFeatureCandidateStagingBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000', 42);

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('INSERT INTO submission_upload_staging_feature_candidate');
      expect(sqlText).to.include('FROM submission_upload_staging_typed_property_value v');
      expect(sqlText).to.include('v.blueprint_feature_type_property_id');
      expect(sqlText).to.include("WHERE v.property_type_name = 'feature'");
      expect(sqlText).to.include("jsonb_typeof(v.logical_value) = 'string'");
      expect(sqlText).to.include("regexp_split_to_array(btrim(v.logical_value #>> '{}'), '::')");
      // Resolution prefers the same upload's live rows and falls back to the submission's
      // published live rows, picking exactly one target.
      expect(sqlText).to.include('LEFT JOIN LATERAL');
      expect(sqlText).to.include('candidate.submission_id =');
      expect(sqlText).to.include('candidate.source_id = p.parsed_source_id');
      expect(sqlText).to.include(isSubmissionFeatureActive('candidate'));
      expect(sqlText).to.include('LIMIT 1');
      // Among published candidates, rows whose type is allowed for the property win —
      // guards against cross-type source_id collisions picking a wrong-type row.
      expect(sqlText).to.include('FROM feature_type_property_feature ftpf');
      expect(sqlText).to.include('ftpf.target_feature_type_id = candidate.feature_type_id');
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
      // Provenance column is carried from candidate staging.
      expect(sqlText).to.include('blueprint_feature_type_property_id');
      expect(sqlText).to.include('c.blueprint_feature_type_property_id');
      expect(sqlText).to.not.include('bftp_audit');
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
      // Provenance column is carried from candidate staging.
      expect(sqlText).to.include('blueprint_feature_type_property_id');
      expect(sqlText).to.include('c.blueprint_feature_type_property_id');
      expect(sqlText).to.not.include('bftp_audit');
      expect(sqlText).to.include('taxon_id');
      expect(sqlText).to.include('FROM submission_upload_staging_taxon_candidate c');
      expect(sqlText).to.include('AND c.taxon_id IS NOT NULL');
    });
  });

  describe('insertArtifactPropertiesBySubmissionUploadId', () => {
    it('inserts resolved artifact_key candidates into submission_feature_property_artifact', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.insertArtifactPropertiesBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('INSERT INTO submission_feature_property_artifact');
      expect(sqlText).to.include('SELECT DISTINCT');
      expect(sqlText).to.include('n.submission_feature_id');
      expect(sqlText).to.include('n.feature_type_property_id');
      expect(sqlText).to.include('n.blueprint_feature_type_property_id');
      expect(sqlText).to.include('n.artifact_id');
      expect(sqlText).to.include('FROM submission_upload_staging_artifact_candidate n');
      expect(sqlText).to.include("AND COALESCE(n.normalized_reference, '') <> ''");
      expect(sqlText).to.include('AND n.artifact_id IS NOT NULL');
      expect(sqlText).to.match(
        /ON CONFLICT \(\s*submission_feature_id,\s*feature_type_property_id,\s*artifact_id\s*\)/
      );
      expect(sqlText).to.not.include('INSERT INTO submission_feature_artifact');
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

      await repository.recordReferenceErrorsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000', 42);

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('error_rows AS');
      expect(sqlText).to.include('grouped_errors AS');
      expect(sqlText).to.not.match(/error_rows AS \([\s\S]*COUNT\(\*\)::integer AS count[\s\S]*FROM expanded e/);
      expect(sqlText).to.match(/grouped_errors AS \([\s\S]*COUNT\(\*\)::integer AS count/);
    });
  });

  describe('recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId', () => {
    async function runAndGetSqlText(): Promise<string> {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.recordDuplicateFeatureSourceIdErrorsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(sqlStub.calledOnce).to.equal(true);
      return sqlStub.firstCall.args[0].text as string;
    }

    it('groups by source_id and emits one error row per tarball-wide collision', async () => {
      const sqlText = await runAndGetSqlText();

      expect(sqlText).to.include('grouped_errors AS');
      expect(sqlText).to.include('GROUP BY submission_upload_id, source_id');
      expect(sqlText).to.include('HAVING COUNT(*) > 1');
    });

    it('excludes NULL source_ids from the retained upload grouping', async () => {
      const sqlText = await runAndGetSqlText();

      expect(sqlText).to.include('FROM submission_upload_feature');
      expect(sqlText).to.include('source_id IS NOT NULL');
      expect(sqlText).to.not.include('NULLIF');
    });

    it('labels rows DUPLICATE_FEATURE_SOURCE_ID and stores source_id in details', async () => {
      const sqlText = await runAndGetSqlText();

      expect(sqlText).to.include("'DUPLICATE_FEATURE_SOURCE_ID'");
      expect(sqlText).to.include("jsonb_build_object('source_id', source_id)");
    });

    it('upserts on the property-keyed unique index without writing submission_feature_id', async () => {
      const sqlText = await runAndGetSqlText();

      expect(sqlText).to.include('ON CONFLICT');
      expect(sqlText).to.match(
        /ON CONFLICT\s*\(\s*submission_upload_id,\s*error_code,\s*feature_type_property_id,\s*property_name\s*\)/
      );
      expect(sqlText).to.not.include('submission_feature_id');
    });
  });

  describe('populateResolvedPropertyStagingBySubmissionUploadId', () => {
    it('resolves assignment and validation flags through the selected Blueprint', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.populateResolvedPropertyStagingBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000', 7);

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;

      expect(sqlText).to.include('INSERT INTO submission_upload_staging_resolved_property');

      // Selected Blueprint is the one pinned to the upload, passed in by the caller — not re-selected
      // here. The default Blueprint is no longer chosen inside the SQL.
      expect(sqlText).to.include('::integer AS blueprint_id');
      expect(sqlText).to.not.include('is_default');
      expect(sqlStub.firstCall.args[0].values).to.include(7);

      // Feature-type inclusion and property assignment come from the Blueprint tables.
      expect(sqlText).to.include('blueprint_feature_type bft');
      expect(sqlText).to.include('blueprint_feature_type_property bftp');

      // The Blueprint assignment is joined through its new foreign keys: blueprint_feature_type_id
      // (to the included feature type) and feature_type_property_id (to the pool entry).
      expect(sqlText).to.include('bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id');
      expect(sqlText).to.include('bftp.feature_type_property_id = ftp.feature_type_property_id');

      // The columns removed from blueprint_feature_type_property must not be referenced.
      expect(sqlText).to.not.include('bftp.blueprint_id');
      expect(sqlText).to.not.include('bftp.feature_type_id');
      expect(sqlText).to.not.include('bftp.feature_property_id');

      // Requiredness and multiplicity are sourced from the Blueprint assignment.
      expect(sqlText).to.include('COALESCE(bftp.allow_multiple, false)');
      expect(sqlText).to.include('COALESCE(bftp.required_value, false)');

      // Primitive property type still read from feature_property_type.
      expect(sqlText).to.include('feature_property_type fpt');
      expect(sqlText).to.include('fpt.name AS property_type_name');

      // feature_type_property is not the source of requiredness or multiplicity.
      expect(sqlText).to.not.include('COALESCE(ftp.allow_multiple');
      expect(sqlText).to.not.include('COALESCE(ftp.required_value');
    });
  });

  describe('recordMissingRequiredPropertyErrorsBySubmissionUploadId', () => {
    it('sources requiredness from the selected Blueprint', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.recordMissingRequiredPropertyErrorsBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000',
        7
      );

      const sqlText = sqlStub.firstCall.args[0].text as string;

      // Selected Blueprint is pinned to the upload and passed in — not re-selected from the default.
      expect(sqlText).to.include('::integer AS blueprint_id');
      expect(sqlText).to.not.include('is_default');
      expect(sqlStub.firstCall.args[0].values).to.include(7);

      expect(sqlText).to.include('blueprint_feature_type_property bftp');
      expect(sqlText).to.include('bftp.required_value = TRUE');

      // The Blueprint assignment is joined through its new foreign keys.
      expect(sqlText).to.include('bftp.blueprint_feature_type_id = bft.blueprint_feature_type_id');
      expect(sqlText).to.include('ftp.feature_type_property_id = bftp.feature_type_property_id');

      // The pool-entry bridge is constrained to the Blueprint feature type, so a property assigned
      // under a different feature type cannot satisfy a requiredness check.
      expect(sqlText).to.include('ftp.feature_type_id = bft.feature_type_id');

      // The columns removed from blueprint_feature_type_property must not be referenced.
      expect(sqlText).to.not.include('bftp.blueprint_id');
      expect(sqlText).to.not.include('bftp.feature_type_id');
      expect(sqlText).to.not.include('bftp.feature_property_id');

      // Requiredness no longer derived from feature_type_property.
      expect(sqlText).to.not.include('COALESCE(ftp.required_value, false) = TRUE');
    });

    it('uses an indexable raw-property anti-lookup for present required properties', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.recordMissingRequiredPropertyErrorsBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000',
        7
      );

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('NOT EXISTS');
      expect(sqlText).to.include('feature_scope AS');
      expect(sqlText).to.include('FROM submission_upload_staging_raw_property raw');
      expect(sqlText).to.include('raw.submission_upload_id');
      expect(sqlText).to.include('raw.submission_feature_id = staged_feature.submission_feature_id');
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

  describe('recordUnresolvedParentErrorsBySubmissionUploadId', () => {
    it('does not write a zero-count aggregate row when there are no unresolved parents', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.recordUnresolvedParentErrorsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000', 42);

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('WITH feature_scope AS');
      expect(sqlText).to.include('invalid_parent AS');
      expect(sqlText).to.include('FROM invalid_parent');
      expect(sqlText).to.include('resolution.candidate_count <> 1');
      expect(sqlText).to.include('UNRESOLVED_PARENT');
      expect(sqlText).to.include('AMBIGUOUS_PARENT');
      // Resolution falls back to the submission's published live rows.
      expect(sqlText).to.include('parent.submission_id =');
      expect(sqlText).to.include(isSubmissionFeatureActive('parent'));
    });
  });

  describe('insertFeatureRelationshipsBySubmissionUploadId', () => {
    it('rebuilds staged feature relationships and ignores exact and inverse duplicate conflicts', async () => {
      const sqlStub = sinon.stub().resolves(mockQueryResult([]));
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const repository = new SubmissionFeaturePropertyIngestionRepository(mockDBConnection);

      await repository.insertFeatureRelationshipsBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000', 42);

      expect(sqlStub.calledOnce).to.equal(true);
      const sqlText = sqlStub.firstCall.args[0].text as string;
      expect(sqlText).to.include('jsonb_array_elements');
      expect(sqlText).to.include('FROM submission_upload_feature staged');
      expect(sqlText).to.include('feature.submission_feature_id = staged.submission_feature_id');
      expect(sqlText).to.include("feature.data -> 'content'");
      expect(sqlText).to.include(isSubmissionFeatureActive('feature'));
      expect(sqlText).to.include('SELECT DISTINCT');
      expect(sqlText).to.include('FROM resolved');
      // Resolution picks exactly one target: same-upload live rows first, else the
      // submission's published live rows.
      expect(sqlText).to.include('CROSS JOIN LATERAL');
      expect(sqlText).to.include('candidate.submission_id =');
      expect(sqlText).to.include('candidate.source_id = e.reference_source_id');
      expect(sqlText).to.include('LIMIT 1');
      expect(sqlText).to.include('ON CONFLICT DO NOTHING');
      expect(sqlText).to.not.include('ON CONFLICT (source_feature_id, target_feature_id) DO NOTHING');
    });
  });
});
