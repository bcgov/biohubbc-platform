import { Client } from '@elastic/elasticsearch';
import { WriteResponseBase } from '@elastic/elasticsearch/lib/api/types';
import { S3 } from 'aws-sdk';
import chai, { expect } from 'chai';
import { describe } from 'mocha';
import { QueryResult } from 'pg';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ApiExecuteSQLError, ApiGeneralError } from '../errors/api-error';
import {
  ISourceTransformModel,
  ISubmissionJobQueueRecord,
  ISubmissionModel,
  SUBMISSION_STATUS_TYPE
} from '../repositories/submission-repository';
import * as fileUtils from '../utils/file-utils';
import { CSVWorksheet } from '../utils/media/csv/csv-file';
import * as dwcUtils from '../utils/media/dwc/dwc-archive-file';
import { DWCArchive } from '../utils/media/dwc/dwc-archive-file';
import { ArchiveFile, MediaFile } from '../utils/media/media-file';
import * as mediaUtils from '../utils/media/media-utils';
import { getMockDBConnection } from '../__mocks__/db';
import { DarwinCoreService } from './dwc-service';
import { ElasticSearchIndices, ESService } from './es-service';
import { SpatialService } from './spatial-service';
import { SubmissionService } from './submission-service';
import { EMLService } from './eml-service';

chai.use(sinonChai);

