import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { useBlueprintsApi } from './useBlueprintsApi';

describe('useBlueprintsApi', () => {
  it('updates only supplied metadata to the blueprint resource', async () => {
    const client = axios.create();
    const mock = new MockAdapter(client);
    const payload = { name: 'Renamed', description: null };
    const response = { blueprint_id: 19, ...payload };
    mock.onPut('/api/administrative/blueprints/19', payload).reply(200, response);
    try {
      expect(await useBlueprintsApi(client).updateBlueprint(19, payload)).toEqual(response);
      expect(mock.history.put).toHaveLength(1);
      expect(mock.history.patch).toHaveLength(0);
    } finally {
      mock.restore();
    }
  });
});
