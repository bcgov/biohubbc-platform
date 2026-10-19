import { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { dbDependencies } from '../../../database/db';
import { ensureHTTPError } from '../../../errors/http-error';
import { BoardDetail, BoardTickets } from '../../../models/board';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { BoardService } from '../../../services/board-service';
import { BoardSwimlaneService } from '../../../services/board-swimlane-service';
import { createBoard, GET, getBoards, POST } from './index';
import { DELETE as boardDELETE, GET as boardGET, PUT as boardPUT, updateBoard } from './{boardId}';
import { POST as swimlanePOST } from './{boardId}/swimlanes';
import { PUT as orderPUT, reorderBoardSwimlanes } from './{boardId}/swimlanes/order';
import { DELETE as swimlaneDELETE, PUT as swimlanePUT, updateBoardSwimlane } from './{boardId}/swimlanes/{swimlaneId}';
import { getBoardTickets, GET as ticketsGET } from './{boardId}/tickets';

const operations = {
  GET,
  POST,
  boardGET,
  boardPUT,
  boardDELETE,
  swimlanePOST,
  swimlanePUT,
  swimlaneDELETE,
  orderPUT,
  ticketsGET
};

const boardId = '11111111-1111-1111-1111-111111111111';
const swimlaneId = '33333333-3333-3333-3333-333333333333';

const mockBoardDetail: BoardDetail = {
  board_id: boardId,
  name: 'Fisheries',
  description: null,
  create_date: '2026-10-19T00:00:00.000Z',
  tags: [],
  swimlanes: []
};

describe('paths/administrative/boards', () => {
  afterEach(() => sinon.restore());

  Object.entries(operations).forEach(([name, operation]) => {
    it(`${name} requires only the system administrator role`, async () => {
      const authorize = sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      try {
        await (operation[0] as RequestHandler)(mockReq, mockRes, mockNext);
        expect.fail('Expected forbidden');
      } catch (error) {
        expect(ensureHTTPError(error).status).to.equal(403);
      }

      expect(authorize.firstCall.args[0].authorization_scheme).to.deep.equal({
        and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
      });
      sinon.assert.notCalled(mockNext);
    });
  });

  const mockConnection = () => {
    const connection = getMockDBConnection({
      commit: sinon.stub().resolves(),
      rollback: sinon.stub().resolves(),
      release: sinon.stub()
    });
    sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
    return connection;
  };

  it('getBoards passes the search filter with default pagination and wraps the page', async () => {
    mockConnection();
    const getBoardsStub = sinon.stub(BoardService.prototype, 'getBoards').resolves([]);
    const countStub = sinon.stub(BoardService.prototype, 'getBoardsCount').resolves(0);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { search: 'fish' };

    await getBoards()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(
      getBoardsStub,
      { search: 'fish' },
      { page: 1, limit: 25, sort: undefined, order: undefined }
    );
    sinon.assert.calledOnceWithExactly(countStub, { search: 'fish' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({
      boards: [],
      pagination: { total: 0, per_page: 25, current_page: 1, last_page: 1, sort: undefined, order: undefined }
    });
  });

  it('createBoard returns 201 with the created board', async () => {
    mockConnection();
    const createStub = sinon.stub(BoardService.prototype, 'createBoard').resolves(mockBoardDetail);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'Fisheries', description: null, tagIds: [] };

    await createBoard()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(createStub, mockReq.body);
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(mockBoardDetail);
  });

  it('updateBoard passes the board id and body', async () => {
    mockConnection();
    const updateStub = sinon.stub(BoardService.prototype, 'updateBoard').resolves(mockBoardDetail);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { boardId };
    mockReq.body = { name: 'Fisheries', description: null, tagIds: [] };

    await updateBoard()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(updateStub, boardId, mockReq.body);
    expect(mockRes.statusValue).to.equal(200);
  });

  it('updateBoardSwimlane scopes the swimlane to the board in the path', async () => {
    mockConnection();
    const updateStub = sinon.stub(BoardSwimlaneService.prototype, 'updateBoardSwimlane').resolves({} as any);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { boardId, swimlaneId };
    mockReq.body = { name: 'Done', description: null, color: null, isVisible: false, boardTagIds: [] };

    await updateBoardSwimlane()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(updateStub, boardId, swimlaneId, mockReq.body);
  });

  it('reorderBoardSwimlanes passes the camelCase swimlaneIds body and wraps the result', async () => {
    mockConnection();
    const reorderStub = sinon.stub(BoardSwimlaneService.prototype, 'reorderBoardSwimlanes').resolves([]);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { boardId };
    mockReq.body = { swimlaneIds: [swimlaneId] };

    await reorderBoardSwimlanes()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(reorderStub, boardId, [swimlaneId]);
    expect(mockRes.jsonValue).to.eql({ swimlanes: [] });
  });

  describe('getBoardTickets', () => {
    const boardTickets = { unsorted: [], swimlanes: [], hidden_ticket_count: 0 } as unknown as BoardTickets;

    const cases: [unknown, boolean][] = [
      [undefined, false],
      [false, false],
      ['false', false],
      [true, true],
      ['true', true]
    ];

    cases.forEach(([includeClosed, expected]) => {
      it(`maps include_closed=${String(includeClosed)} to ${expected}`, async () => {
        mockConnection();
        const getStub = sinon.stub(BoardService.prototype, 'getBoardTickets').resolves(boardTickets);
        const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
        mockReq.params = { boardId };
        mockReq.query = includeClosed === undefined ? {} : ({ include_closed: includeClosed } as any);

        await getBoardTickets()(mockReq, mockRes, mockNext);

        sinon.assert.calledOnceWithExactly(getStub, boardId, { include_closed: expected });
        expect(mockRes.statusValue).to.equal(200);
      });
    });
  });
});
