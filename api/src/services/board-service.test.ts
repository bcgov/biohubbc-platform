import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError } from '../errors/api-error';
import { Board, BoardSwimlane, BoardTicket } from '../models/board';
import { BoardRepository } from '../repositories/board-repository';
import { BoardSwimlaneTagRepository } from '../repositories/board-swimlane-tag-repository';
import { BoardTagRepository } from '../repositories/board-tag-repository';
import { BoardService } from './board-service';
import { BoardSwimlaneService } from './board-swimlane-service';
import { TagService } from './tag-service';

chai.use(sinonChai);

const boardId = '11111111-1111-1111-1111-111111111111';

const mockBoard: Board = {
  board_id: boardId,
  name: 'Fisheries',
  description: null,
  create_date: '2026-10-19T00:00:00.000Z'
};

const makeSwimlane = (id: string, sortOrder: number, isVisible: boolean): BoardSwimlane => ({
  board_swimlane_id: id,
  board_id: boardId,
  name: `Lane ${id}`,
  description: null,
  color: null,
  sort_order: sortOrder,
  is_visible: isVisible,
  tags: []
});

const makeTicket = (ticketId: string, boardSwimlaneId: string | null): BoardTicket => ({
  ticket_id: ticketId,
  ticket_slug: '29200001',
  subject: `Ticket ${ticketId}`,
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

    it('groups placed tickets, keeps unsorted separate, and omits hidden lanes while counting their tickets', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      sinon
        .stub(BoardSwimlaneService.prototype, 'getBoardSwimlanes')
        .resolves([makeSwimlane(laneTodo, 0, true), makeSwimlane(laneDone, 1, false)]);
      const getTicketsStub = sinon
        .stub(BoardRepository.prototype, 'getBoardTickets')
        .resolves([
          makeTicket('t1', laneTodo),
          makeTicket('t2', null),
          makeTicket('t3', laneDone),
          makeTicket('t4', laneDone)
        ]);

      const result = await service.getBoardTickets(boardId, { include_closed: false });

      expect(getTicketsStub).to.have.been.calledOnceWith(boardId, { include_closed: false });
      expect(result.board).to.eql(mockBoard);
      expect(result.unsorted.map((ticket) => ticket.ticket_id)).to.eql(['t2']);
      expect(result.swimlanes).to.have.length(1);
      expect(result.swimlanes[0].board_swimlane_id).to.equal(laneTodo);
      // Hidden-lane tickets are never moved into a visible lane.
      expect(result.swimlanes[0].tickets.map((ticket) => ticket.ticket_id)).to.eql(['t1']);
      expect(result.hidden_ticket_count).to.equal(2);
      expect(result.unsorted[0]).to.not.have.property('board_swimlane_id');
    });

    it('returns visible lanes in display order even when they are empty', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      sinon
        .stub(BoardSwimlaneService.prototype, 'getBoardSwimlanes')
        .resolves([makeSwimlane(laneTodo, 0, true), makeSwimlane(laneDone, 1, true)]);
      sinon.stub(BoardRepository.prototype, 'getBoardTickets').resolves([]);

      const result = await service.getBoardTickets(boardId, { include_closed: true });

      expect(result.swimlanes.map((swimlane) => swimlane.board_swimlane_id)).to.eql([laneTodo, laneDone]);
      expect(result.swimlanes.every((swimlane) => swimlane.tickets.length === 0)).to.be.true;
      expect(result.unsorted).to.eql([]);
      expect(result.hidden_ticket_count).to.equal(0);
    });
  });

  describe('createBoard', () => {
    it('rejects a duplicate active board name before writing', async () => {
      sinon.stub(BoardRepository.prototype, 'findBoardByName').resolves(mockBoard);
      const insertStub = sinon.stub(BoardRepository.prototype, 'insertBoard');

      try {
        await service.createBoard({ name: 'FISHERIES', description: null, tagIds: [] });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(insertStub).to.not.have.been.called;
    });
  });

  describe('createBoard', () => {
    it('returns the created board with its tags and no swimlanes', async () => {
      const boardTag = { board_tag_id: 'bt', tag_id: 'a', name: 'A', color: '#000000' };
      sinon.stub(BoardRepository.prototype, 'findBoardByName').resolves(undefined);
      sinon.stub(TagService.prototype, 'assertActiveTagIds').resolves();
      sinon.stub(BoardRepository.prototype, 'insertBoard').resolves(mockBoard);
      const insertTagsStub = sinon.stub(BoardTagRepository.prototype, 'insertBoardTags').resolves();
      sinon.stub(BoardTagRepository.prototype, 'getBoardTags').resolves([boardTag]);
      const swimlanesStub = sinon.stub(BoardSwimlaneService.prototype, 'getBoardSwimlanes');

      const result = await service.createBoard({
        name: 'Fisheries',
        description: null,
        tagIds: ['a']
      });

      expect(insertTagsStub).to.have.been.calledOnceWith(boardId, ['a']);
      expect(swimlanesStub).to.not.have.been.called;
      expect(result).to.eql({ ...mockBoard, tags: [boardTag], swimlanes: [] });
    });
  });

  describe('updateBoard', () => {
    it('ends lane links to removed board tags before replacing the board tag set', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      sinon.stub(BoardRepository.prototype, 'findBoardByName').resolves(mockBoard);
      sinon.stub(TagService.prototype, 'assertActiveTagIds').resolves();
      sinon.stub(BoardRepository.prototype, 'updateBoard').resolves(mockBoard);
      sinon.stub(BoardTagRepository.prototype, 'getBoardTags').resolves([]);
      sinon.stub(BoardSwimlaneService.prototype, 'getBoardSwimlanes').resolves([]);
      const laneTagsStub = sinon
        .stub(BoardSwimlaneTagRepository.prototype, 'deleteBoardSwimlaneTagsForBoardTagsNotIn')
        .resolves();
      const deleteStub = sinon.stub(BoardTagRepository.prototype, 'deleteBoardTagsNotIn').resolves();
      const insertStub = sinon.stub(BoardTagRepository.prototype, 'insertBoardTags').resolves();

      await service.updateBoard(boardId, {
        name: 'Fisheries',
        description: null,
        tagIds: ['b', 'c']
      });

      expect(laneTagsStub).to.have.been.calledOnceWith(boardId, ['b', 'c']);
      expect(deleteStub).to.have.been.calledOnceWith(boardId, ['b', 'c']);
      expect(insertStub).to.have.been.calledOnceWith(boardId, ['b', 'c']);
      expect(laneTagsStub).to.have.been.calledBefore(deleteStub);
    });
  });

  describe('createBoardTag', () => {
    it('creates the tag and adds it to the board', async () => {
      const tag = { tag_id: 'tag-1', name: 'Fish', description: null, color: '#1A5A96', create_date: '' };
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      const createStub = sinon.stub(TagService.prototype, 'createTag').resolves(tag);
      const linkStub = sinon.stub(BoardTagRepository.prototype, 'insertBoardTags').resolves();

      const result = await service.createBoardTag(boardId, { name: 'Fish', description: null, color: '#1A5A96' });

      expect(createStub).to.have.been.calledOnceWith({ name: 'Fish', description: null, color: '#1A5A96' });
      expect(linkStub).to.have.been.calledOnceWith(boardId, ['tag-1']);
      expect(createStub).to.have.been.calledBefore(linkStub);
      expect(result).to.eql(tag);
    });

    it('creates nothing for a missing board', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').rejects(new Error('Board not found'));
      const createStub = sinon.stub(TagService.prototype, 'createTag');

      try {
        await service.createBoardTag(boardId, { name: 'Fish', description: null, color: '#1A5A96' });
        expect.fail('Expected error');
      } catch (error) {
        expect((error as Error).message).to.equal('Board not found');
      }

      expect(createStub).to.not.have.been.called;
    });
  });

  describe('deleteBoard', () => {
    it('soft deletes swimlanes and board tags before the board', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves(mockBoard);
      const swimlanesStub = sinon.stub(BoardSwimlaneService.prototype, 'deleteBoardSwimlanesByBoardId').resolves();
      const boardTagsStub = sinon.stub(BoardTagRepository.prototype, 'deleteBoardTagsByBoardId').resolves();
      const deleteStub = sinon.stub(BoardRepository.prototype, 'deleteBoard').resolves();

      await service.deleteBoard(boardId);

      expect(swimlanesStub).to.have.been.calledOnceWith(boardId);
      expect(boardTagsStub).to.have.been.calledOnceWith(boardId);
      expect(deleteStub).to.have.been.calledOnceWith(boardId);
      expect(boardTagsStub).to.have.been.calledBefore(deleteStub);
    });
  });
});
