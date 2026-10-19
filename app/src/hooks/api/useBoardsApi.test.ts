import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { IBoardDetail, IBoardRequest, IGetBoardsResponse } from 'interfaces/useBoardsApi.interface';
import { useBoardsApi } from './useBoardsApi';

const boardId = '11111111-1111-4111-8111-111111111111';
const tagId = '33333333-3333-4333-8333-333333333333';
const board: IBoardDetail = {
  board_id: boardId,
  name: 'Triage',
  description: null,
  create_date: '2026-10-01T00:00:00.000Z',
  tags: []
};
const boardRequest: IBoardRequest = { name: 'Triage', description: null, tagIds: [tagId] };

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
      boards: [{ ...board, tags: [] }],
      pagination: { total: 26, current_page: 2, last_page: 2, per_page: 25 }
    };
    mock.onGet('/api/administrative/boards', { params }).reply(200, response);

    expect(await useBoardsApi(axios).getBoards(params)).toEqual(response);
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
});
