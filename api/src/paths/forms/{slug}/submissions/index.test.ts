import chai, { expect } from 'chai';
import { RequestHandler } from 'express';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { FormSubmissionDetail } from '../../../../models/form-submission';
import { authorizationDependencies } from '../../../../request-handlers/security/authorization';
import { FormSubmissionService } from '../../../../services/form-submission-service';
import { createFormSubmission, GET, getFormSubmissions, POST } from './index';
import { GET as GET_ONE, getFormSubmission, PUT, updateFormSubmission } from './{formSubmissionUuid}/index';
import { POST as SUBMIT, submitFormSubmission } from './{formSubmissionUuid}/submit/index';
import {
  PATCH,
  updateFormSubmissionUploadDecision
} from './{formSubmissionUuid}/uploads/{submissionUploadId}/status/index';

chai.use(sinonChai);

const FORM_SUBMISSION_UUID = '55555555-5555-5555-5555-555555555555';
const SUBMISSION_UPLOAD_ID = '44444444-4444-4444-4444-444444444444';
const detail = { form_submission: { uuid: FORM_SUBMISSION_UUID } } as unknown as FormSubmissionDetail;

/**
 * Run an operation's authorization middleware and return the scheme it records.
 *
 * @param handler Authorization middleware.
 * @param params Path parameters.
 * @returns The recorded authorization scheme.
 */
const getAuthorizationScheme = async (handler: unknown, params: Record<string, string>) => {
  sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
  const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
  mockReq.params = params;

  await (handler as RequestHandler)(mockReq, mockRes, mockNext);

  return mockReq.authorization_scheme;
};

