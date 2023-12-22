import chai, { expect } from 'chai';
import { Knex } from 'knex';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError, ApiGeneralError } from '../errors/api-error';
import { EMLFile } from '../utils/media/eml/eml-file';
import { getMockDBConnection } from '../__mocks__/db';
import { SECURITY_APPLIED_STATUS } from './security-repository';
import {
  ISourceTransformModel,
  ISpatialComponentCount,
  PatchSubmissionRecord,
  SubmissionRecord,
  SubmissionRecordPublished,
  SubmissionRecordWithSecurity,
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
        rows: [{ submission_id: 20 }]
      } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.insertSubmissionRecordWithPotentialConflict(
        '123-456-789',
        'submission name',
        'source system'
      );

      expect(response).to.eql({ submission_id: 20 });
    });

    it('should throw an error', async () => {
      const mockQueryResponse = { rowCount: 0, rows: undefined } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.insertSubmissionRecordWithPotentialConflict(
          '123-456-789',
          'submission name',
          'source system'
        );
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

  describe('getUnreviewedSubmissionsForAdmins', () => {
    beforeEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockSubmissionRecords: SubmissionRecord[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          security_review_timestamp: null,
          submitted_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security_review_timestamp: null,
          submitted_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1
        }
      ];

      const mockResponse = { rowCount: 2, rows: mockSubmissionRecords } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getUnreviewedSubmissionsForAdmins();

      expect(response).to.eql(mockSubmissionRecords);
    });
  });

  describe('getReviewedSubmissionsForAdmins', () => {
    beforeEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockSubmissionRecords: SubmissionRecord[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1
        }
      ];

      const mockResponse = { rowCount: 2, rows: mockSubmissionRecords } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getReviewedSubmissionsForAdmins();

      expect(response).to.eql(mockSubmissionRecords);
    });
  });

  describe('getReviewedSubmissionsWithSecurity', () => {
    beforeEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockSubmissionRecords: SubmissionRecordWithSecurity[] = [
        {
          submission_id: 1,
          uuid: '123-456-789',
          security: SECURITY_APPLIED_STATUS.SECURED,
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security: SECURITY_APPLIED_STATUS.PARTIALLY_SECURED,
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          create_date: '2023-12-12',
          publish_timestamp: '2023-12-12',

          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1
        },
        {
          submission_id: 3,
          security: SECURITY_APPLIED_STATUS.UNSECURED,
          uuid: '999-456-123',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          create_date: '2023-12-12',
          publish_timestamp: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1
        }
      ];

      const mockResponse = { rowCount: 2, rows: mockSubmissionRecords } as unknown as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: async () => mockResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getReviewedSubmissionsForAdmins();

      expect(response).to.eql(mockSubmissionRecords);
    });
  });

  describe('getMessages', () => {
    beforeEach(() => {
      sinon.restore();
    });

    it('should get messages', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ message: 'message' }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getMessages(1);

      expect(response).to.eql([{ message: 'message' }]);
    });
  });

  describe('createMessages', () => {
    beforeEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockMessages = [
        {
          submission_id: 1,
          submission_message_type_id: 2,
          label: 'label1',
          message: 'message1',
          data: null
        },
        {
          submission_id: 2,
          submission_message_type_id: 3,
          label: 'label2',
          message: 'message2',
          data: {
            dataField: 'dataField'
          }
        }
      ];

      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.createMessages(mockMessages);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to create submission messages');
      }
    });

    it('should create messages and return void', async () => {
      const mockMessages = [
        {
          submission_id: 1,
          submission_message_type_id: 2,
          label: 'label1',
          message: 'message1',
          data: null
        },
        {
          submission_id: 2,
          submission_message_type_id: 3,
          label: 'label2',
          message: 'message2',
          data: {
            dataField: 'dataField'
          }
        }
      ];

      const mockQueryResponse = { rowCount: 2, rows: [] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.createMessages(mockMessages);

      expect(response).to.be.undefined;
    });
  });

  describe('patchSubmissionRecord', () => {
    beforeEach(() => {
      sinon.restore();
    });

    describe('generates the correct sql for each combination of patch parameters', () => {
      const setReviewNow = 'CASE WHEN security_review_timestamp IS NULL THEN NOW() ELSE security_review_timestamp END';
      const setReviewNull =
        'CASE WHEN security_review_timestamp IS NOT NULL THEN NULL ELSE security_review_timestamp END';
      const setPublishNow = 'CASE WHEN publish_timestamp IS NULL THEN NOW() ELSE publish_timestamp END';
      const setPublishNull = 'CASE WHEN publish_timestamp IS NOT NULL THEN NULL ELSE publish_timestamp END';

      const mockResponse = { rowCount: 1, rows: [{}] } as unknown as Promise<QueryResult<any>>;

      const knexStub: sinon.SinonStub = sinon.stub().resolves(mockResponse);

      const mockDBConnection = getMockDBConnection({ knex: knexStub });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      beforeEach(() => {
        knexStub.resetHistory();
      });

      it('{ security_reviewed: true }', async () => {
        const patch: PatchSubmissionRecord = { security_reviewed: true };

        await submissionRepository.patchSubmissionRecord(1, patch);

        const queryBuilder = knexStub.getCall(0).firstArg as Knex.QueryBuilder;
        const sqlString = queryBuilder.toSQL().toNative().sql;

        expect(sqlString).to.include(setReviewNow);
      });

      it('{ security_reviewed: false }', async () => {
        const patch: PatchSubmissionRecord = { security_reviewed: false };

        await submissionRepository.patchSubmissionRecord(1, patch);

        const queryBuilder = knexStub.getCall(0).firstArg as Knex.QueryBuilder;
        const sqlString = queryBuilder.toSQL().toNative().sql;

        expect(sqlString).to.include(setReviewNull);
      });

      it('{ security_reviewed: true, published: undefined }', async () => {
        const patch: PatchSubmissionRecord = { security_reviewed: true, published: undefined };

        await submissionRepository.patchSubmissionRecord(1, patch);

        const queryBuilder = knexStub.getCall(0).firstArg as Knex.QueryBuilder;
        const sqlString = queryBuilder.toSQL().toNative().sql;

        expect(sqlString).to.include(setReviewNow);
      });

      it('{ security_reviewed: false, published: undefined }', async () => {
        const patch: PatchSubmissionRecord = { security_reviewed: false, published: undefined };

        await submissionRepository.patchSubmissionRecord(1, patch);

        const queryBuilder = knexStub.getCall(0).firstArg as Knex.QueryBuilder;
        const sqlString = queryBuilder.toSQL().toNative().sql;

        expect(sqlString).to.include(setReviewNull);
      });

      it('{ published: true }', async () => {
        const patch: PatchSubmissionRecord = { published: true };

        await submissionRepository.patchSubmissionRecord(1, patch);

        const queryBuilder = knexStub.getCall(0).firstArg as Knex.QueryBuilder;
        const sqlString = queryBuilder.toSQL().toNative().sql;

        expect(sqlString).to.include(setPublishNow);
      });

      it('{ published: false }', async () => {
        const patch: PatchSubmissionRecord = { published: false };

        await submissionRepository.patchSubmissionRecord(1, patch);

        const queryBuilder = knexStub.getCall(0).firstArg as Knex.QueryBuilder;
        const sqlString = queryBuilder.toSQL().toNative().sql;

        expect(sqlString).to.include(setPublishNull);
      });

      it('{ security_reviewed: undefined, published: true }', async () => {
        const patch: PatchSubmissionRecord = { security_reviewed: undefined, published: true };

        await submissionRepository.patchSubmissionRecord(1, patch);

        const queryBuilder = knexStub.getCall(0).firstArg as Knex.QueryBuilder;
        const sqlString = queryBuilder.toSQL().toNative().sql;

        expect(sqlString).to.include(setPublishNow);
      });

      it('{ security_reviewed: undefined, published: false }', async () => {
        const patch: PatchSubmissionRecord = { security_reviewed: undefined, published: false };

        await submissionRepository.patchSubmissionRecord(1, patch);

        const queryBuilder = knexStub.getCall(0).firstArg as Knex.QueryBuilder;
        const sqlString = queryBuilder.toSQL().toNative().sql;

        expect(sqlString).to.include(setPublishNull);
      });

      it('{ security_reviewed: true, published: true }', async () => {
        const patch: PatchSubmissionRecord = { security_reviewed: true, published: true };

        await submissionRepository.patchSubmissionRecord(1, patch);

        const queryBuilder = knexStub.getCall(0).firstArg as Knex.QueryBuilder;
        const sqlString = queryBuilder.toSQL().toNative().sql;

        expect(sqlString).to.include(setReviewNow);
        expect(sqlString).to.include(setPublishNow);
      });

      it('{ security_reviewed: false, published: false }', async () => {
        const patch: PatchSubmissionRecord = { security_reviewed: false, published: false };

        await submissionRepository.patchSubmissionRecord(1, patch);

        const queryBuilder = knexStub.getCall(0).firstArg as Knex.QueryBuilder;
        const sqlString = queryBuilder.toSQL().toNative().sql;

        expect(sqlString).to.include(setReviewNull);
        expect(sqlString).to.include(setPublishNull);
      });
    });

    describe('if the patch results in changes to the record', () => {
      it('should patch the record and return the updated record', async () => {
        const submissionId = 1;

        const patch: PatchSubmissionRecord = { security_reviewed: true };

        const mockSubmissionRecord: SubmissionRecord = {
          submission_id: 1,
          uuid: '123-456-789',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        };

        // rowCount = 1 indicating one row was updated
        const mockResponse = { rowCount: 1, rows: [mockSubmissionRecord] } as unknown as Promise<QueryResult<any>>;

        const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

        const submissionRepository = new SubmissionRepository(mockDBConnection);

        const response = await submissionRepository.patchSubmissionRecord(submissionId, patch);

        expect(response).to.eql(mockSubmissionRecord);
      });
    });

    describe('if the patch results in no changes to the record', () => {
      it('should patch the record (having no effect) and return the unchanged record', async () => {
        const submissionId = 1;

        const patch: PatchSubmissionRecord = { security_reviewed: false };

        const mockSubmissionRecord: SubmissionRecord = {
          submission_id: 1,
          uuid: '123-456-789',
          security_review_timestamp: null,
          submitted_timestamp: '2023-12-12',
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0
        };

        // rowCount = 0 indicating no rows were updated
        const mockResponse = { rowCount: 0, rows: [mockSubmissionRecord] } as unknown as Promise<QueryResult<any>>;

        const mockDBConnection = getMockDBConnection({ knex: async () => mockResponse });

        const submissionRepository = new SubmissionRepository(mockDBConnection);

        const response = await submissionRepository.patchSubmissionRecord(submissionId, patch);

        expect(response).to.eql(mockSubmissionRecord);
      });
    });
  });

  describe('insertSubmissionFeatureRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const feature = {
        id: '',
        type: '',
        properties: {}
      };
      try {
        await submissionRepository.insertSubmissionFeatureRecord(1, 1, feature);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to insert submission feature record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const feature = {
        id: '',
        type: '',
        properties: {}
      };

      const response = await submissionRepository.insertSubmissionFeatureRecord(1, 1, feature);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getFeatureTypeIdByName', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getFeatureTypeIdByName('name');
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get feature type record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        feature_type_id: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getFeatureTypeIdByName('name');

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getSubmissionFeaturesBySubmissionId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionFeaturesBySubmissionId(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission feature record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        feature_type_name: 'name',
        feature_type_display_name: 'display',
        submission_feature_security_ids: [1]
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionFeaturesBySubmissionId(1);

      expect(response).to.eql([mockResponse]);
    });
  });

  describe('getSubmissionRecordBySubmissionIdWithSecurity', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionRecordBySubmissionIdWithSecurity(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal(
          'Failed to get submission record with security status'
        );
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        feature_type_name: 'name',
        feature_type_display_name: 'display',
        submission_feature_security_ids: [1]
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionRecordBySubmissionIdWithSecurity(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('getPublishedSubmissions', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse: SubmissionRecordPublished = {
        submission_id: 1,
        uuid: 'string',
        security_review_timestamp: null,
        publish_timestamp: 'string',
        submitted_timestamp: 'string',
        source_system: 'string',
        name: 'string',
        description: null,
        create_date: 'string',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 1,
        security: SECURITY_APPLIED_STATUS.SECURED,
        root_feature_type_id: 1,
        root_feature_type_name: 'type',
        root_feature_type_display_name: 'Type'
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getPublishedSubmissions();

      expect(response).to.eql([mockResponse]);
    });
  });

  describe('getSubmissionRootFeature', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionRootFeature(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get root submission feature record');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_id: 1,
        uuid: 'string',
        security_review_timestamp: null,
        submitted_timestamp: 'string',
        source_system: 'string',
        name: 'string',
        description: null,
        create_date: 'string',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionRootFeature(1);

      expect(response).to.eql(mockResponse);
    });
  });

  describe('downloadSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.downloadSubmission(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission with associated features');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_feature_id: 1,
        parent_submission_feature_id: null,
        feature_type_name: 'string',
        data: {},
        level: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.downloadSubmission(1);

      expect(response).to.eql([mockResponse]);
    });
  });

  describe('downloadPublishedSubmission', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.downloadPublishedSubmission(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get submission with associated features');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        submission_feature_id: 1,
        parent_submission_feature_id: null,
        feature_type_name: 'string',
        data: {},
        level: 1
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.downloadPublishedSubmission(1);

      expect(response).to.eql([mockResponse]);
    });
  });
});
