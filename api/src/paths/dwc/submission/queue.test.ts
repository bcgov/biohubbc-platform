import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { SystemUser } from '../../../repositories/user-repository';
import { SubmissionJobQueueService } from '../../../services/submission-job-queue-service';
import * as fileUtils from '../../../utils/file-utils';
import * as keycloakUtils from '../../../utils/keycloak-utils';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as queue from './queue';

chai.use(sinonChai);

describe('queue', () => {
  describe('queueForProcess', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('throws an error when req.files is empty', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        security_request: {}
      };

      const requestHandler = queue.queueForProcess();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Missing required `media`');
      }
    });

    it('throws an error when two or more files are submitted', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File,
        {
          originalname: 'bbb47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        security_request: {}
      };

      const requestHandler = queue.queueForProcess();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Too many files uploaded, expected 1');
      }
    });

    it('throws an error when media file is detected to be malicious', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b'
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(false);

      const requestHandler = queue.queueForProcess();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Malicious content detected, upload cancelled');
      }
    });

    it('throws error when getServiceClientSystemUser returns null', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getServiceAccountDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b'
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns(null);
      const intakeStub = sinon.stub(SubmissionJobQueueService.prototype, 'intake').resolves();
      const requestHandler = queue.queueForProcess();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('Failed to identify known submission source system');
        expect(intakeStub).to.not.be.called;
      }
    });

    it('catches and re-throws an error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getServiceAccountDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.files = [
        {
          originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
        } as unknown as Express.Multer.File
      ];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b'
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);

      sinon.stub(SubmissionJobQueueService.prototype, 'intake').throws(new Error('test error'));

      const requestHandler = queue.queueForProcess();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
        expect(dbConnectionObj.release).to.have.been.calledOnce;
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
      }
    });

    it('throws an error when req.body.security_request.first_nations_id is empty', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const mockFile = {
        originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
      } as unknown as Express.Multer.File;

      mockReq.files = [mockFile];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        security_request: {
          first_nations_id: -1,
          proprietor_type_id: '2',
          survey_id: '3',
          rational: 'string',
          proprietor_name: 'name',
          disa_required: 'true'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);
      const requestHandler = queue.queueForProcess();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('First nations id is a required field');
      }
    });

    it('throws an error when req.body.security_request.proprietor_type_id is empty', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const mockFile = {
        originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
      } as unknown as Express.Multer.File;

      mockReq.files = [mockFile];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        security_request: {
          first_nations_id: '1',
          proprietor_type_id: -1,
          survey_id: '3',
          rational: 'string',
          proprietor_name: 'name',
          disa_required: 'true'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);
      const requestHandler = queue.queueForProcess();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Proprietor type id is a required field');
      }
    });

    it('throws an error when req.body.security_request.survey_id is empty', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const mockFile = {
        originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
      } as unknown as Express.Multer.File;

      mockReq.files = [mockFile];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        security_request: {
          first_nations_id: '1',
          proprietor_type_id: '2',
          survey_id: -1,
          rational: 'string',
          proprietor_name: 'name',
          disa_required: 'true'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);

      const requestHandler = queue.queueForProcess();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Survey id is a required field');
      }
    });

    it('throws an error when req.body.security_request.rational is empty', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const mockFile = {
        originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
      } as unknown as Express.Multer.File;

      mockReq.files = [mockFile];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        security_request: {
          first_nations_id: '1',
          proprietor_type_id: '2',
          survey_id: '3',
          rational: null,
          proprietor_name: 'name',
          disa_required: 'true'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);
      const requestHandler = queue.queueForProcess();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Rational is a required field');
      }
    });

    it('throws an error when req.body.security_request.proprietor_name is empty', async () => {
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const mockFile = {
        originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
      } as unknown as Express.Multer.File;

      mockReq.files = [mockFile];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        security_request: {
          first_nations_id: '1',
          proprietor_type_id: '2',
          survey_id: '3',
          rational: 'string',
          proprietor_name: null,
          disa_required: 'true'
        }
      };

      sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);

      const requestHandler = queue.queueForProcess();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(400);
        expect((actualError as HTTPError).message).to.equal('Proprietor name is a required field');
      }
    });

    it('returns 200', async () => {
      const dbConnectionObj = getMockDBConnection();
      sinon.stub(db, 'getServiceAccountDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const mockFile = {
        originalname: 'aaa47e65-f306-410e-82fa-115f9916910b.zip'
      } as unknown as Express.Multer.File;

      mockReq.files = [mockFile];
      mockReq.body = {
        media: 'file-binary',
        data_package_id: '64f47e65-f306-410e-82fa-115f9916910b',
        security_request: {
          first_nations_id: '1',
          proprietor_type_id: '2',
          survey_id: '3',
          rational: 'string',
          proprietor_name: 'name',
          disa_required: 'true'
        }
      };

      const scanFileForVirusStub = sinon.stub(fileUtils, 'scanFileForVirus').resolves(true);
      sinon.stub(keycloakUtils, 'getServiceClientSystemUser').returns({} as unknown as SystemUser);

      const queueStub = sinon.stub(SubmissionJobQueueService.prototype, 'intake').resolves({ queue_id: 12 });

      const requestHandler = queue.queueForProcess();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(scanFileForVirusStub).to.have.been.calledOnceWith(mockFile);
      expect(queueStub).to.have.been.calledOnceWith('64f47e65-f306-410e-82fa-115f9916910b', mockFile, {
        first_nations_id: 1,
        proprietor_type_id: 2,
        survey_id: 3,
        rational: 'string',
        proprietor_name: 'name',
        disa_required: true
      });
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql({ queue_id: 12 });
    });
  });
});
