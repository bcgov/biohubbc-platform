import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError } from '../errors/api-error';
import { HTTPError } from '../errors/http-error';
import { Board, BoardSwimlane, BoardTicket } from '../models/board';
import { Ticket } from '../models/ticket';
import { BoardRepository } from '../repositories/board-repository';
import { BoardService } from './board-service';
import { BoardSwimlaneService } from './board-swimlane-service';
import { BoardTagService } from './board-tag-service';
import { BoardTicketService } from './board-ticket-service';
import { TagService } from './tag-service';
import { TicketService } from './ticket-service';

chai.use(sinonChai);

const boardId = '11111111-1111-1111-1111-111111111111';
const ticketId = '33333333-3333-3333-3333-333333333333';

const mockBoard: Board = {
  board_id: boardId,
  name: 'Fisheries',
  description: null,
  default_swimlane_id: 'to-do',
  create_date: '2026-10-19T00:00:00.000Z'
};

const makeSwimlane = (id: string, sortOrder: number, isVisible: boolean): BoardSwimlane => ({
  board_swimlane_id: id,
  board_id: boardId,
  name: `Lane ${id}`,
  description: null,
  color: null,
  sort_order: sortOrder,
  is_visible: isVisible
});

const makeTicket = (id: string, boardSwimlaneId: string): BoardTicket => ({
  ticket_id: id,
  ticket_slug: '29200001',
  subject: `Ticket ${id}`,
  description: null,
  team_id: '22222222-2222-2222-2222-222222222222',
  create_date: '2026-10-19T00:00:00.000Z',
  priority: 'medium',
  status: 'open',
  tags: [],
  board_swimlane_id: boardSwimlaneId
});

