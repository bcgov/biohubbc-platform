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
      expect(sqlText).to.include('ORDER BY sort asc NULLS LAST, property ASC, value ASC, id ASC');
      expect(sqlText).to.include("a.artifact_status = 'uploaded'");
      expect(sqlText).to.not.include('sf.data');
      expect(sqlText).to.not.include('jsonb_each');
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
