import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
// import { HTTPError } from '../../../../errors/http-error';
import { SubmissionService } from '../../../../services/submission-service';
import * as db from '../../../../database/db';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { getSubmissionSignedUrl } from './getSignedUrl';

chai.use(sinonChai);

describe.only('getSubmissionSignedUrl', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should return a signed URL upon success', async () => {
    const mockDBConnection = getMockDBConnection();
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

    const testResponseSignedUrl = 'test-signed-url';
    const mockServiceResponse = {
      submission_id: 1,
      source: 'SIMS',
      uuid: '2267501d-c6a9-43b5-b951-2324faff6397',
      event_timestamp: '2022-05-24T18:41:42.211Z',
      delete_timestamp: null,
      input_key: testResponseSignedUrl,
      input_file_name: 'moose_aerial_stratifiedrandomblock_composition_recruitment_survey_2.5_withdata.zip',
      eml_source: null,
      darwin_core_source: 'test',
      create_date: '2022-05-24T18:41:42.056Z',
      create_user: 15,
      update_date: '2022-05-24T18:41:42.056Z',
      update_user: 15,
      revision_count: 1
    };

    sinon.stub(SubmissionService.prototype, 'getSubmissionRecordBySubmissionId').resolves(mockServiceResponse);

    const requestHandler = getSubmissionSignedUrl();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockRes.sendValue).to.eql(testResponseSignedUrl);
  });

  it.skip('should throw an error when submissionId is missing', async () => {
    /**
     * @TODO
     */
  });
});
