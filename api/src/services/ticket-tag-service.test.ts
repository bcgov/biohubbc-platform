import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiNotFoundError } from '../errors/api-error';
import { HTTP400 } from '../errors/http-error';
import { Ticket } from '../models/ticket';
import { BoardTicketRepository } from '../repositories/board-ticket-repository';
import { TicketRepository } from '../repositories/ticket-repository';
import { TicketTagRepository } from '../repositories/ticket-tag-repository';
import { TagService } from './tag-service';
import { TicketTagService } from './ticket-tag-service';

chai.use(sinonChai);

const ticketId = '99999999-9999-9999-9999-999999999999';
const tagA = { tag_id: '11111111-1111-1111-1111-111111111111', name: 'A', color: '#000000' };

describe('TicketTagService', () => {
  let service: TicketTagService;
  let getTicketStub: sinon.SinonStub;
  let assertStub: sinon.SinonStub;
  let insertStub: sinon.SinonStub;
  let deleteStub: sinon.SinonStub;
  let boardTicketsStub: sinon.SinonStub;

  beforeEach(() => {
    service = new TicketTagService(getMockDBConnection());
    getTicketStub = sinon.stub(TicketRepository.prototype, 'getTicketById').resolves({ ticket_id: ticketId } as Ticket);
    assertStub = sinon.stub(TagService.prototype, 'assertActiveTagIds').resolves();
    sinon.stub(TicketTagRepository.prototype, 'getTicketTagSummaries').resolves([tagA]);
    sinon.stub(TicketTagRepository.prototype, 'getTicketTagEvents').resolves([]);
    insertStub = sinon.stub(TicketTagRepository.prototype, 'insertTicketTags').resolves([]);
    deleteStub = sinon.stub(TicketTagRepository.prototype, 'deleteTicketTagsNotIn').resolves();
    boardTicketsStub = sinon.stub(BoardTicketRepository.prototype, 'insertBoardTicketsByTagIds').resolves();
  });

  afterEach(() => sinon.restore());

  describe('replaceTicketTags', () => {
    it('ends links outside the desired set before inserting missing links, then returns the result', async () => {
      const result = await service.replaceTicketTags(ticketId, [tagA.tag_id]);

      expect(deleteStub).to.have.been.calledOnceWith(ticketId, [tagA.tag_id]);
      expect(insertStub).to.have.been.calledOnceWith(ticketId, [tagA.tag_id]);
      expect(deleteStub).to.have.been.calledBefore(insertStub);
      expect(result).to.eql({ tags: [tagA], events: [] });
      expect(getTicketStub).to.have.been.calledOnce;
    });

    it('puts the ticket on the boards linked to the tags it newly gets, and no others', async () => {
      insertStub.resolves([{ tag_id: tagA.tag_id }]);

      await service.replaceTicketTags(ticketId, [tagA.tag_id, 'kept-tag']);

      expect(boardTicketsStub).to.have.been.calledOnceWith(ticketId, [tagA.tag_id]);
      expect(insertStub).to.have.been.calledBefore(boardTicketsStub);
    });

    it('puts the ticket on no board when it gets no new tag', async () => {
      await service.replaceTicketTags(ticketId, [tagA.tag_id]);

      expect(boardTicketsStub).to.not.have.been.called;
    });

    it('writes nothing when a tag is invalid', async () => {
      assertStub.rejects(new HTTP400('invalid'));

      try {
        await service.replaceTicketTags(ticketId, [tagA.tag_id]);
        expect.fail('Expected 400');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP400);
      }

      expect(deleteStub).to.not.have.been.called;
      expect(insertStub).to.not.have.been.called;
    });

    it('writes nothing when the ticket does not exist', async () => {
      getTicketStub.rejects(new ApiNotFoundError('Ticket not found'));

      try {
        await service.replaceTicketTags(ticketId, [tagA.tag_id]);
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }

      expect(deleteStub).to.not.have.been.called;
      expect(insertStub).to.not.have.been.called;
    });
  });

  describe('getTicketTags', () => {
    it('rejects a missing ticket', async () => {
      getTicketStub.rejects(new ApiNotFoundError('Ticket not found'));

      try {
        await service.getTicketTags(ticketId);
        expect.fail('Expected not found');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });
});
