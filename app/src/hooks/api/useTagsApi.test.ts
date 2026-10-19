import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { IGetTagsResponse, ITag, ITicketTagsResponse } from 'interfaces/useTagsApi.interface';
import { useTagsApi } from './useTagsApi';

const tagId = '11111111-1111-4111-8111-111111111111';
const ticketId = '22222222-2222-4222-8222-222222222222';
const tag: ITag = {
  tag_id: tagId,
  name: 'Urgent',
  description: null,
  color: '#D8292F',
  create_date: '2026-10-01T00:00:00.000Z'
};
const ticketTags: ITicketTagsResponse = {
  tags: [{ tag_id: tagId, name: 'Urgent', color: '#D8292F' }],
  events: [
    {
      ticket_tag_id: '33333333-3333-4333-8333-333333333333',
      tag_id: tagId,
      tag_name: 'Urgent',
      tag_color: '#D8292F',
      action: 'added',
      user_identifier: 'sarah',
      event_date: '2026-10-02T00:00:00.000Z'
    }
  ]
};

describe('useTagsApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getTags reads the administrative tags with the name search', async () => {
    const response: IGetTagsResponse = { tags: [tag] };
    mock.onGet('/api/administrative/tags', { params: { search: 'urg' } }).reply(200, response);

    const result = await useTagsApi(axios).getTags({ search: 'urg' });

    expect(result).toEqual(response);
  });

  it('createTag posts the tag', async () => {
    const payload = { name: 'Urgent', description: null, color: '#D8292F' };
    mock.onPost('/api/administrative/tags', payload).reply(201, tag);

    const result = await useTagsApi(axios).createTag(payload);

    expect(result).toEqual(tag);
  });

  it('updateTag puts the complete tag', async () => {
    const payload = { name: 'Urgent', description: 'Needs attention', color: '#000000' };
    mock.onPut(`/api/administrative/tags/${tagId}`, payload).reply(200, { ...tag, ...payload });

    const result = await useTagsApi(axios).updateTag(tagId, payload);

    expect(result).toEqual({ ...tag, ...payload });
    expect(JSON.parse(mock.history.put[0].data)).toEqual(payload);
  });

  it('deleteTag deletes the tag', async () => {
    mock.onDelete(`/api/administrative/tags/${tagId}`).reply(204);

    await useTagsApi(axios).deleteTag(tagId);

    expect(mock.history.delete).toHaveLength(1);
  });

  it("getTicketTags reads the ticket's tags and tag history", async () => {
    mock.onGet(`/api/administrative/tickets/${ticketId}/tags`).reply(200, ticketTags);

    const result = await useTagsApi(axios).getTicketTags(ticketId);

    expect(result).toEqual(ticketTags);
  });

  it("updateTicketTags replaces the ticket's tags with the complete set", async () => {
    mock.onPut(`/api/administrative/tickets/${ticketId}/tags`, { tagIds: [tagId] }).reply(200, ticketTags);

    const result = await useTagsApi(axios).updateTicketTags(ticketId, { tagIds: [tagId] });

    expect(result).toEqual(ticketTags);
    expect(JSON.parse(mock.history.put[0].data)).toEqual({ tagIds: [tagId] });
  });
});
