import { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../../../constants/roles';
import { dbDependencies } from '../../../../../database/db';
import { ensureHTTPError } from '../../../../../errors/http-error';
import { authorizationDependencies } from '../../../../../request-handlers/security/authorization';
import { TagRuleService } from '../../../../../services/tag-rule-service';
import { GET as tagGET } from '../index';
import { createTagRule, GET, getTagRules, POST } from './index';
import { DELETE, deleteTagRule, GET as detailGET, PUT, updateTagRule } from './{tagRuleId}';
import { PUT as enabledPUT, updateTagRuleEnabled } from './{tagRuleId}/enabled';

const operations = { tagGET, GET, POST, detailGET, PUT, DELETE, enabledPUT };
const tagId = '22222222-2222-2222-2222-222222222222';
const tagRuleId = '11111111-1111-1111-1111-111111111111';

describe('paths/administrative/tags/{tagId}/rules', () => {
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

  it("getTagRules pages the tag's rules", async () => {
    mockConnection();
    const getStub = sinon.stub(TagRuleService.prototype, 'getTagRules').resolves([]);
    const countStub = sinon.stub(TagRuleService.prototype, 'getTagRulesCount').resolves(0);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { tagId };
    mockReq.query = { page: '2', limit: '10' };

    await getTagRules()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(getStub, tagId, { page: 2, limit: 10, sort: undefined, order: undefined });
    sinon.assert.calledOnceWithExactly(countStub, tagId);
    expect(mockRes.jsonValue).to.eql({
      tag_rules: [],
      pagination: { total: 0, per_page: 10, current_page: 2, last_page: 1, sort: undefined, order: undefined }
    });
  });

  it('createTagRule creates the rule for the tag in the route and returns 201', async () => {
    const connection = mockConnection();
    const createStub = sinon.stub(TagRuleService.prototype, 'createTagRule').resolves({} as any);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { tagId };
    mockReq.body = { name: 'Fish', description: null, expression: {} };

    await createTagRule()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(createStub, tagId, mockReq.body);
    expect(mockRes.statusValue).to.equal(201);
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
  });

  it('updateTagRule scopes the rule to the tag in the route', async () => {
    mockConnection();
    const updateStub = sinon.stub(TagRuleService.prototype, 'updateTagRule').resolves({} as any);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { tagId, tagRuleId };
    mockReq.body = { name: 'Fish', description: null, expression: {} };

    await updateTagRule()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(updateStub, tagId, tagRuleId, mockReq.body);
  });

  it('updateTagRuleEnabled passes the enabled flag', async () => {
    mockConnection();
    const enabledStub = sinon.stub(TagRuleService.prototype, 'updateTagRuleEnabled').resolves({} as any);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { tagId, tagRuleId };
    mockReq.body = { isEnabled: false };

    await updateTagRuleEnabled()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(enabledStub, tagId, tagRuleId, false);
    expect(mockRes.statusValue).to.equal(200);
  });

  const removeTagsCases: [unknown, boolean][] = [
    [undefined, false],
    ['false', false],
    [true, true],
    ['true', true]
  ];

  removeTagsCases.forEach(([removeTags, expected]) => {
    it(`deleteTagRule maps remove_tags=${String(removeTags)} to ${expected}`, async () => {
      mockConnection();
      const deleteStub = sinon.stub(TagRuleService.prototype, 'deleteTagRule').resolves();
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { tagId, tagRuleId };
      mockReq.query = removeTags === undefined ? {} : ({ remove_tags: removeTags } as any);

      await deleteTagRule()(mockReq, mockRes, mockNext);

      sinon.assert.calledOnceWithExactly(deleteStub, tagId, tagRuleId, expected);
      expect(mockRes.statusValue).to.equal(204);
    });
  });
});
