import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../__mocks__/db';
import { ApiConflictError } from '../errors/api-error';
import { HTTPError } from '../errors/http-error';
import { Tag } from '../models/tag';
import { BoardTagRepository } from '../repositories/board-tag-repository';
import { TagRepository } from '../repositories/tag-repository';
import { TicketTagRepository } from '../repositories/ticket-tag-repository';
import { TagService } from './tag-service';

chai.use(sinonChai);

const tagA = '11111111-1111-1111-1111-111111111111';
const tagB = '22222222-2222-2222-2222-222222222222';

const mockTag: Tag = {
  tag_id: tagA,
  name: 'Fish',
  description: null,
  color: '#1E90FF',
  create_date: '2026-10-19T00:00:00.000Z'
};

describe('TagService', () => {
  let service: TagService;

  beforeEach(() => {
    service = new TagService(getMockDBConnection());
  });

  afterEach(() => sinon.restore());

  describe('createTag', () => {
    it('rejects a name already used by an active tag', async () => {
      sinon.stub(TagRepository.prototype, 'findTagByName').resolves(mockTag);
      const insertStub = sinon.stub(TagRepository.prototype, 'insertTag');

      try {
        await service.createTag({ name: 'FISH', description: null, color: '#000000' });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(insertStub).to.not.have.been.called;
    });

    it('inserts when the name is available', async () => {
      sinon.stub(TagRepository.prototype, 'findTagByName').resolves(undefined);
      const insertStub = sinon.stub(TagRepository.prototype, 'insertTag').resolves(mockTag);

      const result = await service.createTag({ name: 'Fish', description: null, color: '#1E90FF' });

      expect(insertStub).to.have.been.calledOnce;
      expect(result).to.eql(mockTag);
    });
  });

  describe('updateTag', () => {
    it('allows a tag to keep its own name with different casing', async () => {
      sinon.stub(TagRepository.prototype, 'getTagById').resolves(mockTag);
      sinon.stub(TagRepository.prototype, 'findTagByName').resolves(mockTag);
      const updateStub = sinon.stub(TagRepository.prototype, 'updateTag').resolves(mockTag);

      const tag = { name: 'FISH', description: null, color: '#1E90FF' };

      await service.updateTag(tagA, tag);

      expect(updateStub).to.have.been.calledOnceWith(tagA, tag);
    });

    it('rejects renaming to another active tag name', async () => {
      sinon.stub(TagRepository.prototype, 'getTagById').resolves(mockTag);
      sinon.stub(TagRepository.prototype, 'findTagByName').resolves({ ...mockTag, tag_id: tagB });
      const updateStub = sinon.stub(TagRepository.prototype, 'updateTag');

      try {
        await service.updateTag(tagA, { name: 'Other', description: null, color: '#1E90FF' });
        expect.fail('Expected conflict');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiConflictError);
      }

      expect(updateStub).to.not.have.been.called;
    });
  });

  describe('deleteTag', () => {
    it('soft deletes ticket and board links before the tag', async () => {
      sinon.stub(TagRepository.prototype, 'getTagById').resolves(mockTag);
      const ticketTagStub = sinon.stub(TicketTagRepository.prototype, 'deleteTicketTagsByTagId').resolves();
      const boardTagStub = sinon.stub(BoardTagRepository.prototype, 'deleteBoardTagsByTagId').resolves();
      const deleteStub = sinon.stub(TagRepository.prototype, 'deleteTag').resolves();

      await service.deleteTag(tagA);

      expect(ticketTagStub).to.have.been.calledOnceWith(tagA);
      expect(boardTagStub).to.have.been.calledOnceWith(tagA);
      expect(deleteStub).to.have.been.calledOnceWith(tagA);
      expect(ticketTagStub).to.have.been.calledBefore(deleteStub);
    });
  });

  describe('assertActiveTagIds', () => {
    it('does not query for an empty set', async () => {
      const getStub = sinon.stub(TagRepository.prototype, 'getActiveTagIds');

      await service.assertActiveTagIds([]);

      expect(getStub).to.not.have.been.called;
    });

    it('accepts duplicates of active tags', async () => {
      const getStub = sinon.stub(TagRepository.prototype, 'getActiveTagIds').resolves([{ tag_id: tagA }]);

      await service.assertActiveTagIds([tagA, tagA]);

      expect(getStub).to.have.been.calledOnceWith([tagA]);
    });

    it('rejects unknown or deleted tags with 400', async () => {
      sinon.stub(TagRepository.prototype, 'getActiveTagIds').resolves([{ tag_id: tagA }]);

      try {
        await service.assertActiveTagIds([tagA, tagB]);
        expect.fail('Expected 400');
      } catch (error) {
        expect((error as HTTPError).status).to.equal(400);
        expect((error as HTTPError).errors).to.eql([{ invalidTagIds: [tagB] }]);
      }
    });
  });
});
