import { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { dbDependencies } from '../../../database/db';
import { ensureHTTPError } from '../../../errors/http-error';
import { Tag } from '../../../models/tag';
import { TicketTags } from '../../../models/ticket-tag';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { TagService } from '../../../services/tag-service';
import { TicketTagService } from '../../../services/ticket-tag-service';
import { replaceTicketTags, GET as ticketTagsGET, PUT as ticketTagsPUT } from '../tickets/{ticketId}/tags';
import { createTag, GET, getTags, POST } from './index';
import { DELETE, deleteTag, PUT, updateTag } from './{tagId}';

const operations = { GET, POST, PUT, DELETE, ticketTagsGET, ticketTagsPUT };

const mockTag: Tag = {
  tag_id: '11111111-1111-1111-1111-111111111111',
  name: 'Fish',
  description: null,
  color: '#1E90FF',
  create_date: '2026-10-19T00:00:00.000Z'
};

describe('paths/administrative/tags', () => {
  afterEach(() => sinon.restore());

  Object.entries(operations).forEach(([name, operation]) => {
    it(`${name} requires only the system administrator role`, async () => {
      const authorize = sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(false);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { ticketId: '22222222-2222-2222-2222-222222222222' };

      try {
        await (operation[0] as RequestHandler)(mockReq, mockRes, mockNext);
        expect.fail('Expected forbidden');
      } catch (error) {
        expect(ensureHTTPError(error).status).to.equal(403);
      }

      // Ticket team members are deliberately not authorized: tags must never reach portal users.
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

  it('getTags passes the search filter and wraps the result', async () => {
    mockConnection();
    const getTagsStub = sinon.stub(TagService.prototype, 'getTags').resolves([mockTag]);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.query = { search: 'fi' };

    await getTags()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(getTagsStub, { search: 'fi' });
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ tags: [mockTag] });
  });

  it('createTag returns 201 with the created tag', async () => {
    const connection = mockConnection();
    const createStub = sinon.stub(TagService.prototype, 'createTag').resolves(mockTag);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'Fish', description: null, color: '#1E90FF' };

    await createTag()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(createStub, mockReq.body);
    expect(mockRes.statusValue).to.equal(201);
    expect(mockRes.jsonValue).to.eql(mockTag);
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
  });

  it('updateTag passes the tag id and body', async () => {
    mockConnection();
    const updateStub = sinon.stub(TagService.prototype, 'updateTag').resolves(mockTag);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { tagId: mockTag.tag_id };
    mockReq.body = { name: 'Fish', description: null, color: '#000000' };

    await updateTag()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(updateStub, mockTag.tag_id, mockReq.body);
    expect(mockRes.statusValue).to.equal(200);
  });

  it('deleteTag returns 204 and rolls back on failure', async () => {
    const connection = mockConnection();
    sinon.stub(TagService.prototype, 'deleteTag').rejects(new Error('boom'));
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { tagId: mockTag.tag_id };

    try {
      await deleteTag()(mockReq, mockRes, mockNext);
      expect.fail('Expected error');
    } catch (error) {
      expect((error as Error).message).to.equal('boom');
    }

    sinon.assert.calledOnce(connection.rollback as sinon.SinonStub);
    sinon.assert.notCalled(connection.commit as sinon.SinonStub);
    sinon.assert.calledOnce(connection.release as sinon.SinonStub);
  });

  it('replaceTicketTags passes the camelCase tagIds body to the service', async () => {
    mockConnection();
    const ticketTags: TicketTags = { tags: [], events: [] };
    const replaceStub = sinon.stub(TicketTagService.prototype, 'replaceTicketTags').resolves(ticketTags);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { ticketId: '22222222-2222-2222-2222-222222222222' };
    mockReq.body = { tagIds: [mockTag.tag_id] };

    await replaceTicketTags()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(replaceStub, '22222222-2222-2222-2222-222222222222', [mockTag.tag_id]);
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql(ticketTags);
  });
});
