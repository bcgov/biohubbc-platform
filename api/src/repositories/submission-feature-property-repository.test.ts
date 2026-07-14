import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
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
      expect(sqlText).to.include('HAVING COUNT(*) = 1');
      expect(sqlText).to.include('SELECT id, property, value');
      expect(sqlText).to.include('ORDER BY sort asc NULLS LAST, property ASC, value_text ASC, id ASC');
      // structured reference values are searched via the derived text label, not the raw jsonb value
      expect(sqlText).to.include("LOWER(COALESCE(value->>'label', value #>> '{}'))");
      expect(sqlText).to.include("a.artifact_status = 'uploaded'");
      expect(sqlText).to.not.include('sf.data');
      expect(sqlText).to.not.include('jsonb_each');
    });

    it('resolves reference-typed values to structured objects with a derived value_text label', async () => {
      const sqlStub = sinon.stub().resolves({ rowCount: 0, rows: [] });
      const mockDBConnection = getMockDBConnection({ sql: sqlStub });
      const submissionFeaturePropertyRepository = new SubmissionFeaturePropertyRepository(mockDBConnection);

      await submissionFeaturePropertyRepository.getSubmissionFeatureProperties(10, {
        page: 1,
        limit: 25,
        order: 'asc'
      });

      const sqlText = sqlStub.firstCall.args[0].text;
      // reference-typed values become structured jsonb objects carrying a display label
      expect(sqlText).to.include('jsonb_build_object');
      expect(sqlText).to.include("'codeset_key', cs.key");
      expect(sqlText).to.include("'code_key', ccc.key");
      expect(sqlText).to.include("'code_label', ccc.label");
      expect(sqlText).to.include('JOIN contributor_codeset cs');
      expect(sqlText).to.include("'taxon_id', t.taxon_id");
      expect(sqlText).to.include("'tsn', t.itis_tsn");
      expect(sqlText).to.include("'rank', t.rank");
      expect(sqlText).to.include("'urn', referenced_sf.urn");
      // scalar values are wrapped so the unioned value column is uniformly jsonb
      expect(sqlText).to.include('to_jsonb(p.value::text)');
      // the derived text label backs server-side search and sort
      expect(sqlText).to.include("COALESCE(value->>'label', value #>> '{}') AS value_text");
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
      expect(sqlText).to.not.include('sf.data');
      expect(sqlText).to.not.include('jsonb_each');
    });
  });
});
