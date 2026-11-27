import { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import { getMockDBConnection, mockQueryResult } from '../__mocks__/db';
import { FormSubmission } from '../models/form-submission';
import { FormSubmissionRepository } from './form-submission-repository';
import { FormSubmissionUploadRepository } from './form-submission-upload-repository';

const mockFormSubmission: FormSubmission = {
  form_submission_id: 7,
  uuid: '55555555-5555-5555-5555-555555555555',
  form_id: 1,
  form_version_id: 2,
  team_id: '66666666-6666-6666-6666-666666666666',
  submission_id: null,
  status: 'draft',
  data: { sections: [] },
  submitted_date: null,
  create_date: '2026-10-29',
  create_user: 9
};

describe('FormSubmissionRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('inserts a draft with its team and serialized document', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([mockFormSubmission]));
    const repository = new FormSubmissionRepository(getMockDBConnection({ knex: knexStub }));

    const result = await repository.insertFormSubmission({
      formId: 1,
      formVersionId: 2,
      teamId: mockFormSubmission.team_id,
      data: { sections: [] }
    });

    const { bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(result).to.eql(mockFormSubmission);
    expect(bindings).to.include.members([1, 2, mockFormSubmission.team_id, JSON.stringify({ sections: [] })]);
  });

  it('reads only an active form submission of the form', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([mockFormSubmission]));
    const repository = new FormSubmissionRepository(getMockDBConnection({ knex: knexStub }));

    await repository.getFormSubmission(1, mockFormSubmission.uuid);

    const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"record_end_date" is null');
    expect(sql).not.to.include('for update');
    expect(bindings).to.eql([1, mockFormSubmission.uuid]);
  });

  it('locks the form submission row for a submit', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([mockFormSubmission]));
    const repository = new FormSubmissionRepository(getMockDBConnection({ knex: knexStub }));

    await repository.getFormSubmissionForUpdate(1, mockFormSubmission.uuid);

    const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('for update');
  });

  it('returns a saved draft to draft status', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([mockFormSubmission]));
    const repository = new FormSubmissionRepository(getMockDBConnection({ knex: knexStub }));

    await repository.updateFormSubmissionDraft(7, 2, { sections: [] });

    const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"status" =');
    expect(bindings).to.include('draft');
  });

  it('records a submit with its submission', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([mockFormSubmission]));
    const repository = new FormSubmissionRepository(getMockDBConnection({ knex: knexStub }));

    await repository.markFormSubmissionSubmitted(7, 8);

    const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"submitted_date" = CURRENT_TIMESTAMP');
    expect(bindings).to.include.members([8, 'submitted', 7]);
  });

  it('lists every active form submission of a form without a team member filter', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormSubmissionRepository(getMockDBConnection({ knex: knexStub }));

    await repository.getFormSubmissions(1, { teamMemberSystemUserId: null }, { page: 1, limit: 10 });

    const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"fs"."form_id" =');
    expect(sql).to.include('"fs"."record_end_date" is null');
    expect(sql).to.include('LEFT JOIN LATERAL');
    expect(sql).not.to.include('team_member');
  });

  it("narrows the list to a team member's form submissions", async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([{ count: 0 }]));
    const repository = new FormSubmissionRepository(getMockDBConnection({ knex: knexStub }));

    await repository.getFormSubmissionsCount(1, { teamMemberSystemUserId: 9 });

    const { sql, bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('exists');
    expect(sql).to.include('tm.team_id = fs.team_id');
    expect(bindings).to.include(9);
  });
});

describe('FormSubmissionUploadRepository', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('inserts the submitted document and features', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormSubmissionUploadRepository(getMockDBConnection({ knex: knexStub }));
    const features = [{ id: 'row-1', type: 'observation', properties: {}, content: [], parent: null }];

    await repository.insertFormSubmissionUpload({
      submissionUploadId: 'upload-1',
      formSubmissionId: 7,
      formVersionId: 2,
      data: { sections: [] },
      features
    });

    const { bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(bindings).to.include.members(['upload-1', 7, 2, JSON.stringify(features)]);
  });

  it('returns undefined for an upload that did not come from a form', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormSubmissionUploadRepository(getMockDBConnection({ knex: knexStub }));

    expect(await repository.findFormSubmissionUploadFeatures('upload-1')).to.be.undefined;
  });

  it('reads the latest active submit of a form submission', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormSubmissionUploadRepository(getMockDBConnection({ knex: knexStub }));

    await repository.getLatestFormSubmissionUpload(7);

    const { sql } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(sql).to.include('"su"."record_end_date" is null');
    expect(sql).to.include('order by "su"."create_date" desc');
    expect(sql).to.include('limit');
  });

  it('scopes a submit read to its form submission', async () => {
    const knexStub = sinon.stub().resolves(mockQueryResult([]));
    const repository = new FormSubmissionUploadRepository(getMockDBConnection({ knex: knexStub }));

    await repository.getFormSubmissionUpload(7, 'upload-1');

    const { bindings } = knexStub.firstCall.args[0].toSQL().toNative();
    expect(bindings).to.eql([7, 'upload-1']);
  });
});
