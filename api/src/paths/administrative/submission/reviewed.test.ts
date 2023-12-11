import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { SubmissionService } from '../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { getReviewedSubmissionsForAdmins } from './reviewed';

chai.use(sinonChai);

describe('getReviewedSubmissionsForAdmins', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('re-throws any error that is thrown', async () => {
    const mockDBConnection = getMockDBConnection({
      open: () => {
        throw new Error('test error');
      }
    });

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const requestHandler = getReviewedSubmissionsForAdmins();

    try {
      await requestHandler(mockReq, mockRes, mockNext);
      expect.fail();
    } catch (actualError) {
      expect((actualError as HTTPError).message).to.equal('test error');
    }
  });

  it('should return an array of Reviewed submission objects', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const getReviewedSubmissionsStub = sinon
      .stub(SubmissionService.prototype, 'getReviewedSubmissionsForAdmins')
      .resolves([]);

    const requestHandler = getReviewedSubmissionsForAdmins();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(getReviewedSubmissionsStub).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql([]);
  });
});