describe('paths/forms/{slug}/submissions', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('authorization', () => {
    it('requires form access and a signed-in user to list or start submissions', async () => {
      const expected = { and: [{ discriminator: 'Form', slug: 'caribou' }, { discriminator: 'SystemUser' }] };

      expect(await getAuthorizationScheme(GET[0], { slug: 'caribou' })).to.eql(expected);
      sinon.restore();
      expect(await getAuthorizationScheme(POST[0], { slug: 'caribou' })).to.eql(expected);
    });

    it("opens a form submission to its team or the form's administrators", async () => {
      const scheme = await getAuthorizationScheme(GET_ONE[0], {
        slug: 'caribou',
        formSubmissionUuid: FORM_SUBMISSION_UUID
      });

      expect(scheme).to.eql({
        or: [
          { discriminator: 'Team', entity: 'form_submission', formSubmissionUuid: FORM_SUBMISSION_UUID },
          { discriminator: 'Team', entity: 'form', formSlug: 'caribou' }
        ]
      });
    });

    it('limits saving and submitting to the form submission team with form access', async () => {
      const expected = {
        and: [
          { discriminator: 'Form', slug: 'caribou' },
          { discriminator: 'Team', entity: 'form_submission', formSubmissionUuid: FORM_SUBMISSION_UUID }
        ]
      };
      const params = { slug: 'caribou', formSubmissionUuid: FORM_SUBMISSION_UUID };

      expect(await getAuthorizationScheme(PUT[0], params)).to.eql(expected);
      sinon.restore();
      expect(await getAuthorizationScheme(SUBMIT[0], params)).to.eql(expected);
    });

    it('limits review decisions to the form administration team', async () => {
      const scheme = await getAuthorizationScheme(PATCH[0], {
        slug: 'caribou',
        formSubmissionUuid: FORM_SUBMISSION_UUID,
        submissionUploadId: SUBMISSION_UPLOAD_ID
      });

      expect(scheme).to.eql({ and: [{ discriminator: 'Team', entity: 'form', formSlug: 'caribou' }] });
    });
  });

  describe('handlers', () => {
    it('lists form submissions newest first by default', async () => {
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
      const result = {
        form_submissions: [],
        is_form_admin: false,
        pagination: { total: 0, per_page: 10, current_page: 1, last_page: 1 }
      };
      const listStub = sinon.stub(FormSubmissionService.prototype, 'getFormSubmissions').resolves(result);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { slug: 'caribou' };
      mockReq.query = { page: '1', limit: '10' };

      await getFormSubmissions()(mockReq, mockRes, mockNext);

      expect(listStub).to.have.been.calledOnceWith('caribou', sinon.match({ sort: 'create_date', order: 'desc' }));
      expect(mockRes.jsonValue).to.eql(result);
    });

    it('starts a form submission and returns 201', async () => {
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
      const createStub = sinon.stub(FormSubmissionService.prototype, 'createFormSubmission').resolves(detail);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { slug: 'caribou' };

      await createFormSubmission()(mockReq, mockRes, mockNext);

      expect(createStub).to.have.been.calledOnceWith('caribou');
      expect(mockRes.statusValue).to.equal(201);
    });

    it('reads a form submission', async () => {
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
      const getStub = sinon.stub(FormSubmissionService.prototype, 'getFormSubmission').resolves(detail);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { slug: 'caribou', formSubmissionUuid: FORM_SUBMISSION_UUID };

      await getFormSubmission()(mockReq, mockRes, mockNext);

      expect(getStub).to.have.been.calledOnceWith('caribou', FORM_SUBMISSION_UUID);
      expect(mockRes.jsonValue).to.eql(detail);
    });

    it('saves the draft document from the body', async () => {
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
      const updateStub = sinon.stub(FormSubmissionService.prototype, 'updateFormSubmission').resolves(detail);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { slug: 'caribou', formSubmissionUuid: FORM_SUBMISSION_UUID };
      mockReq.body = { data: { sections: [] } };

      await updateFormSubmission()(mockReq, mockRes, mockNext);

      expect(updateStub).to.have.been.calledOnceWith('caribou', FORM_SUBMISSION_UUID, { sections: [] });
      expect(mockRes.statusValue).to.equal(200);
    });

    it('submits and returns 202', async () => {
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
      const submitStub = sinon.stub(FormSubmissionService.prototype, 'submitFormSubmission').resolves(detail);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { slug: 'caribou', formSubmissionUuid: FORM_SUBMISSION_UUID };

      await submitFormSubmission()(mockReq, mockRes, mockNext);

      expect(submitStub).to.have.been.calledOnceWith('caribou', FORM_SUBMISSION_UUID);
      expect(mockRes.statusValue).to.equal(202);
    });

    it('rolls back and re-throws a failed submit', async () => {
      const rollback = sinon.stub().resolves();
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection({ rollback }));
      sinon.stub(FormSubmissionService.prototype, 'submitFormSubmission').rejects(new Error('test error'));
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { slug: 'caribou', formSubmissionUuid: FORM_SUBMISSION_UUID };

      try {
        await submitFormSubmission()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('test error');
        expect(rollback).to.have.been.calledOnce;
      }
    });

    it('returns 202 while an approval is applied', async () => {
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
      const decideStub = sinon
        .stub(FormSubmissionService.prototype, 'updateFormSubmissionUploadDecision')
        .resolves({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'approving' });
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = {
        slug: 'caribou',
        formSubmissionUuid: FORM_SUBMISSION_UUID,
        submissionUploadId: SUBMISSION_UPLOAD_ID
      };
      mockReq.body = { decision: 'approved' };

      await updateFormSubmissionUploadDecision()(mockReq, mockRes, mockNext);

      expect(decideStub).to.have.been.calledOnceWith('caribou', FORM_SUBMISSION_UUID, SUBMISSION_UPLOAD_ID, {
        decision: 'approved'
      });
      expect(mockRes.statusValue).to.equal(202);
    });

    it('returns 200 for a decision that is already in effect', async () => {
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(getMockDBConnection());
      sinon
        .stub(FormSubmissionService.prototype, 'updateFormSubmissionUploadDecision')
        .resolves({ submission_upload_id: SUBMISSION_UPLOAD_ID, decision: 'denied' });
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = {
        slug: 'caribou',
        formSubmissionUuid: FORM_SUBMISSION_UUID,
        submissionUploadId: SUBMISSION_UPLOAD_ID
      };
      mockReq.body = { decision: 'denied' };

      await updateFormSubmissionUploadDecision()(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
    });
  });
});
