import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection } from '../__mocks__/db';
import { SubmissionValidationRepository } from '../repositories/submission-validation-repository';
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

      const result = await service.createSubmissionValidation(
        '550e8400-e29b-41d4-a716-446655440000',
        123,
        'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
      );

      expect(createStub.calledOnce).to.be.true;
      expect(createStub.firstCall.args[0]).to.equal('550e8400-e29b-41d4-a716-446655440000');
      expect(createStub.firstCall.args[1]).to.equal(123);
      expect(createStub.firstCall.args[2]).to.equal('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11');
      expect(result).to.deep.equal({ submission_validation_id: 1 });
    });
  });

  describe('getSubmissionValidationBySubmissionUploadId', () => {
    it('delegates to repository method', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionValidationService(mockDBConnection);

      const mockRecord = { submission_validation_id: 3, job_id: 'job-uuid', status: 'completed' as const };
      const getStub = sinon
        .stub(SubmissionValidationRepository.prototype, 'getSubmissionValidationBySubmissionUploadId')
        .resolves(mockRecord);

      const result = await service.getSubmissionValidationBySubmissionUploadId('550e8400-e29b-41d4-a716-446655440000');

      expect(getStub.calledOnce).to.be.true;
      expect(getStub.firstCall.args[0]).to.equal('550e8400-e29b-41d4-a716-446655440000');
      expect(result).to.deep.equal(mockRecord);
    });
  });

  describe('updateSubmissionValidationStatusBySubmissionUploadId', () => {
    it('delegates to repository method', async () => {
      const mockDBConnection = getMockDBConnection();
      const service = new SubmissionValidationService(mockDBConnection);

      const updateStub = sinon
        .stub(SubmissionValidationRepository.prototype, 'updateSubmissionValidationStatusBySubmissionUploadId')
        .resolves();

      await service.updateSubmissionValidationStatusBySubmissionUploadId(
        '550e8400-e29b-41d4-a716-446655440000',
        'failed',
        { error: 'timeout' }
      );

      expect(updateStub.calledOnce).to.be.true;
      expect(updateStub.firstCall.args[0]).to.equal('550e8400-e29b-41d4-a716-446655440000');
      expect(updateStub.firstCall.args[1]).to.equal('failed');
      expect(updateStub.firstCall.args[2]).to.deep.equal({ error: 'timeout' });
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
