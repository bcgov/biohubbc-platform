import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { HTTPError } from '../errors/http-error';
import { Board, BoardSwimlane } from '../models/board';
import { BoardRepository } from '../repositories/board-repository';
import { BoardSwimlaneRepository } from '../repositories/board-swimlane-repository';
import { BoardSwimlaneTagRepository } from '../repositories/board-swimlane-tag-repository';
import { BoardTagRepository } from '../repositories/board-tag-repository';
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
  is_visible: true,
  tags: []
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
          color: null,
          isVisible: true,
          boardTagIds: []
        });
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(updateStub).to.not.have.been.called;
    });

    it('deleteBoardSwimlane rejects a lane that does not belong to the board', async () => {
      const deleteTagsStub = sinon.stub(BoardSwimlaneTagRepository.prototype, 'deleteBoardSwimlaneTagsBySwimlaneId');

      try {
        await service.deleteBoardSwimlane(boardId, foreignLane);
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(deleteTagsStub).to.not.have.been.called;
    });
  });

  describe('createBoardSwimlane', () => {
    it('maps isVisible to is_visible and links the board tags on the same board', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves({ board_id: boardId } as Board);
      sinon.stub(BoardSwimlaneRepository.prototype, 'findBoardSwimlaneByName').resolves(undefined);
      const boardTagsStub = sinon
        .stub(BoardTagRepository.prototype, 'getActiveBoardTagIds')
        .resolves([{ board_tag_id: 'bt1' }]);
      const insertStub = sinon
        .stub(BoardSwimlaneRepository.prototype, 'insertBoardSwimlane')
        .resolves({ board_swimlane_id: laneA });
      const insertTagsStub = sinon.stub(BoardSwimlaneTagRepository.prototype, 'insertBoardSwimlaneTags').resolves();
      sinon.stub(BoardSwimlaneRepository.prototype, 'getBoardSwimlaneById').resolves(makeSwimlane(laneA, 0));

      await service.createBoardSwimlane(boardId, {
        name: 'Done',
        description: null,
        color: '#00FF00',
        isVisible: false,
        boardTagIds: ['bt1', 'bt1']
      });

      expect(insertStub).to.have.been.calledOnceWith(boardId, {
        name: 'Done',
        description: null,
        color: '#00FF00',
        is_visible: false
      });
      expect(boardTagsStub).to.have.been.calledOnceWith(boardId, ['bt1']);
      expect(insertTagsStub).to.have.been.calledOnceWith(boardId, laneA, ['bt1', 'bt1']);
    });

    it('rejects board tags that are not active tags of the board without writing', async () => {
      sinon.stub(BoardRepository.prototype, 'getBoardById').resolves({ board_id: boardId } as Board);
      sinon.stub(BoardSwimlaneRepository.prototype, 'findBoardSwimlaneByName').resolves(undefined);
      sinon.stub(BoardTagRepository.prototype, 'getActiveBoardTagIds').resolves([]);
      const insertStub = sinon.stub(BoardSwimlaneRepository.prototype, 'insertBoardSwimlane');

      try {
        await service.createBoardSwimlane(boardId, {
          name: 'Done',
          description: null,
          color: null,
          isVisible: true,
          boardTagIds: ['foreign-board-tag']
        });
        expect.fail('Expected 400');
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
      }

      expect(insertStub).to.not.have.been.called;
    });
  });
});
