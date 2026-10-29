import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { useFormsApi } from './useFormsApi';

describe('useFormsApi', () => {
  const client = axios.create();
  const mock = new MockAdapter(client);
  const api = useFormsApi(client);

  afterEach(() => {
    mock.reset();
  });

  afterAll(() => {
    mock.restore();
  });

  it('creates a form with its slug and contributor', async () => {
    const payload = {
      slug: 'caribou',
      contributorId: 3,
      name: 'Caribou',
      description: null,
      isPublic: true,
      sections: []
    };
    mock.onPost('/api/administrative/forms', payload).reply(201, { form: { form_id: 1 } });

    expect(await api.createForm(payload)).toEqual({ form: { form_id: 1 } });
  });

  it('revises a published form', async () => {
    mock.onPost('/api/administrative/forms/1/versions').reply(201, { form_version: { form_version_id: 3 } });

    expect(await api.createFormVersion(1)).toEqual({ form_version: { form_version_id: 3 } });
  });

  it("replaces a form's teams", async () => {
    mock.onPut('/api/administrative/forms/1/teams', { teamIds: ['team-1'] }).reply(200, { teams: [] });

    expect(await api.updateFormTeams(1, ['team-1'])).toEqual({ teams: [] });
  });

  it('reads the published form by slug', async () => {
    mock.onGet('/api/forms/caribou').reply(200, { form: { slug: 'caribou' } });

    expect(await api.getFormBySlug('caribou')).toEqual({ form: { slug: 'caribou' } });
  });

  it('starts, saves and submits a form submission', async () => {
    mock.onPost('/api/forms/caribou/submissions').reply(201, { form_submission: { uuid: 'fs-1' } });
    mock
      .onPut('/api/forms/caribou/submissions/fs-1', { data: { sections: [] } })
      .reply(200, { form_submission: { uuid: 'fs-1', status: 'draft' } });
    mock.onPost('/api/forms/caribou/submissions/fs-1/submit').reply(202, { form_submission: { status: 'submitted' } });

    expect(await api.createFormSubmission('caribou')).toEqual({ form_submission: { uuid: 'fs-1' } });
    expect(await api.updateFormSubmission('caribou', 'fs-1', { sections: [] })).toEqual({
      form_submission: { uuid: 'fs-1', status: 'draft' }
    });
    expect(await api.submitFormSubmission('caribou', 'fs-1')).toEqual({ form_submission: { status: 'submitted' } });
  });

  it('records a review decision with PATCH', async () => {
    mock
      .onPatch('/api/forms/caribou/submissions/fs-1/uploads/su-1/status', { decision: 'approved' })
      .reply(202, { submission_upload_id: 'su-1', decision: 'approving' });

    expect(await api.updateFormSubmissionUploadDecision('caribou', 'fs-1', 'su-1', 'approved')).toEqual({
      submission_upload_id: 'su-1',
      decision: 'approving'
    });
    expect(mock.history.patch).toHaveLength(1);
  });

  it("lists a form's codesets and codes with pagination", async () => {
    const pagination = { page: 1, limit: 100 };
    mock.onGet('/api/forms/caribou/codesets', { params: pagination }).reply(200, { codesets: [] });
    mock.onGet('/api/forms/caribou/codesets/50/codes', { params: pagination }).reply(200, { codes: [] });

    expect(await api.getFormCodesets('caribou', pagination)).toEqual({ codesets: [] });
    expect(await api.getFormCodesetCodes('caribou', 50, pagination)).toEqual({ codes: [] });
  });
});
