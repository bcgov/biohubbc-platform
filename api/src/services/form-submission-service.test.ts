import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError, ApiValidationError } from '../errors/api-error';
import { Form, FormSection, FormVersionLayout } from '../models/form';
import { FormSubmission, FormSubmissionData } from '../models/form-submission';
import { SubmissionUpload } from '../models/submission-upload';
import { Ticket } from '../models/ticket';
import { FormSubmissionService } from './form-submission-service';

chai.use(sinonChai);

const SOURCE_ID = '33333333-3333-3333-3333-333333333333';
const SUBMISSION_UPLOAD_ID = '44444444-4444-4444-4444-444444444444';

const mockForm: Form = {
  form_id: 1,
  slug: 'caribou',
  contributor_id: 3,
  team_id: '22222222-2222-2222-2222-222222222222',
  name: 'Caribou',
  description: null,
  is_public: true,
  record_end_date: null
};

const makeSection = (overrides: Partial<FormSection> = {}): FormSection => ({
  blueprint_feature_type_id: 10,
  feature_type_id: 100,
  feature_type_name: 'observation',
  feature_type_display_name: 'Observation',
  label: 'Observation',
  description: null,
  required_value: true,
  allow_multiple: false,
  sort: 0,
  fields: [
    {
      blueprint_feature_type_property_id: 20,
      blueprint_feature_type_id: 10,
      feature_property_id: 200,
      feature_property_name: 'count',
      feature_property_display_name: 'Count',
      type_name: 'number',
      label: 'Count',
      description: null,
      contributor_codeset_id: null,
      sort: 0
    },
    {
      blueprint_feature_type_property_id: 21,
      blueprint_feature_type_id: 10,
      feature_property_id: 201,
      feature_property_name: 'sex',
      feature_property_display_name: 'Sex',
      type_name: 'code',
      label: 'Sex',
      description: null,
      contributor_codeset_id: 50,
      sort: 1
    }
  ],
  ...overrides
});

const makeLayout = (section: FormSection = makeSection()): FormVersionLayout => ({
  form: mockForm,
  form_version: {
    form_version_id: 2,
    form_id: 1,
    blueprint_id: 4,
    version_number: 1,
    record_effective_date: '2026-10-29',
    record_end_date: null
  },
  sections: [section]
});

const makeData = (values: Record<string, string | number | boolean | null>): FormSubmissionData => ({
  sections: [{ featureTypeId: 100, rows: [{ sourceId: SOURCE_ID, values }] }]
});

const makeFormSubmission = (overrides: Partial<FormSubmission> = {}): FormSubmission => ({
  form_submission_id: 7,
  uuid: '55555555-5555-5555-5555-555555555555',
  form_id: 1,
  form_version_id: 2,
  team_id: '66666666-6666-6666-6666-666666666666',
  submission_id: null,
  status: 'draft',
  data: makeData({ '200': '12', '201': 'code::sex::female' }),
  submitted_date: null,
  create_date: '2026-10-29',
  create_user: 9,
  ...overrides
});

/**
 * Stub every dependency of a submit with resolving defaults.
 *
 * @param service Service under test.
 * @param formSubmission Form submission being submitted.
 * @returns The stubs callers assert against.
 */
