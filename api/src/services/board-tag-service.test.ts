import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { BoardTagRepository } from '../repositories/board-tag-repository';
import { BoardTagService } from './board-tag-service';
import { BoardTicketService } from './board-ticket-service';

chai.use(sinonChai);

const boardId = '11111111-1111-1111-1111-111111111111';
const tagId = '44444444-4444-4444-4444-444444444444';

describe('BoardTagService', () => {
  let service: BoardTagService;

  beforeEach(() => {
    service = new BoardTagService(getMockDBConnection());
  });

  afterEach(() => sinon.restore());

  describe('ensureBoardTag', () => {
    it('links the tag and puts the tickets that have it on the board', async () => {
      const linkStub = sinon.stub(BoardTagRepository.prototype, 'insertBoardTags').resolves([{ tag_id: tagId }]);
      const ticketsStub = sinon.stub(BoardTicketService.prototype, 'insertBoardTicketsByTagId').resolves();

      await service.ensureBoardTag(boardId, tagId);

      expect(linkStub).to.have.been.calledOnceWith(boardId, [tagId]);
      expect(ticketsStub).to.have.been.calledOnceWith(boardId, tagId);
      expect(linkStub).to.have.been.calledBefore(ticketsStub);
    });

    it('puts no tickets on the board when the tag was already linked', async () => {
      sinon.stub(BoardTagRepository.prototype, 'insertBoardTags').resolves([]);
      const ticketsStub = sinon.stub(BoardTicketService.prototype, 'insertBoardTicketsByTagId');

      await service.ensureBoardTag(boardId, tagId);

      expect(ticketsStub).to.not.have.been.called;
    });
  });

  describe('deleteBoardTag', () => {
    it("takes the tag's tickets off the board before unlinking the tag", async () => {
      const ticketsStub = sinon.stub(BoardTicketService.prototype, 'deleteBoardTicketsByBoardTag').resolves();
      const unlinkStub = sinon.stub(BoardTagRepository.prototype, 'deleteBoardTag').resolves();

      await service.deleteBoardTag(boardId, tagId);

      expect(ticketsStub).to.have.been.calledOnceWith(boardId, tagId);
      expect(unlinkStub).to.have.been.calledOnceWith(boardId, tagId);
      expect(ticketsStub).to.have.been.calledBefore(unlinkStub);
    });
  });

  describe('deleteBoardTagsByTagId', () => {
    it("takes the tag's tickets off its boards before unlinking it from them", async () => {
      const ticketsStub = sinon.stub(BoardTicketService.prototype, 'deleteBoardTicketsByTagId').resolves();
      const unlinkStub = sinon.stub(BoardTagRepository.prototype, 'deleteBoardTagsByTagId').resolves();

      await service.deleteBoardTagsByTagId(tagId);

      expect(ticketsStub).to.have.been.calledOnceWith(tagId);
      expect(unlinkStub).to.have.been.calledOnceWith(tagId);
      expect(ticketsStub).to.have.been.calledBefore(unlinkStub);
    });
  });

  describe('deleteBoardTagsByBoardId', () => {
    it("unlinks the board's tags without taking tickets off it", async () => {
      const ticketsStub = sinon.stub(BoardTicketService.prototype, 'deleteBoardTicketsByBoardTag');
      const unlinkStub = sinon.stub(BoardTagRepository.prototype, 'deleteBoardTagsByBoardId').resolves();

      await service.deleteBoardTagsByBoardId(boardId);

      expect(unlinkStub).to.have.been.calledOnceWith(boardId);
      expect(ticketsStub).to.not.have.been.called;
    });
  });
});
