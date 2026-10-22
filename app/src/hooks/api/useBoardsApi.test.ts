import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  IBoardDetail,
  IBoardRequest,
  IBoardSwimlane,
  IBoardSwimlaneRequest,
  IGetBoardsResponse
} from 'interfaces/useBoardsApi.interface';
import { useBoardsApi } from './useBoardsApi';

const boardId = '11111111-1111-4111-8111-111111111111';
const ticketId = '66666666-6666-4666-8666-666666666666';
const boardSwimlaneId = '55555555-5555-4555-8555-555555555555';
const board: IBoardDetail = {
  board_id: boardId,
  name: 'Triage',
  description: null,
  default_swimlane_id: null,
  create_date: '2026-10-01T00:00:00.000Z',
  swimlanes: []
};
const boardRequest: IBoardRequest = { name: 'Triage', description: null };

describe('useBoardsApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getBoards reads one page of boards with the name search', async () => {
    const params = { search: 'tri', page: 2, limit: 25, sort: 'name', order: 'asc' } as const;
    const response: IGetBoardsResponse = {
      boards: [
        {
          board_id: boardId,
          name: 'Triage',
          description: null,
          default_swimlane_id: null,
          create_date: board.create_date
        }
      ],
      pagination: { total: 26, current_page: 2, last_page: 2, per_page: 25 }
    };
    mock.onGet('/api/administrative/boards', { params }).reply(200, response);

    expect(await useBoardsApi(axios).getBoards(params)).toEqual(response);
  });

  it('createBoard posts the board', async () => {
    mock.onPost('/api/administrative/boards', boardRequest).reply(201, board);

    expect(await useBoardsApi(axios).createBoard(boardRequest)).toEqual(board);
  });

  it('getBoard, updateBoard and deleteBoard address the board', async () => {
    mock.onGet(`/api/administrative/boards/${boardId}`).reply(200, board);
    mock.onPut(`/api/administrative/boards/${boardId}`, boardRequest).reply(200, board);
    mock.onDelete(`/api/administrative/boards/${boardId}`).reply(204);
    const api = useBoardsApi(axios);

    expect(await api.getBoard(boardId)).toEqual(board);
    expect(await api.updateBoard(boardId, boardRequest)).toEqual(board);
    await api.deleteBoard(boardId);

    expect(mock.history.delete).toHaveLength(1);
  });

  it('createBoardSwimlane, updateBoardSwimlane and deleteBoardSwimlane address the board and its lane', async () => {
    const swimlaneRequest: IBoardSwimlaneRequest = {
      name: 'Doing',
      description: null,
      color: null
    };
    const swimlane: IBoardSwimlane = {
      board_swimlane_id: boardSwimlaneId,
      board_id: boardId,
      name: 'Doing',
      description: null,
      color: null,
      sort_order: 0
    };
    mock.onPost(`/api/administrative/boards/${boardId}/swimlanes`, swimlaneRequest).reply(201, swimlane);
    mock
      .onPut(`/api/administrative/boards/${boardId}/swimlanes/${boardSwimlaneId}`, swimlaneRequest)
      .reply(200, swimlane);
    mock.onDelete(`/api/administrative/boards/${boardId}/swimlanes/${boardSwimlaneId}`).reply(204);
    const api = useBoardsApi(axios);

    expect(await api.createBoardSwimlane(boardId, swimlaneRequest)).toEqual(swimlane);
    expect(await api.updateBoardSwimlane(boardId, boardSwimlaneId, swimlaneRequest)).toEqual(swimlane);
    await api.deleteBoardSwimlane(boardId, boardSwimlaneId);

    expect(mock.history.delete).toHaveLength(1);
  });

  it("getBoardTickets reads the board's tickets grouped by lane", async () => {
    const boardTickets = { board: { ...board, swimlanes: undefined }, tickets: [], swimlanes: [] };
    mock.onGet(`/api/administrative/boards/${boardId}/tickets`).reply(200, boardTickets);

    expect(await useBoardsApi(axios).getBoardTickets(boardId)).toEqual(boardTickets);
  });

  it('updateBoardTicket puts the ticket in a lane, and deleteBoardTicket takes it off the board', async () => {
    const request = { boardSwimlaneId };
    mock.onPut(`/api/administrative/boards/${boardId}/tickets/${ticketId}`, request).reply(204);
    mock.onDelete(`/api/administrative/boards/${boardId}/tickets/${ticketId}`).reply(204);
    const api = useBoardsApi(axios);

    await api.updateBoardTicket(boardId, ticketId, request);
    await api.deleteBoardTicket(boardId, ticketId);

    expect(mock.history.put).toHaveLength(1);
    expect(mock.history.delete).toHaveLength(1);
  });

  it('createBoardTicket posts the ticket with its lane to the board', async () => {
    const request = { subject: 'Count fish', description: null, priority: 'medium' as const, boardSwimlaneId };
    const ticket = { ticket_id: 'ticket-1', ticket_slug: '04900001' };
    mock.onPost(`/api/administrative/boards/${boardId}/tickets`, request).reply(201, ticket);

    expect(await useBoardsApi(axios).createBoardTicket(boardId, request)).toEqual(ticket);
  });

  it("getBoardSwimlanes reads one page of the board's swimlanes", async () => {
    const params = { page: 2, limit: 10, sort: 'sort_order', order: 'asc' } as const;
    const response = { swimlanes: [], pagination: { total: 11, current_page: 2, last_page: 2, per_page: 10 } };
    mock.onGet(`/api/administrative/boards/${boardId}/swimlanes`, { params }).reply(200, response);

    expect(await useBoardsApi(axios).getBoardSwimlanes(boardId, params)).toEqual(response);
  });

  it('createBoardTag, addBoardTag and deleteBoardTag address the board and its tag', async () => {
    const tagId = '77777777-7777-4777-8777-777777777777';
    const tagRequest = { name: 'Blocked', description: null, color: '#D8292F' };
    const tag = { tag_id: tagId, ...tagRequest, create_date: '2026-10-01T00:00:00.000Z' };
    mock.onPost(`/api/administrative/boards/${boardId}/tags`, tagRequest).reply(201, tag);
    mock.onPut(`/api/administrative/boards/${boardId}/tags/${tagId}`).reply(204);
    mock.onDelete(`/api/administrative/boards/${boardId}/tags/${tagId}`).reply(204);
    const api = useBoardsApi(axios);

    expect(await api.createBoardTag(boardId, tagRequest)).toEqual(tag);
    await api.addBoardTag(boardId, tagId);
    await api.deleteBoardTag(boardId, tagId);

    expect(mock.history.put).toHaveLength(1);
    expect(mock.history.delete).toHaveLength(1);
  });
});