const stubSubmit = (service: FormSubmissionService, formSubmission: FormSubmission) => {
  sinon.stub(service.formService, 'getPublishedFormBySlug').resolves(makeLayout());
  sinon.stub(service.formService, 'getFormBySlug').resolves(mockForm);
  sinon.stub(service.formSubmissionRepository, 'getFormSubmissionForUpdate').resolves(formSubmission);
  sinon.stub(service.formSubmissionRepository, 'getFormSubmission').resolves(formSubmission);
  sinon
    .stub(service.contributorCodesetService, 'getContributorCodesetsByContributorId')
    .resolves([
      { contributor_codeset_id: 50, contributor_id: 3, key: 'sex', label: 'Sex', description: null, external_id: null }
    ]);
  sinon.stub(service.teamAuthorizationService, 'isUserAuthorizedForTeamEntity').resolves(true);
  sinon.stub(service.formSubmissionUploadRepository, 'getLatestFormSubmissionUpload').resolves(undefined);

  return {
    insertSubmission: sinon.stub(service.submissionService, 'insertSubmissionRecord').resolves({ submission_id: 8 }),
    insertUpload: sinon.stub(service.uploadService, 'insertUpload').resolves({ upload_id: 'upload-1' }),
    createTicket: sinon.stub(service.ticketService, 'createTicket').resolves({ ticket_id: 'ticket-1' } as Ticket),
    insertSubmissionUpload: sinon
      .stub(service.submissionUploadService, 'insertSubmissionUpload')
      .resolves({ submission_upload_id: SUBMISSION_UPLOAD_ID }),
    getSubmissionUpload: sinon
      .stub(service.submissionUploadService, 'getSubmissionUpload')
      .resolves({ submission_upload_id: SUBMISSION_UPLOAD_ID, status: 'uploaded' } as SubmissionUpload),
    insertFormSubmissionUpload: sinon
      .stub(service.formSubmissionUploadRepository, 'insertFormSubmissionUpload')
      .resolves(),
    markSubmitted: sinon
      .stub(service.formSubmissionRepository, 'markFormSubmissionSubmitted')
      .resolves(makeFormSubmission({ status: 'submitted', submission_id: 8 })),
    publish: sinon
      .stub(FormSubmissionService.dependencies, 'publishProcessSubmissionFeaturesJob')
      .resolves({ status: 'published', jobId: 'job-1' })
  };
};

