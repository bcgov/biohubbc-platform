import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError, ApiGeneralError } from '../errors/api-error';
import { EMLFile } from '../utils/media/eml/eml-file';
import { getMockDBConnection } from '../__mocks__/db';
import {
  ISourceTransformModel,
  ISpatialComponentCount,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from './submission-repository';
import { simsHandlebarsTemplate_DETAILS, simsHandlebarsTemplate_HEADER } from './templates/SIMS-handlebar-template';

chai.use(sinonChai);

describe('SubmissionRepository', () => {
  describe('insertSubmissionRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionRecord({ uuid: '', source_transform_id: 1 });
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionRecord({
        uuid: 'uuid',
        source_transform_id: 1
      });

      expect(response.submission_id).to.equal(1);
    });
  });

  describe('updateSubmissionMetadataEMLSource', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when update sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.updateSubmissionMetadataEMLSource(1, 1, {
          emlFile: Buffer.from('')
        } as unknown as EMLFile);

        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to update submission Metadata source');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_metadata_id: 1 }] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionMetadataEMLSource(1, 1, {
        emlFile: Buffer.from('')
      } as unknown as EMLFile);

      expect(response.submission_metadata_id).to.equal(1);
    });
  });

  describe('updateSubmissionMetadataEMLJSONSource', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when update sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);
      try {
        await submissionRepository.updateSubmissionMetadataEMLJSONSource(1, 1, 'string');

        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to update submission Metadata eml json');
      }
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_metadata_id: 1 }] } as any as Promise<
        QueryResult<any>
      >;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionMetadataEMLJSONSource(1, 1, 'string');

      expect(response.submission_metadata_id).to.equal(1);
    });
  });

  describe('getSubmissionRecordBySubmissionId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionRecordBySubmissionId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        source_transform_id: 'test',
        input_file_name: 'test',
        input_key: 'test',
        record_effective_date: 'test',
        eml_source: 'test',
        darwin_core_source: 'test',
        uuid: 'test'
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionRecordBySubmissionId(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getSubmissionIdByRecordByUUID', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ submission_id: 1 }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionIdByUUID('test_uuid');

      expect(response?.submission_id).to.equal(1);
    });

    it('should return null', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionIdByUUID('test_uuid');

      expect(response).to.be.null;
    });
  });

  describe('getSubmissionRecordEMLJSONByDatasetId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return a query result', async () => {
      const mockQueryResponse = { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionRecordEMLJSONByDatasetId('111-222-333');

      expect(response).to.equal(mockQueryResponse);
    });
  });

  describe('getSpatialComponentCountByDatasetId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse = [{ spatial_type: 'occurrence', count: 10 }] as ISpatialComponentCount[];

      const mockQueryResponse = {
        rowCount: 1,
        rows: mockResponse
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSpatialComponentCountByDatasetId('111-222-333');

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getSourceTransformRecordBySystemUserId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSourceTransformRecordBySystemUserId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission source transform record');
      }
    });

    it('should succeed with valid data, without optional version parameter', async () => {
      const mockResponse = {
        source_transform_id: 1
      } as unknown as ISourceTransformModel;

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSourceTransformRecordBySystemUserId(1);

      expect(response).to.eql(mockResponse);
    });

    it('should succeed with valid data, with optional version parameter', async () => {
      const mockResponse = {
        source_transform_id: 1
      } as unknown as ISourceTransformModel;

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSourceTransformRecordBySystemUserId(1, 'v1');

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getSubmissionMetadataJson', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ query: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionMetadataJson(1, 'transform sql');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to transform submission eml to json');
      }
    });

    it('should succeed with valid data, without optional version parameter', async () => {
      const mockResponse = {
        result_data: 'transformed eml'
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ query: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionMetadataJson(1, 'transform sql');

      expect(response).to.eql('transformed eml');
    });
  });

  describe('getSourceTransformRecordBySourceTransformId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSourceTransformRecordBySourceTransformId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission source transform record');
      }
    });

    it('should succeed with valid data, without optional version parameter', async () => {
      const mockResponse = {
        source_transform_id: 1
      } as unknown as ISourceTransformModel;

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSourceTransformRecordBySourceTransformId(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('insertSubmissionStatus', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionStatus(1, SUBMISSION_STATUS_TYPE.INGESTED);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission status record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_status_id: 1,
        submission_status_type_id: 2
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionStatus(1, SUBMISSION_STATUS_TYPE.INGESTED);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('insertSubmissionMessage', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionMessage(1, SUBMISSION_MESSAGE_TYPE.ERROR, 'some message');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission message record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_status_id: 1,
        submission_message_type_id: 2
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({
        sql: () => mockQueryResponse
      });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionMessage(1, SUBMISSION_MESSAGE_TYPE.ERROR, '');

      expect(response).to.eql(mockResponse);
    });
  });

  describe('insertSubmissionRecordWithPotentialConflict', () => {
    it('should insert or retrieve a submission successfully', async () => {
      const mockQueryResponse = {
        rowCount: 1,
        rows: [
          {
            uuid: 'aaaa',
            source_transform_id: 1,
            submission_id: 20
          }
        ]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionRecordWithPotentialConflict('aaaa');

      expect(response).to.eql({
        uuid: 'aaaa',
        source_transform_id: 1,
        submission_id: 20
      });
    });

    it('should throw an error', async () => {
      const mockQueryResponse = { rowCount: 0, rows: undefined } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionRecordWithPotentialConflict('aaaa');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiExecuteSQLError).message).to.equal('Failed to get or insert submission record');
      }
    });
  });

  describe('listSubmissionRecords', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_status: 'Submission Data Ingested',
        submission_id: 1,
        source_transform_id: 'SIMS',
        uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
        record_effective_date: '2022-05-24T18:41:42.211Z',
        delete_timestamp: null,
        input_key: 'biohub/1/moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
        input_file_name: 'moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
        eml_source: null,
        eml_json_source: null,
        darwin_core_source: 'test',
        create_date: '2022-05-24T18:41:42.056Z',
        create_user: 15,
        update_date: '2022-05-24T18:41:42.056Z',
        update_user: 15,
        revision_count: 1
      };
      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.listSubmissionRecords();

      expect(response).to.eql([mockResponse]);
    });
  });

  describe('getSourceTransformRecordBySubmissionId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSourceTransformRecordBySubmissionId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission source transform record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        source_transform_id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSourceTransformRecordBySubmissionId(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getSubmissionJobQueue', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionJobQueue(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal(
          'Failed to get submission job queue from submission id'
        );
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionJobQueue(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('insertSubmissionMetadataRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const submissionData = { submission_id: 1, eml_source: '', eml_json_source: '' };

      try {
        await submissionRepository.insertSubmissionMetadataRecord(submissionData);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission metadata record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const submissionData = { submission_id: 1, eml_source: '', eml_json_source: '' };

      const response = await submissionRepository.insertSubmissionMetadataRecord(submissionData);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('insertSubmissionObservationRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const submissionData = {
        submission_id: 1,
        darwin_core_source: '',
        submission_security_request: '',
        foi_reason: ''
      };
      try {
        await submissionRepository.insertSubmissionObservationRecord(submissionData);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission observation record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const submissionData = {
        submission_id: 1,
        darwin_core_source: '',
        submission_security_request: '',
        foi_reason: ''
      };

      const response = await submissionRepository.insertSubmissionObservationRecord(submissionData);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('updateSubmissionMetadataRecordEndDate', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionMetadataRecordEndDate(1);

      expect(response).to.eql(1);
    });
  });

  describe('updateSubmissionMetadataRecordEffectiveDate', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.updateSubmissionMetadataRecordEffectiveDate(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal(
          'Failed to update record_effective_timestamp submission metadata record'
        );
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionMetadataRecordEffectiveDate(1);

      expect(response).to.eql(1);
    });
  });

  describe('updateSubmissionObservationRecordEndDate', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionObservationRecordEndDate(1);

      expect(response).to.eql(1);
    });
  });

  describe('updateSubmissionMetadataWithSearchKeys', () => {
    beforeEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.updateSubmissionMetadataWithSearchKeys(1, '');

      expect(response).to.eql(1);
    });
  });

  describe('getArtifactForReviewCountForSubmissionUUID', () => {
    beforeEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        dataset_id: 'UUID',
        submission_id: 1,
        artifacts_to_review: 1,
        last_updated: '2023-05-25'
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getArtifactForReviewCountForSubmissionUUID('');

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getDatasetsForReview', () => {
    beforeEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse = [
        {
          dataset_id: 'UUID',
          submission_id: 1,
          submitter_system: 'sims',
          dataset_name: 'Project Name',
          keywords: [],
          related_projects: []
        }
      ];

      const mockQueryResponse = { rowCount: 1, rows: mockResponse } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getDatasetsForReview(['']);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getHandleBarsTemplateByDatasetId', () => {
    beforeEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        header: simsHandlebarsTemplate_HEADER,
        details: simsHandlebarsTemplate_DETAILS
      };
      const mockDBConnection = getMockDBConnection();

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getHandleBarsTemplateByDatasetId('uuid');

      expect(response).to.eql(mockResponse);
    });
  });
});
