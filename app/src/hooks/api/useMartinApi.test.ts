import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { useMartinApi } from './useMartinApi';

describe('useMartinApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  const session = {
    has_spatial_properties: true,
    token: 'a.tile.token',
    token_type: 'Bearer',
    token_expires_in: 900,
    source: 'feature',
    source_layer: 'geometries',
    martin_url_template: '/martin/feature/{z}/{x}/{y}',
    bbox: [-125, 48, -120, 52],
    min_zoom: 0,
    max_zoom: 15
  };

  it('creates a search session with the feature type and expression', async () => {
    const response = { token: 't', token_type: 'Bearer', token_expires_in: 900 };
    mock.onPost('/api/martin/token').reply(200, response);

    const expression = { type: 'and', clauses: [] } as any;
    const result = await useMartinApi(axios).createMartinSession('species_observation', expression);

    expect(result).toEqual(response);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ feature_type: 'species_observation', expression });
  });

  it('creates a search session without an expression when none is given', async () => {
    mock.onPost('/api/martin/token').reply(200, {});

    await useMartinApi(axios).createMartinSession('species_observation');

    expect(JSON.parse(mock.history.post[0].data)).toEqual({ feature_type: 'species_observation' });
  });

  it('creates a tile session for a submission feature with an empty body', async () => {
    mock.onPost('/api/submission/12/features/34/tile').reply(200, session);

    const result = await useMartinApi(axios).createSubmissionFeatureTileSession(12, 34);

    expect(result).toEqual(session);
    expect(mock.history.post[0].data).toBeUndefined();
  });

  it('creates a tile session for a submission upload through the administrative endpoint', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    const uploadSession = { ...session, source: 'upload', martin_url_template: '/martin/upload/{z}/{x}/{y}' };
    mock.onPost(`/api/administrative/submission/16/upload/${submissionUploadId}/tile`).reply(200, uploadSession);

    const controller = new AbortController();
    const result = await useMartinApi(axios).createSubmissionUploadTileSession(16, submissionUploadId, {
      signal: controller.signal
    });

    expect(result).toEqual(uploadSession);
    expect(mock.history.post[0].data).toBeUndefined();
    expect(mock.history.post[0].signal).toBe(controller.signal);
  });

  it('passes through the empty result for an upload with nothing to map', async () => {
    const submissionUploadId = '11111111-1111-4111-8111-111111111111';
    mock
      .onPost(`/api/administrative/submission/16/upload/${submissionUploadId}/tile`)
      .reply(200, { has_spatial_properties: false });

    const result = await useMartinApi(axios).createSubmissionUploadTileSession(16, submissionUploadId);

    expect(result).toEqual({ has_spatial_properties: false });
  });
});