describe('BoardService', () => {
  let service: BoardService;

  beforeEach(() => {
    service = new BoardService(getMockDBConnection());
  });

  afterEach(() => sinon.restore());

  describe('getBoardTickets', () => {
    const laneTodo = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
    const laneDone = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

    it('lists every ticket and groups each into its lane, hidden lanes included with their visibility', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      sinon
        .stub(BoardSwimlaneService.prototype, 'getBoardSwimlanes')
        .resolves([makeSwimlane(laneTodo, 0, true), makeSwimlane(laneDone, 1, false)]);
      const getTicketsStub = sinon
        .stub(BoardTicketService.prototype, 'getBoardTickets')
        .resolves([makeTicket('t1', laneTodo), makeTicket('t2', laneDone), makeTicket('t3', laneDone)]);

      const result = await service.getBoardTickets(boardId, { include_closed: false });

      expect(getTicketsStub).to.have.been.calledOnceWith(boardId, { include_closed: false });
      expect(result.board).to.eql(mockBoard);
      expect(result.tickets.map((ticket) => ticket.ticket_id)).to.eql(['t1', 't2', 't3']);
      expect(result.swimlanes.map((swimlane) => [swimlane.board_swimlane_id, swimlane.is_visible])).to.eql([
        [laneTodo, true],
        [laneDone, false]
      ]);
      expect(result.swimlanes[0].tickets.map((ticket) => ticket.ticket_id)).to.eql(['t1']);
      expect(result.swimlanes[1].tickets.map((ticket) => ticket.ticket_id)).to.eql(['t2', 't3']);
      expect(result.tickets[0]).to.not.have.property('board_swimlane_id');
    });

    it('returns lanes in display order even when they are empty', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      sinon
        .stub(BoardSwimlaneService.prototype, 'getBoardSwimlanes')
        .resolves([makeSwimlane(laneTodo, 0, true), makeSwimlane(laneDone, 1, true)]);
      sinon.stub(BoardTicketService.prototype, 'getBoardTickets').resolves([]);

      const result = await service.getBoardTickets(boardId, { include_closed: true });

      expect(result.swimlanes.map((swimlane) => swimlane.board_swimlane_id)).to.eql([laneTodo, laneDone]);
      expect(result.swimlanes.every((swimlane) => swimlane.tickets.length === 0)).to.be.true;
      expect(result.tickets).to.eql([]);
    });
  });

  describe('createBoard', () => {
    it('rejects a duplicate active board name before writing', async () => {
      sinon.stub(BoardRepository.prototype, 'findBoardByName').resolves(mockBoard);
      const insertStub = sinon.stub(BoardRepository.prototype, 'insertBoard');

      try {
        await service.createBoard({ name: 'FISHERIES', description: null });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(insertStub).to.not.have.been.called;
    });

    it('creates the board with a To Do lane as its default lane, and returns both', async () => {
      const toDo = { ...makeSwimlane('lane-1', 0, true), name: 'To Do' };
      sinon.stub(BoardRepository.prototype, 'findBoardByName').resolves(undefined);
      sinon.stub(BoardRepository.prototype, 'insertBoard').resolves({ ...mockBoard, default_swimlane_id: null });
      const insertLaneStub = sinon.stub(BoardSwimlaneService.prototype, 'createBoardSwimlane').resolves(toDo);
      const defaultStub = sinon.stub(BoardRepository.prototype, 'updateBoardDefaultSwimlane').resolves();

      const result = await service.createBoard({ name: 'Fisheries', description: null });

      expect(insertLaneStub).to.have.been.calledOnceWith(boardId, { name: 'To Do', description: null, color: null });
      expect(defaultStub).to.have.been.calledOnceWith(boardId, 'lane-1');
      expect(insertLaneStub).to.have.been.calledBefore(defaultStub);
      expect(result).to.eql({ ...mockBoard, default_swimlane_id: 'lane-1', swimlanes: [toDo] });
    });
  });

  describe('deleteBoard', () => {
    it("takes the board's tickets off it and ends its tag links before deleting its lanes and the board", async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      const ticketsStub = sinon.stub(BoardTicketService.prototype, 'deleteBoardTicketsByBoardId').resolves();
      const tagsStub = sinon.stub(BoardTagService.prototype, 'deleteBoardTagsByBoardId').resolves();
      const swimlanesStub = sinon.stub(BoardSwimlaneService.prototype, 'deleteBoardSwimlanesByBoardId').resolves();
      const boardStub = sinon.stub(BoardRepository.prototype, 'deleteBoard').resolves();

      await service.deleteBoard(boardId);

      expect(ticketsStub).to.have.been.calledOnceWith(boardId);
      expect(swimlanesStub).to.have.been.calledOnceWith(boardId);
      expect(boardStub).to.have.been.calledOnceWith(boardId);
      expect(tagsStub).to.have.been.calledOnceWith(boardId);
      expect(ticketsStub).to.have.been.calledBefore(swimlanesStub);
      expect(swimlanesStub).to.have.been.calledBefore(boardStub);
    });
  });

  describe('board tags', () => {
    const tagId = '44444444-4444-4444-4444-444444444444';
    const tag = { tag_id: tagId, name: 'Fish', description: null, color: '#1A5A96', create_date: '' };

    it('creates a tag and links it to the board', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      const createStub = sinon.stub(TagService.prototype, 'createTag').resolves(tag);
      const linkStub = sinon.stub(BoardTagService.prototype, 'ensureBoardTag').resolves();

      const result = await service.createBoardTag(boardId, { name: 'Fish', description: null, color: '#1A5A96' });

      expect(linkStub).to.have.been.calledOnceWith(boardId, tagId);
      expect(createStub).to.have.been.calledBefore(linkStub);
      expect(result).to.equal(tag);
    });

    it('links an existing tag to the board', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      sinon.stub(TagService.prototype, 'getTag').resolves(tag);
      const linkStub = sinon.stub(BoardTagService.prototype, 'ensureBoardTag').resolves();

      await service.ensureBoardTag(boardId, tagId);

      expect(linkStub).to.have.been.calledOnceWith(boardId, tagId);
    });

    it('links nothing for a missing tag', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      sinon.stub(TagService.prototype, 'getTag').rejects(new ApiNotFoundError('Tag not found'));
      const linkStub = sinon.stub(BoardTagService.prototype, 'ensureBoardTag');

      try {
        await service.ensureBoardTag(boardId, tagId);
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(linkStub).to.not.have.been.called;
    });

    it('unlinks a tag from the board', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      const unlinkStub = sinon.stub(BoardTagService.prototype, 'deleteBoardTag').resolves();

      await service.deleteBoardTag(boardId, tagId);

      expect(unlinkStub).to.have.been.calledOnceWith(boardId, tagId);
    });
  });

  describe('createBoardTicket', () => {
    const ticketRequest = { subject: 'Count fish', description: null, priority: 'medium' as const };

    it("creates the ticket and puts it in the board's default lane", async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      const createdTicket = { ticket_id: ticketId } as Ticket;
      const createStub = sinon.stub(TicketService.prototype, 'createTicket').resolves(createdTicket);
      const insertStub = sinon.stub(BoardTicketService.prototype, 'insertBoardTicket').resolves();

      const result = await service.createBoardTicket(boardId, ticketRequest);

      expect(createStub).to.have.been.calledOnceWith(ticketRequest);
      expect(insertStub).to.have.been.calledOnceWith(boardId, ticketId, 'to-do');
      expect(result).to.equal(createdTicket);
    });

    it('creates no ticket when the board has no default lane', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves({ ...mockBoard, default_swimlane_id: null });
      const createStub = sinon.stub(TicketService.prototype, 'createTicket');

      try {
        await service.createBoardTicket(boardId, ticketRequest);
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(createStub).to.not.have.been.called;
    });
  });

  describe('ensureBoardTicket', () => {
    beforeEach(() => {
      sinon.stub(TicketService.prototype, 'getTicketById').resolves({ ticket_id: ticketId } as Ticket);
    });

    it('puts the ticket in the picked lane once the lane is found on the board', async () => {
      sinon.stub(BoardSwimlaneService.prototype, 'getBoardSwimlane').resolves(makeSwimlane('lane-1', 0, true));
      const ensureStub = sinon.stub(BoardTicketService.prototype, 'ensureBoardTicket').resolves();

      await service.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: 'lane-1' });

      expect(ensureStub).to.have.been.calledOnceWith(boardId, ticketId, 'lane-1');
    });

    it('moves the ticket to the picked position within the picked lane', async () => {
      sinon.stub(BoardSwimlaneService.prototype, 'getBoardSwimlane').resolves(makeSwimlane('lane-1', 0, true));
      const ensureStub = sinon.stub(BoardTicketService.prototype, 'ensureBoardTicket').resolves();
      const positionStub = sinon.stub(BoardTicketService.prototype, 'updateBoardTicketPosition').resolves();

      await service.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: 'lane-1', position: 0 });

      expect(positionStub).to.have.been.calledOnceWith('lane-1', ticketId, 0);
      expect(ensureStub).to.have.been.calledBefore(positionStub);
    });

    it('rejects a position without a lane before changing anything', async () => {
      const insertStub = sinon.stub(BoardTicketService.prototype, 'insertBoardTicket');

      try {
        await service.ensureBoardTicket(boardId, ticketId, { position: 0 });
        expect.fail('Expected 400');
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
      }

      expect(insertStub).to.not.have.been.called;
    });

    it("places nothing when the lane is not the board's", async () => {
      sinon
        .stub(BoardSwimlaneService.prototype, 'getBoardSwimlane')
        .rejects(new ApiNotFoundError('Board swimlane not found'));
      const ensureStub = sinon.stub(BoardTicketService.prototype, 'ensureBoardTicket');

      try {
        await service.ensureBoardTicket(boardId, ticketId, { boardSwimlaneId: 'foreign-lane' });
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(ensureStub).to.not.have.been.called;
    });

    it("adds a ticket without a lane to the board's default lane, keeping a lane it already has", async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      const insertStub = sinon.stub(BoardTicketService.prototype, 'insertBoardTicket').resolves();
      const ensureStub = sinon.stub(BoardTicketService.prototype, 'ensureBoardTicket');

      await service.ensureBoardTicket(boardId, ticketId, {});

      expect(insertStub).to.have.been.calledOnceWith(boardId, ticketId, 'to-do');
      expect(ensureStub).to.not.have.been.called;
    });
  });

  describe('deleteBoardSwimlane', () => {
    it("deletes the board's default lane, leaving the board without a default", async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      const deleteStub = sinon.stub(BoardSwimlaneService.prototype, 'deleteBoardSwimlane').resolves();
      const defaultStub = sinon.stub(BoardRepository.prototype, 'updateBoardDefaultSwimlane').resolves();

      await service.deleteBoardSwimlane(boardId, 'to-do');

      expect(deleteStub).to.have.been.calledOnceWith(boardId, 'to-do');
      expect(defaultStub).to.have.been.calledOnceWith(boardId, null);
      expect(deleteStub).to.have.been.calledBefore(defaultStub);
    });

    it('keeps the default lane when another lane is deleted', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      sinon.stub(BoardSwimlaneService.prototype, 'deleteBoardSwimlane').resolves();
      const defaultStub = sinon.stub(BoardRepository.prototype, 'updateBoardDefaultSwimlane');

      await service.deleteBoardSwimlane(boardId, 'lane-1');

      expect(defaultStub).to.not.have.been.called;
    });

    it('keeps the default lane when the lane cannot be deleted', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      sinon
        .stub(BoardSwimlaneService.prototype, 'deleteBoardSwimlane')
        .rejects(new ApiConflictError("Move or remove the swimlane's tickets before deleting it"));
      const defaultStub = sinon.stub(BoardRepository.prototype, 'updateBoardDefaultSwimlane');

      try {
        await service.deleteBoardSwimlane(boardId, 'to-do');
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(defaultStub).to.not.have.been.called;
    });
  });

  describe('deleteBoardTicket', () => {
    it('takes the ticket off the board', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      const deleteStub = sinon.stub(BoardTicketService.prototype, 'deleteBoardTicket').resolves();

      await service.deleteBoardTicket(boardId, ticketId);

      expect(deleteStub).to.have.been.calledOnceWith(boardId, ticketId);
    });
  });
});
