import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { IInsertSecuritySchema, ISecurityModel, SecurityRepository } from '../repositories/security-repository';
import { ISubmissionModel } from '../repositories/submission-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SecurityService } from './security-service';
import { SubmissionService } from './submission-service';

chai.use(sinonChai);

describe('SecurityService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('insertSecuritySchema', () => {
    it('should return security_id on insert', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new SecurityService(mockDBConnection);

      const repo = sinon.stub(SecurityRepository.prototype, 'insertSecuritySchema').resolves({ security_id: 1 });

      const response = await validationService.insertSecuritySchema({} as unknown as IInsertSecuritySchema);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ security_id: 1 });
    });
  });

  describe('getSecuritySchemaBySecurityId', () => {
    it('should return schema row object', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new SecurityService(mockDBConnection);

      const repo = sinon
        .stub(SecurityRepository.prototype, 'getSecuritySchemaBySecurityId')
        .resolves({ security_id: 1 } as unknown as ISecurityModel);

      const response = await validationService.getSecuritySchemaBySecurityId(1);

      expect(repo).to.be.calledOnce;
      expect(response).to.be.eql({ security_id: 1 });
    });
  });

  describe('validateSecurityOfSubmission', () => {
    it('should return a false validation with error array', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new SecurityService(mockDBConnection);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({} as unknown as ISubmissionModel);

      const response = await validationService.validateSecurityOfSubmission(1, {} as unknown as ISecurityModel);

      expect(response.secure).to.eql(false);
    });

    it('should return a true security validation', async () => {
      const mockDBConnection = getMockDBConnection();
      const validationService = new SecurityService(mockDBConnection);

      sinon
        .stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId')
        .resolves({ submission_id: 1 } as unknown as ISubmissionModel);

      const response = await validationService.validateSecurityOfSubmission(1, {} as unknown as ISecurityModel);

      expect(response.secure).to.eql(true);
    });
  });
});
