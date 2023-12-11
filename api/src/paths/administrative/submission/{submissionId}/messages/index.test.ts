import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { createSubmissionMessages } from '.';
import * as db from '../../../../../database/db';
import { HTTPError } from '../../../../../errors/http-error';
import { SubmissionService } from '../../../../../services/submission-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';

chai.use(sinonChai);

describe('createSubmissionMessages', () => {
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

    const requestHandler = createSubmissionMessages();

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

    const submissionId = 1;
    const messages = [
      {
        submission_message_type_id: 2,
        label: 'label',
        message: 'message',
        data: {
          dataField: 'dataField'
        }
      }
    ];

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.params = {
      submissionId: String(submissionId)
    };
    mockReq.body = {
      messages
    };

    const createMessagesStub = sinon.stub(SubmissionService.prototype, 'createMessages').resolves();

    const requestHandler = createSubmissionMessages();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(createMessagesStub).to.have.been.calledOnceWith(submissionId, messages);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql([]);
  });
});
