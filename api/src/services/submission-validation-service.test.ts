import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { SubmissionValidationRepository } from '../repositories/submission-validation-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionValidationService } from './submission-validation-service';

describe('SubmissionValidationService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createSubmissionValidation', () => {
    it('creates a submission validation record', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionValidationService(mockDBConnection);

      const createStub = sinon
        .stub(SubmissionValidationRepository.prototype, 'createSubmissionValidation')
        .resolves({ submission_validation_id: 1 });

      const result = await service.createSubmissionValidation(123, '550e8400-e29b-41d4-a716-446655440000');

      expect(createStub.calledOnce).to.be.true;
      expect(createStub.firstCall.args[0]).to.equal(123);
      expect(createStub.firstCall.args[1]).to.equal('550e8400-e29b-41d4-a716-446655440000');
      expect(result).to.deep.equal({ submission_validation_id: 1 });
    });
  });

  describe('updateSubmissionValidationStatus', () => {
    it('updates status without metadata', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionValidationService(mockDBConnection);

      const updateStub = sinon
        .stub(SubmissionValidationRepository.prototype, 'updateSubmissionValidationStatus')
        .resolves();

      await service.updateSubmissionValidationStatus('550e8400-e29b-41d4-a716-446655440000', 'started');

      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.equal('550e8400-e29b-41d4-a716-446655440000');
      expect(updateStub.firstCall.args[1]).to.equal('started');
      expect(updateStub.firstCall.args[2]).to.be.undefined;
    });

    it('updates status with metadata', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionValidationService(mockDBConnection);

      const updateStub = sinon
        .stub(SubmissionValidationRepository.prototype, 'updateSubmissionValidationStatus')
        .resolves();

      const metadata = { error: 'Something went wrong' };
      await service.updateSubmissionValidationStatus('550e8400-e29b-41d4-a716-446655440000', 'failed', metadata);

      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.equal('550e8400-e29b-41d4-a716-446655440000');
      expect(updateStub.firstCall.args[1]).to.equal('failed');
      expect(updateStub.firstCall.args[2]).to.deep.equal(metadata);
    });
  });
});
