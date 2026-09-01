import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { codePropertyValueJson, featureReferencePropertyValueJson, taxonPropertyValueJson } from './sql-fragments';
import { SubmissionFeaturePropertyRepository } from './submission-feature-property-repository';

chai.use(sinonChai);

describe('SubmissionFeaturePropertyRepository', () => {
  describe('getSubmissionFeatureProperties', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('reads canonical indexed property tables instead of submission_feature.data', async () => {
      const sqlStub = sinon.stub().resolves({
        rowCount: 1,
        rows: [{ id: 'string:1', property: 'Species', value: 'Wolf' }]
      });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const submissionFeaturePropertyRepository = new SubmissionFeaturePropertyRepository(mockDBConnection);

      await submissionFeaturePropertyRepository.getSubmissionFeatureProperties(
        10,
        { page: 1, limit: 25, order: 'asc' },
        { search: 'wolf' }
      );

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('submission_feature_property_string');
      expect(sqlText).to.include('submission_feature_property_number');
      expect(sqlText).to.include('submission_feature_property_timestamp');
      expect(sqlText).to.include('submission_feature_artifact');
      expect(sqlText).to.include("fpt.name = 'number'");
      expect(sqlText).to.include("fpt.name = 'taxon'");
      expect(sqlText).to.include(`${taxonPropertyValueJson('t')} AS value`);
      expect(sqlText).to.include('t.record_end_date IS NULL');
      expect(sqlText).to.not.include('COALESCE(t.itis_scientific_name');
      expect(sqlText).to.include('HAVING COUNT(*) = 1');
      expect(sqlText).to.include('sf.record_effective_date <= now()');
      expect(sqlText).to.not.include('sf.successor_submission_feature_id IS NULL');
      expect(sqlText).to.include('SELECT id, property, value');
      expect(sqlText).to.include('ORDER BY sort asc NULLS LAST, property ASC, value_text ASC, id ASC');
      expect(sqlText).to.include("a.artifact_status = 'uploaded'");
      expect(sqlText).to.not.include('sf.data');
      expect(sqlText).to.not.include('jsonb_each');
    });

    it('projects scalar values as JSON strings and derives value_text for search and sort', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const submissionFeaturePropertyRepository = new SubmissionFeaturePropertyRepository(mockDBConnection);

      await submissionFeaturePropertyRepository.getSubmissionFeatureProperties(
        10,
        { page: 1, limit: 25, order: 'asc' },
        { search: 'wolf' }
      );

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('to_jsonb(p.value::text) AS value');
      expect(sqlText).to.include('to_jsonb(public.ST_AsGeoJSON(p.value)::text) AS value');
      expect(sqlText).to.include('to_jsonb(a.object_key::text) AS value');
      expect(sqlText).to.include("COALESCE(value->>'label', value #>> '{}') AS value_text");
      expect(sqlText).to.include('LOWER(value_text) LIKE');
      expect(sqlText).to.not.include('LOWER(value) LIKE');
    });

    it('builds taxon values with the shared structured-value fragment', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const submissionFeaturePropertyRepository = new SubmissionFeaturePropertyRepository(mockDBConnection);

      await submissionFeaturePropertyRepository.getSubmissionFeatureProperties(10, { page: 1, limit: 25 });

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include(`${taxonPropertyValueJson('t')} AS value`);
      expect(sqlText).to.include('JOIN taxon t');
    });

    it('builds code values with the shared structured-value fragment and the codeset join', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const submissionFeaturePropertyRepository = new SubmissionFeaturePropertyRepository(mockDBConnection);

      await submissionFeaturePropertyRepository.getSubmissionFeatureProperties(10, { page: 1, limit: 25 });

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include(`${codePropertyValueJson('ccc', 'cs')} AS value`);
      expect(sqlText).to.include('JOIN contributor_codeset cs');
      expect(sqlText).to.include('ON cs.contributor_codeset_id = ccc.contributor_codeset_id');
      expect(sqlText).to.not.include('to_jsonb(ccc.label::text)');
    });

    it('builds feature reference values with the shared structured-value fragment', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const submissionFeaturePropertyRepository = new SubmissionFeaturePropertyRepository(mockDBConnection);

      await submissionFeaturePropertyRepository.getSubmissionFeatureProperties(10, { page: 1, limit: 25 });

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include(`${featureReferencePropertyValueJson('referenced_sf')} AS value`);
      expect(sqlText).to.not.include('to_jsonb(referenced_sf.urn::text)');
    });

    it('sorts a public value sort by the derived value_text column', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const submissionFeaturePropertyRepository = new SubmissionFeaturePropertyRepository(mockDBConnection);

      await submissionFeaturePropertyRepository.getSubmissionFeatureProperties(10, {
        page: 2,
        limit: 10,
        sort: 'value',
        order: 'desc'
      });

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(sqlText).to.include('ORDER BY value_text desc, property ASC, value_text ASC, id ASC');
      expect(sqlStub.firstCall.args[0].values).to.include.members([10, 10]);
    });

    it('counts canonical indexed property rows instead of submission_feature.data', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 1, rows: [{ count: 3 }] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const submissionFeaturePropertyRepository = new SubmissionFeaturePropertyRepository(mockDBConnection);

      const count = await submissionFeaturePropertyRepository.getSubmissionFeaturePropertiesCount(10, {
        search: 'wolf'
      });

      const sqlText = sqlStub.firstCall.args[0].text;
      expect(count).to.equal(3);
      expect(sqlText).to.include('filtered_property_rows');
      expect(sqlText).to.include('LOWER(value_text) LIKE');
      expect(sqlText).to.not.include('ORDER BY');
      expect(sqlText).to.not.include('sf.data');
      expect(sqlText).to.not.include('jsonb_each');
    });
  });
});
