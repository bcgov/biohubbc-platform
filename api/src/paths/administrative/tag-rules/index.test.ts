import { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { dbDependencies } from '../../../database/db';
import { ensureHTTPError } from '../../../errors/http-error';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { TagRuleService } from '../../../services/tag-rule-service';
import { createTagRule, GET, getTagRules, POST } from './index';
import { DELETE, deleteTagRule, GET as detailGET, PUT, updateTagRule } from './{tagRuleId}';

const operations = { GET, POST, detailGET, PUT, DELETE };
const tagRuleId = '11111111-1111-1111-1111-111111111111';

describe('paths/administrative/tag-rules', () => {
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

  it('getTagRules wraps the rule list', async () => {
    mockConnection();
    sinon.stub(TagRuleService.prototype, 'getTagRules').resolves([]);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    await getTagRules()(mockReq, mockRes, mockNext);

    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql({ tag_rules: [] });
  });

  it('createTagRule returns 201 and commits', async () => {
    const connection = mockConnection();
    const createStub = sinon.stub(TagRuleService.prototype, 'createTagRule').resolves({} as any);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.body = { name: 'Needs Review' };

    await createTagRule()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(createStub, mockReq.body);
    expect(mockRes.statusValue).to.equal(201);
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
  });

  it('updateTagRule passes the rule id and body', async () => {
    mockConnection();
    const updateStub = sinon.stub(TagRuleService.prototype, 'updateTagRule').resolves({} as any);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { tagRuleId };
    mockReq.body = { name: 'Needs Review' };

    await updateTagRule()(mockReq, mockRes, mockNext);

    sinon.assert.calledOnceWithExactly(updateStub, tagRuleId, mockReq.body);
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
      mockReq.params = { tagRuleId };
      mockReq.query = removeTags === undefined ? {} : ({ remove_tags: removeTags } as any);

      await deleteTagRule()(mockReq, mockRes, mockNext);

      sinon.assert.calledOnceWithExactly(deleteStub, tagRuleId, expected);
      expect(mockRes.statusValue).to.equal(204);
    });
  });
});
