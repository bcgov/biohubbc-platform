import chai, { expect } from 'chai';
import { Knex } from 'knex';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError, ApiGeneralError } from '../errors/api-error';
import { getMockDBConnection } from '../__mocks__/db';
import { SECURITY_APPLIED_STATUS } from './security-repository';
import {
  ISourceTransformModel,
  ISpatialComponentCount,
  ISubmissionModel,
  PatchSubmissionRecord,
  SubmissionFeatureRecord,
  SubmissionRecord,
  SubmissionRecordPublishedForPublic,
  SubmissionRecordWithSecurity,
  SubmissionRepository,
  SUBMISSION_MESSAGE_TYPE,
  SUBMISSION_STATUS_TYPE
} from './submission-repository';

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
      const mockResponse: ISubmissionModel = {
        uuid: '123-456-789'
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
        'submission desc',
        'submission comment',
        3,
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
          'submission desc',
          'submission comment',
          3,
          'source system'
        );
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiExecuteSQLError).message).to.equal('Failed to get or insert submission record');
      }
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
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
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
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
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
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
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
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: null,
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

  describe('getPublishedSubmissionsForAdmins', () => {
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
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
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
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
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

      const response = await submissionRepository.getPublishedSubmissionsForAdmins();

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
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          publish_timestamp: '2023-12-12',
          create_date: '2023-12-12',
          create_user: 1,
          update_date: null,
          update_user: null,
          revision_count: 0,
          security: SECURITY_APPLIED_STATUS.SECURED
        },
        {
          submission_id: 2,
          uuid: '789-456-123',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          create_date: '2023-12-12',
          publish_timestamp: '2023-12-12',
          security: SECURITY_APPLIED_STATUS.PARTIALLY_SECURED,

          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1
        },
        {
          submission_id: 3,
          uuid: '999-456-123',
          security_review_timestamp: '2023-12-12',
          submitted_timestamp: '2023-12-12',
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
          create_date: '2023-12-12',
          publish_timestamp: '2023-12-12',
          create_user: 1,
          update_date: '2023-12-12',
          update_user: 1,
          revision_count: 1,
          security: SECURITY_APPLIED_STATUS.UNSECURED
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
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
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
          system_user_id: 3,
          source_system: 'SIMS',
          name: 'name',
          description: 'description',
          comment: 'comment',
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
        await submissionRepository.insertSubmissionFeatureRecord(1, 2, '321', 'type', feature);
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

      const response = await submissionRepository.insertSubmissionFeatureRecord(1, 2, '321', 'type', feature);

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

  describe('getSubmissionFeatureByUuid', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const submissionFeatureRecord: SubmissionFeatureRecord = {
        submission_feature_id: 2,
        uuid: '234-456-234',
        submission_id: 3,
        feature_type_id: 1,
        source_id: 'source-id',
        data: {},
        parent_submission_feature_id: 1,
        record_effective_date: '2024-01-01',
        record_end_date: null,
        create_date: '2024-01-01',
        create_user: 3,
        update_date: null,
        update_user: null,
        revision_count: 0
      };

      const mockQueryResponse = { rowCount: 1, rows: [submissionFeatureRecord] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionUuid = '123-456-789';

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionFeatureByUuid(submissionUuid);

      expect(response).to.eql(submissionFeatureRecord);
    });
  });

  describe('findSubmissionFeatures', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const submissionFeatureRecords: SubmissionFeatureRecord[] = [
        {
          submission_feature_id: 2,
          uuid: '234-456-234',
          submission_id: 3,
          feature_type_id: 1,
          source_id: 'source-id',
          data: {},
          parent_submission_feature_id: 1,
          record_effective_date: '2024-01-01',
          record_end_date: null,
          create_date: '2024-01-01',
          create_user: 3,
          update_date: null,
          update_user: null,
          revision_count: 0
        }
      ];

      const mockQueryResponse = { rowCount: 1, rows: submissionFeatureRecords } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ knex: () => mockQueryResponse });

      const criteria = {
        submissionId: 1,
        systemUserId: 2,
        featureTypeNames: ['dataset', 'artifact']
      };

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.findSubmissionFeatures(criteria);

      expect(response).to.eql(submissionFeatureRecords);
    });
  });

  describe('getPublishedSubmissions', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed with valid data', async () => {
      const mockResponse: SubmissionRecordPublishedForPublic = {
        submission_id: 1,
        uuid: 'string',
        security_review_timestamp: null,
        publish_timestamp: 'string',
        submitted_timestamp: 'string',
        system_user_id: 3,
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

  describe('getAdminSubmissionFeatureAritifactKey', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails (rowCount 0)', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getAdminSubmissionFeatureArtifactKey({
          isAdmin: true,
          submissionFeatureId: 0,
          submissionFeatureObj: { key: 'a', value: 'b' }
        });
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get key for signed URL');
      }
    });

    it('should throw an error when insert sql fails (missing value property)', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ test: 'blah' }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getAdminSubmissionFeatureArtifactKey({
          isAdmin: true,
          submissionFeatureId: 0,
          submissionFeatureObj: { key: 'a', value: 'b' }
        });
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get key for signed URL');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        value: 'KEY'
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getAdminSubmissionFeatureArtifactKey({
        isAdmin: true,
        submissionFeatureId: 0,
        submissionFeatureObj: { key: 'a', value: 'b' }
      });

      expect(response).to.eql('KEY');
    });
  });

  describe('getSubmissionFeatureAritifactKey', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails (rowCount 0)', async () => {
      const mockQueryResponse = { rowCount: 0 } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionFeatureArtifactKey({
          isAdmin: false,
          submissionFeatureId: 0,
          submissionFeatureObj: { key: 'a', value: 'b' }
        });
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get key for signed URL');
      }
    });

    it('should throw an error when insert sql fails (missing value prop)', async () => {
      const mockQueryResponse = { rowCount: 1, rows: [{ test: 'blah' }] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      try {
        await submissionRepository.getSubmissionFeatureArtifactKey({
          isAdmin: false,
          submissionFeatureId: 0,
          submissionFeatureObj: { key: 'a', value: 'b' }
        });
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to get key for signed URL');
      }
    });

    it('should succeed with valid data', async () => {
      const mockResponse = {
        value: 'KEY'
      };

      const mockQueryResponse = { rowCount: 1, rows: [mockResponse] } as any as Promise<QueryResult<any>>;

      const mockDBConnection = getMockDBConnection({ sql: () => mockQueryResponse });

      const submissionRepository = new SubmissionRepository(mockDBConnection);

      const response = await submissionRepository.getSubmissionFeatureArtifactKey({
        isAdmin: false,
        submissionFeatureId: 0,
        submissionFeatureObj: { key: 'a', value: 'b' }
      });

      expect(response).to.eql('KEY');
    });
  });
});