describe('FormSubmissionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('submitFormSubmission', () => {
    it('creates the submission on first submit, then an upload with the typed features, and queues processing', async () => {
      const connection = getMockDBConnection({ systemUserId: () => 9 });
      const service = new FormSubmissionService(connection);
      const stubs = stubSubmit(service, makeFormSubmission());

      await service.submitFormSubmission('caribou', makeFormSubmission().uuid);

      expect(stubs.insertSubmission).to.have.been.calledOnce;
      expect(stubs.insertSubmission.firstCall.args[0]).to.include({ contributor_id: 3, default_blueprint_id: 4 });
      expect(stubs.insertSubmissionUpload.firstCall.args[0]).to.include({
        submission_id: 8,
        upload_id: 'upload-1',
        ticket_id: 'ticket-1',
        status: 'uploaded',
        blueprint_id: 4
      });
      expect(stubs.insertFormSubmissionUpload.firstCall.args[0].features).to.eql([
        {
          id: SOURCE_ID,
          type: 'observation',
          properties: { count: 12, sex: 'code::sex::female' },
          content: [],
          parent: null
        }
      ]);
      expect(stubs.markSubmitted).to.have.been.calledOnceWith(7, 8);
      expect(stubs.publish.firstCall.args[0]).to.equal(connection);
      expect(stubs.insertFormSubmissionUpload).to.have.been.calledBefore(stubs.publish);
    });

    it('reuses the submission when a revision is resubmitted', async () => {
      const service = new FormSubmissionService(getMockDBConnection({ systemUserId: () => 9 }));
      const stubs = stubSubmit(service, makeFormSubmission({ submission_id: 8 }));

      await service.submitFormSubmission('caribou', makeFormSubmission().uuid);

      expect(stubs.insertSubmission).not.to.have.been.called;
      expect(stubs.insertSubmissionUpload.firstCall.args[0]).to.include({ submission_id: 8 });
    });

    it('refuses to submit content that has already been submitted', async () => {
      const service = new FormSubmissionService(getMockDBConnection());
      const stubs = stubSubmit(service, makeFormSubmission({ status: 'submitted', submission_id: 8 }));

      try {
        await service.submitFormSubmission('caribou', makeFormSubmission().uuid);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiConflictError);
        expect(stubs.insertUpload).not.to.have.been.called;
      }
    });

    it('requires a row in a required section', async () => {
      const service = new FormSubmissionService(getMockDBConnection());
      const stubs = stubSubmit(service, makeFormSubmission({ data: { sections: [] } }));

      try {
        await service.submitFormSubmission('caribou', makeFormSubmission().uuid);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiValidationError);
        expect(stubs.insertSubmission).not.to.have.been.called;
      }
    });

    it('rejects a second row in a section that does not allow multiple rows', async () => {
      const service = new FormSubmissionService(getMockDBConnection());
      const data: FormSubmissionData = {
        sections: [
          {
            featureTypeId: 100,
            rows: [
              { sourceId: SOURCE_ID, values: {} },
              { sourceId: '77777777-7777-7777-7777-777777777777', values: {} }
            ]
          }
        ]
      };
      stubSubmit(service, makeFormSubmission({ data }));

      try {
        await service.submitFormSubmission('caribou', makeFormSubmission().uuid);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiValidationError);
      }
    });

    it('rejects a code from another codeset and a value of the wrong type', async () => {
      const service = new FormSubmissionService(getMockDBConnection());
      stubSubmit(service, makeFormSubmission({ data: makeData({ '200': 'many', '201': 'code::colour::red' }) }));

      try {
        await service.submitFormSubmission('caribou', makeFormSubmission().uuid);
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiValidationError);
        expect((error as ApiValidationError).errors).to.have.length(2);
      }
    });
  });

  describe('updateFormSubmission', () => {
    it('rejects a field the form does not have', async () => {
      const service = new FormSubmissionService(getMockDBConnection());
      stubSubmit(service, makeFormSubmission());
      const updateDraft = sinon.stub(service.formSubmissionRepository, 'updateFormSubmissionDraft');

      try {
        await service.updateFormSubmission('caribou', makeFormSubmission().uuid, makeData({ '999': 'x' }));
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiValidationError);
        expect(updateDraft).not.to.have.been.called;
      }
    });

    it('saves the draft against the current published version', async () => {
      const service = new FormSubmissionService(getMockDBConnection());
      stubSubmit(service, makeFormSubmission());
      const updateDraft = sinon
        .stub(service.formSubmissionRepository, 'updateFormSubmissionDraft')
        .resolves(makeFormSubmission());
      const data = makeData({ '200': 3 });

      await service.updateFormSubmission('caribou', makeFormSubmission().uuid, data);

      expect(updateDraft).to.have.been.calledOnceWith(7, 2, data);
    });
  });

  describe('getFormSubmissions', () => {
    it("narrows the list to the caller's own form submissions unless they administer the form", async () => {
      const service = new FormSubmissionService(getMockDBConnection({ systemUserId: () => 9 }));
      sinon.stub(service.formService, 'getFormBySlug').resolves(mockForm);
      sinon.stub(service.teamAuthorizationService, 'isUserAuthorizedForTeamEntity').resolves(false);
      const list = sinon.stub(service.formSubmissionRepository, 'getFormSubmissions').resolves([]);
      sinon.stub(service.formSubmissionRepository, 'getFormSubmissionsCount').resolves({ count: 0 });

      await service.getFormSubmissions('caribou', { page: 1, limit: 10 });

      expect(list.firstCall.args[1]).to.eql({ teamMemberSystemUserId: 9 });
    });
  });

  describe('updateFormSubmissionUploadDecision', () => {
    it('refuses an upload that is not one of the form submission', async () => {
      const service = new FormSubmissionService(getMockDBConnection());
      sinon.stub(service.formService, 'getFormBySlug').resolves(mockForm);
      sinon.stub(service.formSubmissionRepository, 'getFormSubmission').resolves(makeFormSubmission());
      sinon.stub(service.formSubmissionUploadRepository, 'getFormSubmissionUpload').resolves(undefined);
      const decide = sinon.stub(service.submissionUploadService, 'updateSubmissionUploadDecision');

      try {
        await service.updateFormSubmissionUploadDecision('caribou', makeFormSubmission().uuid, SUBMISSION_UPLOAD_ID, {
          decision: 'approved'
        });
        expect.fail();
      } catch (error) {
        expect(error).to.be.instanceof(ApiNotFoundError);
        expect(decide).not.to.have.been.called;
      }
    });
  });
});
