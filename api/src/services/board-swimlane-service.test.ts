import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError, ApiNotFoundError } from '../errors/api-error';
import { HTTPError } from '../errors/http-error';
import { Board, BoardSwimlane } from '../models/board';
import { BoardRepository } from '../repositories/board-repository';
import { BoardSwimlaneRepository } from '../repositories/board-swimlane-repository';
import { BoardTicketRepository } from '../repositories/board-ticket-repository';
import { BoardSwimlaneService } from './board-swimlane-service';

chai.use(sinonChai);

const boardId = '11111111-1111-1111-1111-111111111111';
const laneA = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const laneB = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const foreignLane = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

const makeSwimlane = (id: string, sortOrder: number): BoardSwimlane => ({
  board_swimlane_id: id,
  board_id: boardId,
  name: `Lane ${id}`,
  description: null,
  color: null,
  sort_order: sortOrder,
  is_visible: true
});

describe('BoardSwimlaneService', () => {
  let service: BoardSwimlaneService;

  beforeEach(() => {
    service = new BoardSwimlaneService(getMockDBConnection());
  });

  afterEach(() => sinon.restore());

  describe('reorderBoardSwimlanes', () => {
    let updateStub: sinon.SinonStub;

    beforeEach(() => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves({ board_id: boardId } as Board);
      sinon
        .stub(BoardSwimlaneRepository.prototype, 'getBoardSwimlanes')
        .resolves([makeSwimlane(laneA, 0), makeSwimlane(laneB, 1)]);
      updateStub = sinon.stub(BoardSwimlaneRepository.prototype, 'updateBoardSwimlaneSortOrder').resolves();
    });

    it('rewrites the order when every lane is listed exactly once', async () => {
      await service.reorderBoardSwimlanes(boardId, [laneB, laneA]);

      expect(updateStub).to.have.been.calledOnceWith(boardId, [laneB, laneA]);
    });

    const invalidOrders: [string, string[]][] = [
      ['a missing lane', [laneB]],
      ['a lane from another board', [laneA, laneB, foreignLane]],
      ['a foreign lane in place of a real one', [laneA, foreignLane]],
      ['a duplicated lane', [laneA, laneB, laneB]],
      ['an empty list', []]
    ];

    invalidOrders.forEach(([label, order]) => {
      it(`rejects ${label} with 400 without writing`, async () => {
        try {
          await service.reorderBoardSwimlanes(boardId, order);
          expect.fail('Expected 400');
        } catch (error) {
          expect((error as HTTPError).status).to.equal(400);
        }

        expect(updateStub).to.not.have.been.called;
      });
    });
  });

  describe('lane ownership', () => {
    beforeEach(() => {
      sinon
        .stub(BoardSwimlaneRepository.prototype, 'getBoardSwimlaneById')
        .rejects(new ApiNotFoundError('Board swimlane not found'));
    });

    it('updateBoardSwimlane rejects a lane that does not belong to the board', async () => {
      const updateStub = sinon.stub(BoardSwimlaneRepository.prototype, 'updateBoardSwimlane');

      try {
        await service.updateBoardSwimlane(boardId, foreignLane, {
          name: 'Done',
          description: null,
          color: null
        });
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(updateStub).to.not.have.been.called;
    });

    it('deleteBoardSwimlane rejects a lane that does not belong to the board', async () => {
      const deleteStub = sinon.stub(BoardSwimlaneRepository.prototype, 'deleteBoardSwimlane');

      try {
        await service.deleteBoardSwimlane(boardId, foreignLane);
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(deleteStub).to.not.have.been.called;
    });
  });

  describe('deleteBoardSwimlane', () => {
    beforeEach(() => {
      sinon.stub(BoardSwimlaneRepository.prototype, 'getBoardSwimlaneById').resolves(makeSwimlane(laneA, 0));
    });

    it("deletes the board's default lane, leaving the board without a default", async () => {
      sinon
        .stub(BoardRepository.prototype, 'getBoardById')
        .resolves({ board_id: boardId, default_swimlane_id: laneA } as Board);
      sinon.stub(BoardTicketRepository.prototype, 'getBoardSwimlaneTicketCount').resolves(0);
      const defaultStub = sinon.stub(BoardRepository.prototype, 'updateBoardDefaultSwimlane').resolves();
      const deleteStub = sinon.stub(BoardSwimlaneRepository.prototype, 'deleteBoardSwimlane').resolves();

      await service.deleteBoardSwimlane(boardId, laneA);

      expect(defaultStub).to.have.been.calledOnceWith(boardId, null);
      expect(deleteStub).to.have.been.calledOnceWith(boardId, laneA);
      expect(defaultStub).to.have.been.calledBefore(deleteStub);
    });

    it('refuses to delete a lane that has tickets', async () => {
      sinon
        .stub(BoardRepository.prototype, 'getBoardById')
        .resolves({ board_id: boardId, default_swimlane_id: laneB } as Board);
      sinon.stub(BoardTicketRepository.prototype, 'getBoardSwimlaneTicketCount').resolves(2);
      const deleteStub = sinon.stub(BoardSwimlaneRepository.prototype, 'deleteBoardSwimlane');

      try {
        await service.deleteBoardSwimlane(boardId, laneA);
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(deleteStub).to.not.have.been.called;
    });

    it('deletes a lane without tickets that is not the default', async () => {
      sinon
        .stub(BoardRepository.prototype, 'getBoardById')
        .resolves({ board_id: boardId, default_swimlane_id: laneB } as Board);
      sinon.stub(BoardTicketRepository.prototype, 'getBoardSwimlaneTicketCount').resolves(0);
      const deleteStub = sinon.stub(BoardSwimlaneRepository.prototype, 'deleteBoardSwimlane').resolves();

      await service.deleteBoardSwimlane(boardId, laneA);

      expect(deleteStub).to.have.been.calledOnceWith(boardId, laneA);
    });
  });

  describe('createBoardSwimlane', () => {
    it('inserts the lane with its name, description, color and sort order', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves({ board_id: boardId } as Board);
      sinon.stub(BoardSwimlaneRepository.prototype, 'findBoardSwimlaneByName').resolves(undefined);
      const insertStub = sinon
        .stub(BoardSwimlaneRepository.prototype, 'insertBoardSwimlane')
        .resolves({ board_swimlane_id: laneA });
      sinon.stub(BoardSwimlaneRepository.prototype, 'getBoardSwimlaneById').resolves(makeSwimlane(laneA, 0));

      await service.createBoardSwimlane(boardId, {
        name: 'Done',
        description: null,
        color: '#00FF00',
        sortOrder: 3
      });

      expect(insertStub).to.have.been.calledOnceWith(boardId, {
        name: 'Done',
        description: null,
        color: '#00FF00',
        sort_order: 3
      });
    });
  });
});
