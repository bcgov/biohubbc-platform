import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import {
  IBoardDetail,
  IBoardRequest,
  IBoardSwimlane,
  IBoardSwimlaneRequest,
  IBoardTicketsResponse
} from 'interfaces/useBoardsApi.interface';
import { useBoardsApi } from './useBoardsApi';

const boardId = '11111111-1111-4111-8111-111111111111';
const swimlaneId = '22222222-2222-4222-8222-222222222222';
const tagId = '33333333-3333-4333-8333-333333333333';
const boardTagId = '44444444-4444-4444-8444-444444444444';
const board: IBoardDetail = {
  board_id: boardId,
  name: 'Triage',
  description: null,
  color: '#1A5A96',
  create_date: '2026-10-01T00:00:00.000Z',
  tags: [],
  swimlanes: []
};
const swimlane: IBoardSwimlane = {
  board_swimlane_id: swimlaneId,
  board_id: boardId,
  name: 'Blocked',
  description: null,
  color: null,
  sort_order: 0,
  is_visible: true,
  tags: []
};
const boardRequest: IBoardRequest = { name: 'Triage', description: null, color: '#1A5A96', tagIds: [tagId] };
const swimlaneRequest: IBoardSwimlaneRequest = {
  name: 'Blocked',
  description: null,
  color: null,
  isVisible: true,
  boardTagIds: [boardTagId]
};

describe('useBoardsApi', () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(axios);
  });

  afterEach(() => {
    mock.restore();
  });

  it('getBoards reads every board', async () => {
    mock.onGet('/api/administrative/boards').reply(200, { boards: [] });

    expect(await useBoardsApi(axios).getBoards()).toEqual({ boards: [] });
  });

  it('createBoard posts the board with its tag ids', async () => {
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

  it('creates, updates and deletes a swimlane under its board', async () => {
    mock.onPost(`/api/administrative/boards/${boardId}/swimlanes`, swimlaneRequest).reply(201, swimlane);
    mock.onPut(`/api/administrative/boards/${boardId}/swimlanes/${swimlaneId}`, swimlaneRequest).reply(200, swimlane);
    mock.onDelete(`/api/administrative/boards/${boardId}/swimlanes/${swimlaneId}`).reply(204);
    const api = useBoardsApi(axios);

    expect(await api.createBoardSwimlane(boardId, swimlaneRequest)).toEqual(swimlane);
    expect(await api.updateBoardSwimlane(boardId, swimlaneId, swimlaneRequest)).toEqual(swimlane);
    await api.deleteBoardSwimlane(boardId, swimlaneId);

    expect(mock.history.delete).toHaveLength(1);
  });

  it('updateBoardSwimlaneOrder puts the full lane order', async () => {
    mock
      .onPut(`/api/administrative/boards/${boardId}/swimlanes/order`, { swimlaneIds: [swimlaneId] })
      .reply(200, { swimlanes: [swimlane] });

    const result = await useBoardsApi(axios).updateBoardSwimlaneOrder(boardId, { swimlaneIds: [swimlaneId] });

    expect(result).toEqual({ swimlanes: [swimlane] });
  });

  it('getBoardTickets sends include_closed', async () => {
    const response: IBoardTicketsResponse = { board, unsorted: [], swimlanes: [], hidden_ticket_count: 0 };
    mock
      .onGet(`/api/administrative/boards/${boardId}/tickets`, { params: { include_closed: true } })
      .reply(200, response);

    expect(await useBoardsApi(axios).getBoardTickets(boardId, { include_closed: true })).toEqual(response);
  });
});
