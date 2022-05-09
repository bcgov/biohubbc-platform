import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiGeneralError } from '../errors/api-error';
import { SubmissionRepository } from './submission-repository';

chai.use(sinonChai);

describe.only('SubmissionRepository', () => {
  describe('insertSubmissionRecord', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error when insert sql fails', async () => {
      const mockDBConnection = getMockDBConnection();
      const submissionRepository = new SubmissionRepository(mockDBConnection);
      console.log(submissionRepository);

      try {
        expect.fail();
      } catch (actualError) {
        expect((actualError as ApiGeneralError).message).to.equal('s3Key submissionRecord unavailable');
      }
    });
  });
});
