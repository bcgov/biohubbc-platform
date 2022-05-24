import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { SubmissionService } from '../../../services/submission-service';
import * as db from '../../database/db';
import { getMockDBConnection, getRequestHandlerMocks } from '../../__mocks__/db';
import * as users from './list';

chai.use(sinonChai);

describe('submissions', () => {
  describe('listSubmissions', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return rows on success', async () => {
      const mockDBConnection = getMockDBConnection();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const mockResponse = [
        {
          id: 1,
          user_identifier: 'identifier',
          record_end_date: '',
          role_ids: [1, 2],
          role_names: ['System Admin', 'Project Lead']
        }
      ];

      sinon.stub(SubmissionService.prototype, 'listSubmissionRecords').resolves(mockResponse);

      const requestHandler = users.getUserList();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.jsonValue).to.eql(mockResponse);
    });
  });
});