describe('DarwinCoreService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('intakeJob', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);

      const mediaFileStub = sinon.createStubInstance(MediaFile);
      const bufferStub = sinon.createStubInstance(Buffer);
      bufferStub.toString.returns(
        '<?xml version="1.0" encoding="UTF-8"?><eml:eml packageId="urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f"></eml:eml>'
      );
      mediaFileStub.buffer = bufferStub as unknown as Buffer;

      const mockDWCAFile = {
        submission_id: 1,
        eml: {
          emlFile: mediaFileStub
        },
        worksheets: {}
      } as unknown as DWCArchive;
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const step1 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_1').resolves({ submission_metadata_id: 1 });
      const step2 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_2').resolves(mockDWCAFile);
      const step3 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_3').resolves();
      const step4 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_4').resolves();
      const step5 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_5').resolves();
      const step6 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_6').resolves();
      const step7 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_7').resolves({submission_observation_id: 1});
      const step8 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_8').resolves();
      const step9 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_9').resolves({});
      const step10 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_10').resolves();
      const step11 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_11').resolves();
      const step12 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_12').resolves();
      const step13 = sinon.stub(DarwinCoreService.prototype, 'intakeJob_step_13').resolves();
      const submissionStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();

      await service.intakeJob(mockJobQueue);

      expect(step1).to.be.calledOnce;
      expect(step2).to.be.calledOnce;
      expect(step3).to.be.calledOnce;
      expect(step4).to.be.calledOnce;
      expect(step5).to.be.calledOnce;
      expect(step6).to.be.calledOnce;
      expect(step7).to.be.calledOnce;
      expect(step8).to.be.calledOnce;
      expect(step9).to.be.calledOnce;
      expect(step10).to.be.calledOnce;
      expect(step11).to.be.calledOnce;
      expect(step12).to.be.calledOnce;
      expect(step13).to.be.calledOnce;
      expect(submissionStatus).to.be.calledOnce;
    });
  });

  describe('intakeJob_step_1', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should insert metadata record', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return { rowCount: 1, rows: [{ submission_metadata_id: 1 }] } as any as Promise<QueryResult<any>>;
        }
      });
      const service = new DarwinCoreService(mockDBConnection);

      const response = await service.intakeJob_step_1(1);
      expect(response).to.be.eql({ submission_metadata_id: 1 });
    });

    it('should fail with `Inserting new Metadata record` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      sinon.stub(SubmissionService.prototype, 'insertSubmissionMetadataRecord').throws();
      const errorInsert = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_1(1);
      } catch (error) {
        expect(errorInsert).to.be.calledOnce;
        expect((error as ApiGeneralError).message).to.equal('Inserting new Metadata record');
      }
    });
  });

  describe('intakeJob_step_2', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return DWCArchive', async () => {
      const mockDBConnection = getMockDBConnection();
      const dwcArchive = {
        eml: {
          buffer: Buffer.from('test')
        },
        worksheets: {
          test1: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet,
          test2: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet
        }
      } as unknown as DWCArchive;

      const service = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        submission_id: 1,
        source_transform_id: 3,
        uuid: 'uuid'
      });
      const metadata = sinon
        .stub(SubmissionService.prototype, 'updateSubmissionMetadataEMLSource')
        .resolves({ submission_metadata_id: 1 });

      sinon.stub(DarwinCoreService.prototype, 'getAndPrepFileFromS3').resolves(dwcArchive);
      const response = await service.intakeJob_step_2(
        {
          submission_job_queue_id: 1,
          submission_id: 1,
          job_start_timestamp: null,
          job_end_timestamp: null,
          key: 's3 path'
        } as unknown as ISubmissionJobQueueRecord,
        1
      );

      expect(response).to.be.eql(dwcArchive);
      expect(metadata).to.be.calledOnce;
    });

    it('should throw `File eml is empty` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const dwcArchive = {
        eml: undefined,
        worksheets: {
          test1: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet,
          test2: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet
        }
      } as unknown as DWCArchive;

      const service = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        submission_id: 1,
        source_transform_id: 3,
        uuid: 'uuid'
      });
      const metadata = sinon
        .stub(SubmissionService.prototype, 'updateSubmissionMetadataEMLSource')
        .resolves({ submission_metadata_id: 1 });
      sinon.stub(DarwinCoreService.prototype, 'getAndPrepFileFromS3').resolves(dwcArchive);
      const insertStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_2(
          {
            submission_job_queue_id: 1,
            submission_id: 1,
            job_start_timestamp: null,
            job_end_timestamp: null,
            key: 's3 key'
          } as unknown as ISubmissionJobQueueRecord,
          1
        );
      } catch (error) {
        expect(insertStatus).to.be.calledOnce;
        expect(metadata).not.to.be.called;
        expect((error as ApiGeneralError).errors).to.equal('Accessing S3 File, file eml is empty');
      }
    });

    it('should throw `No S3 Key` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const dwcArchive = {
        eml: undefined,
        worksheets: {
          test1: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet,
          test2: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet
        }
      } as unknown as DWCArchive;

      const service = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        submission_id: 1,
        source_transform_id: 3,
        uuid: 'uuid'
      });
      const metadata = sinon
        .stub(SubmissionService.prototype, 'updateSubmissionMetadataEMLSource')
        .resolves({ submission_metadata_id: 1 });
      sinon.stub(DarwinCoreService.prototype, 'getAndPrepFileFromS3').resolves(dwcArchive);
      const insertStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_2(
          {
            submission_job_queue_id: 1,
            submission_id: 1,
            job_start_timestamp: null,
            job_end_timestamp: null,
            key: ''
          } as unknown as ISubmissionJobQueueRecord,
          1
        );
      } catch (error) {
        expect(insertStatus).to.be.calledOnce;
        expect(metadata).not.to.be.called;
        expect((error as ApiGeneralError).errors).to.equal('No S3 Key given');
      }
    });

    it('should throw `Accessing S3 File` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const dwcArchive = {
        eml: {
          buffer: Buffer.from('test')
        },
        worksheets: {
          test1: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet,
          test2: {
            getRowObjects: () => {
              return [
                { id: 1, name: 'test' },
                { id: 2, name: 'test' }
              ];
            }
          } as unknown as CSVWorksheet
        }
      } as unknown as DWCArchive;

      const service = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').throws();
      const metadata = sinon.stub(SubmissionService.prototype, 'updateSubmissionMetadataEMLSource').resolves();
      sinon.stub(DarwinCoreService.prototype, 'getAndPrepFileFromS3').resolves(dwcArchive);
      const insertStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_2(
          {
            submission_job_queue_id: 1,
            submission_id: 1,
            job_start_timestamp: null,
            job_end_timestamp: null
          } as unknown as ISubmissionJobQueueRecord,
          1
        );
      } catch (error) {
        expect(insertStatus).to.be.calledOnce;
        expect(metadata).not.to.be.called;
        expect((error as ApiGeneralError).message).to.equal('Accessing S3 File and Updating new Metadata record');
        // checking for another error in the flow
        expect((error as ApiGeneralError).errors).not.to.equal('Accessing S3 File, file eml is empty');
      }
    });
  });

  describe('intakeJob_step_3', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);


      const emlXMLString =
        '<?xml version="1.0" encoding="UTF-8"?><eml:eml packageId="urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f"></eml:eml>';


      const mockDWCAFile = {
        submission_id: 1,
        eml: {
          emlFile: {
            buffer: {
              toString: () => emlXMLString
            }
          }
        },
        worksheets: {}
      } as unknown as DWCArchive;

      const response = await service.intakeJob_step_3(1, mockDWCAFile);
      const result: Record<string, any> = {'?xml': { '@_version': '1.0', '@_encoding': 'UTF-8' },'eml:eml': { '@_packageId': 'urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f' }}

      expect(response).to.deep.equal(result)
    });

    it('should throw `file eml is empty` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockDWCAFile = {
        submission_id: 1,
        eml: undefined,
        worksheets: {}
      } as unknown as DWCArchive;

      const insertStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_3(1, mockDWCAFile);
        expect.fail();
      } catch (error) {
        expect(insertStatus).to.be.calledOnce;
        expect((error as ApiGeneralError).errors).to.equal('file eml is empty');
      }
    });

    it('should throw `Converting EML to JSON` error', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
        }
      });
      const service = new DarwinCoreService(mockDBConnection);
      const mediaFileStub = sinon.createStubInstance(MediaFile);
      const bufferStub = sinon.createStubInstance(Buffer);
      bufferStub.toString.returns(
        '<?xml version="1.0" encoding="UTF-8"?><eml:eml packageId="urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f"></eml:eml>'
      );

      mediaFileStub.buffer = bufferStub as unknown as Buffer;

      const mockDWCAFile = {
        submission_id: 1,
        eml: {
          emlFile: mediaFileStub
        },
        worksheets: {}
      } as unknown as DWCArchive;
      sinon.stub(EMLService.prototype, 'convertXMLStringToJSObject').throws()
      const insertStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_3(1, mockDWCAFile);
        expect.fail();
      } catch (error) {
        expect(insertStatus).to.be.calledOnce;
        expect((error as ApiGeneralError).message).to.equal('Converting EML to JSON');
      }
    });
  });

  describe('intakeJob_step_4', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const update = sinon.stub(SubmissionService.prototype, 'updateSubmissionRecordEMLJSONSource').resolves()

      await service.intakeJob_step_4(1, 1, {});

      expect(update).to.be.calledOnce;
    });

    it('should throw a `Storing eml JSON data`', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
        }
      });
      const service = new DarwinCoreService(mockDBConnection);
      const insertStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_4(1, 1, {});
      } catch (error) {
        expect(insertStatus).to.be.calledOnce;
        expect((error as ApiGeneralError).message).to.equal('Storing eml JSON data');
      }
    });
  })

  describe('intakeJob_step_5', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const mediaFileStub = sinon.createStubInstance(MediaFile);
      const bufferStub = sinon.createStubInstance(Buffer);

      bufferStub.toString.returns(
        '<?xml version="1.0" encoding="UTF-8"?><eml:eml packageId="urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f"></eml:eml>'
      );

      mediaFileStub.buffer = bufferStub as unknown as Buffer;

      const mockDWCAFile = {
        submission_id: 1,
        eml: {
          emlFile: mediaFileStub
        },
        worksheets: {},
        normalize: () => 'normalized data'
      } as unknown as DWCArchive;
      const service = new DarwinCoreService(mockDBConnection);
      const response = await service.intakeJob_step_5(mockDWCAFile);
      expect(response).to.be.eql('normalized data');
    });
  })

  describe('intakeJob_step_6', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const updateEndDate = sinon.stub(SubmissionService.prototype, 'updateSubmissionMetadataRecordEndDate').resolves();
      const updateEffectiveDate = sinon.stub(SubmissionService.prototype, 'updateSubmissionMetadataRecordEffectiveDate').resolves();
      const updateObservationEndDate = sinon.stub(DarwinCoreService.prototype, 'updateSubmissionObservationEndTimestamp').resolves();
      const insertStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      await service.intakeJob_step_6(mockJobQueue);

      expect(updateEndDate).to.be.called;
      expect(updateEffectiveDate).to.be.called;
      expect(updateObservationEndDate).to.be.called;
      expect(insertStatus).to.not.be.called;
    });

    it('should throw `Update Submission` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const updateEndDate = sinon.stub(SubmissionService.prototype, 'updateSubmissionMetadataRecordEndDate').rejects();
      const updateEffectiveDate = sinon.stub(SubmissionService.prototype, 'updateSubmissionMetadataRecordEffectiveDate').resolves();
      const updateObservationEndDate = sinon.stub(DarwinCoreService.prototype, 'updateSubmissionObservationEndTimestamp').resolves();
      const insertStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_6(mockJobQueue);
        expect.fail();
      } catch (error: any) {
        expect(updateEndDate).to.be.called;
        expect(updateEffectiveDate).to.not.be.called;
        expect(updateObservationEndDate).to.not.be.called;
        expect(insertStatus).to.be.called;

        expect((error as ApiGeneralError).message).to.equal('Update Submission dates');
      }
    });
  });

  describe('intakeJob_step_7', () => {
    afterEach(() => {
      sinon.restore();
    });
    
    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;
      
      const insert = sinon
        .stub(DarwinCoreService.prototype, 'insertSubmissionObservationRecord')
        .resolves({ submission_observation_id: 1 });

        const response = await service.intakeJob_step_7(mockJobQueue, 'normalized json');
        expect(insert).to.be.calledOnce;
        expect(response.submission_observation_id).to.eq(1);
    });

    it('should throw `Inserting Observation JSON`', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
        }
      });
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const insert = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage')
          .resolves();
  
      try {
        
        await service.intakeJob_step_7(mockJobQueue, 'normalized json');
        expect.fail()
      } catch (error: any) {
        expect(insert).to.be.calledTwice;
        expect(error.message).to.eq('Inserting Observation JSON');
      }
    });
  });

  describe('intakeJob_step_8', async () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;
      const submissionObservationId = 2;

      const transform = sinon.stub(SpatialService.prototype, 'runSpatialTransforms').resolves();
      const status = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      await service.intakeJob_step_8(mockJobQueue, submissionObservationId);

      expect(transform).to.be.calledOnceWith(mockJobQueue.submission_id, submissionObservationId);
      expect(status).to.be.calledOnceWith(
        mockJobQueue.submission_id,
        SUBMISSION_STATUS_TYPE.SPATIAL_TRANSFORM_UNSECURE
      );
      expect(insertErrorStatus).to.not.be.called;
    });

    it('should throw `Spatial transform` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const transform = sinon.stub(DarwinCoreService.prototype, 'runSpatialTransforms').throws();
      const status = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_8(mockJobQueue, 1);
        expect.fail();
      } catch (error) {
        expect(transform).to.be.calledOnce;
        expect(status).to.not.be.called;
        expect(insertErrorStatus).to.be.calledOnce;
        expect((error as ApiGeneralError).message).to.equal('Spatial transform');
      }
    });
  });

  describe('intakeJob_step_9', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const decorate = sinon.stub(EMLService.prototype, 'decorateEML').resolves({
        '?xml': {
          '@_encoding': 'UTF-8',
          '@_version': '1.0'
        },
        'eml:eml': {
          '@_packageId': 'urn:uuid:0cf8169f-b159-4ef9-bd43-93348bdc1e9f'
        }
      });

      await service.intakeJob_step_9({});
      expect(decorate).to.be.calledOnce;
    })

    it('should throw `EML Decoration` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      sinon.stub(EMLService.prototype, 'decorateEML').throws();
      // const insertError = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_9({});
        expect.fail();
      } catch (error: any) {
        // expect(insertError).to.be.calledOnce;
        expect(error.message).to.eql('EML Decoration');
      }
    })
  })

  describe('intakeJob_step_10', async () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const update = sinon.stub(SubmissionService.prototype, 'updateSubmissionRecordEMLJSONSource').resolves()

      await service.intakeJob_step_10(1, 1, {});

      expect(update).to.be.calledOnce;
    });

    it('should throw a `Updating Record EML` error', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: async () => {
          return { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
        }
      });
      const service = new DarwinCoreService(mockDBConnection);
      const insertStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_10(1, 1, {});
      } catch (error) {
        expect(insertStatus).to.be.calledOnce;
        expect((error as ApiGeneralError).message).to.equal('Updating Record EML');
      }
    });
  })

  describe('intakeJob_step_11', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;
      const transform = sinon.stub(DarwinCoreService.prototype, 'transformAndUploadMetaData').resolves();
      await service.intakeJob_step_11(mockJobQueue)

      expect(transform).to.be.calledOnce;
    })

    it('should throw `Transforming and uploading metadata` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;
      sinon.stub(DarwinCoreService.prototype, 'transformAndUploadMetaData').throws();
      const insertError = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();
      
      try {
        await service.intakeJob_step_11(mockJobQueue)
        expect.fail();
      } catch (error: any) {
        expect(insertError).to.be.calledOnce;
        expect(error.message).to.be.eq('Transforming and uploading metadata')
      }
    })
  })

  describe('intakeJob_step_12', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;
      const transform = sinon.stub(DarwinCoreService.prototype, 'runSecurityTransforms').resolves();
      await service.intakeJob_step_12(mockJobQueue)

      expect(transform).to.be.calledOnce;
    })

    it('should throw `Secure spatial transforms` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;
      sinon.stub(DarwinCoreService.prototype, 'runSecurityTransforms').throws();
      const insertError = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();
      
      try {
        await service.intakeJob_step_12(mockJobQueue)
        expect.fail();
      } catch (error: any) {
        expect(insertError).to.be.calledOnce;
        expect(error.message).to.be.eq('Secure spatial transforms')
      }
    })
  })

  describe('intakeJob_step_13', () => {
    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const update = sinon.stub(DarwinCoreService.prototype, 'updateS3FileLocation').resolves();

      await service.intakeJob_step_13(mockJobQueue);

      expect(update).to.be.calledOnce;
    });

    it('should throw `Transforming and uploading` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const updateS3 = sinon.stub(DarwinCoreService.prototype, 'updateS3FileLocation').throws();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.intakeJob_step_13(mockJobQueue);
        expect.fail();
      } catch (error) {
        expect(updateS3).to.be.called;
        expect(insertErrorStatus).to.be.called;
      }
    });
  });

  describe('updateSubmissionObservationEndTimestamp', () => {
    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);

      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      sinon.stub(SubmissionService.prototype, 'updateSubmissionObservationRecordEndDate').resolves();
      const submissionIssue = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      await service.updateSubmissionObservationEndTimestamp(mockJobQueue);
      expect(submissionIssue).to.not.be.called;
    });

    it('should throw `Updating Submission Observation` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);

      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      sinon.stub(SubmissionService.prototype, 'updateSubmissionObservationRecordEndDate').throws();
      const insertStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.updateSubmissionObservationEndTimestamp(mockJobQueue);
        expect.fail();
      } catch (error) {
        expect(insertStatus).to.be.calledOnce;
        expect((error as ApiGeneralError).message).to.equal(
          'Updating Submission Observation Record End and Effective Date'
        );
      }
    });
  });

  describe('runTransformsOnObservations', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const transform = sinon.stub(DarwinCoreService.prototype, 'runSpatialTransforms').resolves();
      const security = sinon.stub(DarwinCoreService.prototype, 'runSecurityTransforms').resolves();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      await service.runTransformsOnObservations(mockJobQueue, 1);

      expect(transform).to.be.calledOnceWith(mockJobQueue, 1);
      expect(security).to.be.calledOnceWith(mockJobQueue);
      expect(insertErrorStatus).to.not.be.called;
    });

    it('should throw `Running Transform` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const transform = sinon.stub(DarwinCoreService.prototype, 'runSpatialTransforms').throws();
      const security = sinon.stub(DarwinCoreService.prototype, 'runSecurityTransforms').resolves();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.runTransformsOnObservations(mockJobQueue, 1);
        expect.fail();
      } catch (error) {
        expect(transform).to.be.calledOnceWith(mockJobQueue, 1);
        expect(security).to.not.be.called;
        expect(insertErrorStatus).to.be.calledOnce;
        expect((error as ApiGeneralError).message).to.equal('Running Transforms on Observation Data');
      }
    });
  });

  describe('runSpatialTransforms', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;
      const submissionObservationId = 2;

      const transform = sinon.stub(SpatialService.prototype, 'runSpatialTransforms').resolves();
      const status = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      await service.runSpatialTransforms(mockJobQueue, submissionObservationId);

      expect(transform).to.be.calledOnceWith(mockJobQueue.submission_id, submissionObservationId);
      expect(status).to.be.calledOnceWith(
        mockJobQueue.submission_id,
        SUBMISSION_STATUS_TYPE.SPATIAL_TRANSFORM_UNSECURE
      );
      expect(insertErrorStatus).to.not.be.called;
    });

    it('should throw `Transforming and uploading` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const transform = sinon.stub(SpatialService.prototype, 'runSpatialTransforms').throws();
      const status = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.runSpatialTransforms(mockJobQueue, 1);
        expect.fail();
      } catch (error) {
        expect(transform).to.be.calledOnce;
        expect(status).to.not.be.called;
        expect(insertErrorStatus).to.be.calledOnce;
        expect((error as ApiGeneralError).message).to.equal('Transforming and uploading spatial transforms');
      }
    });
  });

  describe('runSecurityTransforms', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const transform = sinon.stub(SpatialService.prototype, 'runSecurityTransforms').resolves();
      const status = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      await service.runSecurityTransforms(mockJobQueue);

      expect(transform).to.be.calledOnce;
      expect(status).to.be.calledOnce;
      expect(insertErrorStatus).to.not.be.called;
    });

    it('should throw `Transforming and uploading` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const transform = sinon.stub(SpatialService.prototype, 'runSecurityTransforms').throws();
      const status = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatus').resolves();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.runSecurityTransforms(mockJobQueue);
        expect.fail();
      } catch (error) {
        expect(transform).to.be.calledOnce;
        expect(status).to.not.be.called;
        expect(insertErrorStatus).to.be.calledOnce;
        expect((error as ApiGeneralError).message).to.equal('Transforming and uploading secure spatial transforms');
      }
    });
  });

  describe('insertSubmissionObservationRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const insertObservation = sinon.stub(SubmissionService.prototype, 'insertSubmissionObservationRecord').resolves();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      await service.insertSubmissionObservationRecord(mockJobQueue, 'dwcaJSON');

      expect(insertObservation).to.be.calledOnce;
      expect(insertErrorStatus).to.not.be.called;
    });

    it('should throw `Inserting Submission Observation` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const insertObservation = sinon.stub(SubmissionService.prototype, 'insertSubmissionObservationRecord').throws();
      const insertErrorStatus = sinon.stub(SubmissionService.prototype, 'insertSubmissionStatusAndMessage').resolves();

      try {
        await service.insertSubmissionObservationRecord(mockJobQueue, 'dwcaJSON');
        expect.fail();
      } catch (error) {
        expect(insertObservation).to.be.calledOnce;
        expect(insertErrorStatus).to.be.calledOnce;
        expect((error as ApiGeneralError).message).to.equal('Inserting Submission Observation Record');
      }
    });
  });

  describe('updateS3FileLocation', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        key: 'Key',
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const mockSubmission = {
        submission_id: 1,
        source_transform_id: 3,
        uuid: 'uuid',
        create_date: '',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 0
      } as ISubmissionModel;

      const submission = sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves(mockSubmission);
      const moveS3 = sinon.stub(fileUtils, 'copyFileInS3').resolves();
      const deleteS3 = sinon.stub(fileUtils, 'deleteFileFromS3').resolves();

      await service.updateS3FileLocation(mockJobQueue);

      expect(submission).to.be.calledOnce;
      expect(deleteS3).to.be.calledOnce;
      expect(moveS3).to.be.calledOnce;
    });

    it('should do nothing', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const mockSubmission = {
        submission_id: 1,
        source_transform_id: 3,
        uuid: 'uuid',
        create_date: '',
        create_user: 1,
        update_date: null,
        update_user: null,
        revision_count: 0
      } as ISubmissionModel;

      const submission = sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves(mockSubmission);
      const moveS3 = sinon.stub(fileUtils, 'copyFileInS3').resolves();
      const deleteS3 = sinon.stub(fileUtils, 'deleteFileFromS3').resolves();

      await service.updateS3FileLocation(mockJobQueue);

      expect(submission).to.not.be.called;
      expect(deleteS3).to.not.be.called;
      expect(moveS3).to.not.be.called;
    });

    it('should throw error', async () => {
      const mockDBConnection = getMockDBConnection({
        sql: () => {
          return { rowCount: 0, rows: [] } as any as Promise<QueryResult<any>>;
        }
      });
      const service = new DarwinCoreService(mockDBConnection);
      const mockJobQueue = {
        submission_job_queue_id: 1,
        submission_id: 1,
        key: 'Key',
        job_start_timestamp: '',
        job_end_timestamp: ''
      } as ISubmissionJobQueueRecord;

      const moveS3 = sinon.stub(fileUtils, 'copyFileInS3').resolves();
      const deleteS3 = sinon.stub(fileUtils, 'deleteFileFromS3').resolves();

      try {
        await service.updateS3FileLocation(mockJobQueue);
        expect.fail();
      } catch (error) {
        expect((error as ApiExecuteSQLError).message).to.equal('Failed to get submission record');
        expect(deleteS3).to.not.be.called;
        expect(moveS3).to.not.be.called;
      }
    });
  });

  describe('getAndPrepFileFromS3', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should run without issue', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);
      const dwc = sinon.createStubInstance(DWCArchive);

      sinon.stub(DarwinCoreService.prototype, 'prepDWCArchive').returns(dwc);

      const getFileFromS3Stub = sinon.stub(fileUtils, 'getFileFromS3').resolves({ Body: 'valid' });

      const response = await service.getAndPrepFileFromS3('file-key');

      expect(dwc).to.be.eql(response);
      expect(getFileFromS3Stub).to.be.calledOnce;
    });

    it('should throw `The source file is not available` error', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new DarwinCoreService(mockDBConnection);

      const getFileFromS3Stub = sinon.stub(fileUtils, 'getFileFromS3').resolves(null as any as S3.GetObjectOutput);

      try {
        await service.getAndPrepFileFromS3('file-key');
        expect.fail();
      } catch (error) {
        expect((error as ApiGeneralError).message).to.equal('The source file is not available');
        expect(getFileFromS3Stub).to.be.calledOnce;
      }
    });
  });

  describe('ingestNewDwCADataPackage', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const mockArchiveFile = {
        rawFile: {
          fileName: 'test'
        },
        eml: {
          buffer: Buffer.from('test')
        }
      };

      const prepDWCArchiveStub = sinon
        .stub(DarwinCoreService.prototype, 'prepDWCArchive')
        .returns(mockArchiveFile as unknown as DWCArchive);
      const insertSubmissionRecordStub = sinon
        .stub(SubmissionService.prototype, 'insertSubmissionRecord')
        .resolves({ submission_id: 1 });
      const getSourceTransformRecordBySystemUserIdStub = sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySystemUserId')
        .resolves({ source_transform_id: 1 } as unknown as ISourceTransformModel);

      const response = await darwinCoreService.ingestNewDwCADataPackage(
        { originalname: 'name' } as unknown as Express.Multer.File,
        'string'
      );

      expect(response).to.eql({ dataPackageId: 'string', submissionId: 1 });
      expect(prepDWCArchiveStub).to.be.calledOnce;
      expect(insertSubmissionRecordStub).to.be.calledOnce;
      expect(getSourceTransformRecordBySystemUserIdStub).to.be.calledOnce;
    });
  });

  describe('prepDWCArchive', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when media is invalid or empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(mediaUtils, 'parseUnknownMedia').returns(null);

      try {
        await darwinCoreService.prepDWCArchive('test' as unknown as mediaUtils.UnknownMedia);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to parse submission');
      }
    });

    it('should throw an error when media is not a valid DwC Archive File', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(mediaUtils, 'parseUnknownMedia').returns('test' as unknown as MediaFile);

      try {
        await darwinCoreService.prepDWCArchive('test' as unknown as mediaUtils.UnknownMedia);
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('Failed to parse submission');
      }
    });

    it('should succeed', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const archiveStub = sinon.createStubInstance(ArchiveFile);
      const dwcStub = sinon.createStubInstance(DWCArchive);

      sinon.stub(mediaUtils, 'parseUnknownMedia').returns(archiveStub);
      const dwcAStub = sinon.stub(dwcUtils, 'DWCArchive').returns(dwcStub);

      const response = await darwinCoreService.prepDWCArchive('test' as unknown as mediaUtils.UnknownMedia);

      expect(response).to.equal(dwcStub);
      expect(dwcAStub).to.be.calledOnce;
    });
  });

  describe('transformAndUploadMetaData', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error if there is no source_transform_id in the submission record', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({ id: 1 } as unknown as ISubmissionModel);

      try {
        await darwinCoreService.transformAndUploadMetaData(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('The source_transform_id is not available');
      }
    });

    it('throws an error if there is no metadata_transform in the source transform record', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        submission_id: 1,
        source_transform_id: 2,
        eml_source: 'some eml source'
      } as unknown as ISubmissionModel);

      sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySourceTransformId')
        .resolves({ source_transform_id: 2 } as unknown as ISourceTransformModel);

      try {
        await darwinCoreService.transformAndUploadMetaData(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('The source metadata transform is not available');
      }
    });

    it('throws an error if the transformed metadata is null or empty', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        submission_id: 1,
        source_transform_id: 2,
        eml_source: 'some eml source'
      } as unknown as ISubmissionModel);

      sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySourceTransformId')
        .resolves({ source_transform_id: 2, metadata_transform: 'some transform' } as unknown as ISourceTransformModel);

      sinon.stub(SubmissionService.prototype, 'getSubmissionMetadataJson').resolves('');

      try {
        await darwinCoreService.transformAndUploadMetaData(1);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('The source metadata json is not available');
      }
    });

    it('successfully inserts a record into elastic search', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves({
        submission_id: 1,
        source_transform_id: 2,
        eml_source: 'some eml source',
        uuid: 'uuid'
      } as unknown as ISubmissionModel);

      sinon
        .stub(SubmissionService.prototype, 'getSourceTransformRecordBySourceTransformId')
        .resolves({ source_transform_id: 2, metadata_transform: 'some transform' } as unknown as ISourceTransformModel);

      sinon.stub(SubmissionService.prototype, 'getSubmissionMetadataJson').resolves('transformed metadata');
      sinon.stub(SubmissionService.prototype, 'updateSubmissionMetadataWithSearchKeys').resolves(1);

      const uploadToElasticSearchStub = sinon
        .stub(DarwinCoreService.prototype, 'uploadToElasticSearch')
        .resolves('success response' as unknown as WriteResponseBase);

      await darwinCoreService.transformAndUploadMetaData(1);

      expect(uploadToElasticSearchStub).to.be.calledOnceWith('uuid', 'transformed metadata');
    });
  });

  describe('uploadToElasticSearch', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('succeeds with valid values', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const indexStub = sinon.stub().returns('es response');

      sinon.stub(DarwinCoreService.prototype, 'getEsClient').resolves({
        index: indexStub
      } as unknown as Client);

      const response = await darwinCoreService.uploadToElasticSearch('dataPackageId', 'convertedEML');

      expect(indexStub).to.be.calledOnceWith({
        id: 'dataPackageId',
        index: ElasticSearchIndices.EML,
        document: 'convertedEML'
      });
      expect(response).equals('es response');
    });
  });

  describe('deleteEmlFromElasticSearchByDataPackageId', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should succeed and delete old es file', async () => {
      const mockDBConnection = getMockDBConnection();
      const darwinCoreService = new DarwinCoreService(mockDBConnection);

      const esClientStub = sinon.createStubInstance(Client);

      esClientStub.delete.resolves('dataPackageId eml' as unknown as WriteResponseBase);

      const getEsClientStub = sinon
        .stub(ESService.prototype, 'getEsClient')
        .resolves(esClientStub as unknown as Client);

      const response = await darwinCoreService.deleteEmlFromElasticSearchByDataPackageId('dataPackageId');

      expect(getEsClientStub).to.be.calledOnce;
      expect(response).to.equal('dataPackageId eml');
    });
  });
});
