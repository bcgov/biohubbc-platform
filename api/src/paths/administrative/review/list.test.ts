import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as list from './list';
import { SubmissionService } from '../../../services/submission-service';

chai.use(sinonChai);

describe('list', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return 200 after update is completed', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    const mock = sinon
      .stub(SubmissionService.prototype, 'getDatasetsForReview')
      .resolves();

    const requestHandler = list.getDatasetsForReview()

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mock).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
  });
});
