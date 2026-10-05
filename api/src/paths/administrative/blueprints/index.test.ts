import Ajv from 'ajv';
import { expect } from 'chai';
import { RequestHandler } from 'express';
import sinon from 'sinon';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { dbDependencies } from '../../../database/db';
import { ensureHTTPError } from '../../../errors/http-error';
import { CreateBlueprintRequestSchema, UpdateBlueprintRequestSchema } from '../../../openapi/schemas/blueprint';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { BlueprintService } from '../../../services/blueprint-service';
import { BlueprintVersionService } from '../../../services/blueprint-version-service';
import { GET as typesGET } from '../feature-property-types';
import { createBlueprint, GET, getBlueprints, POST } from './index';
import { DELETE, GET as detailGET, getBlueprint, PUT, retireBlueprint, updateBlueprint } from './{blueprintId}';
import { PUT as defaultPUT, setDefaultBlueprint } from './{blueprintId}/default';

const operations = [GET, POST, detailGET, PUT, DELETE, defaultPUT, typesGET];

describe('Configuration API boundaries', () => {
  afterEach(() => sinon.restore());

  operations.forEach((operation, index) => {
    it(`operation ${index} requires only the system administrator role`, async () => {
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

  it('PUT updates supplied metadata through the shared transaction handler', async () => {
    const connection = getMockDBConnection({ commit: sinon.stub().resolves(), release: sinon.stub() });
    sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
    const result = { blueprint_id: 1, name: 'Renamed', description: null };
    const update = sinon.stub(BlueprintService.prototype, 'updateBlueprint').resolves(result as any);
    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
    mockReq.params = { blueprintId: '1' };
    mockReq.body = { name: 'Renamed', description: null };
    await (PUT[1] as RequestHandler)(mockReq, mockRes, mockNext);
    sinon.assert.calledWithExactly(update, 1, mockReq.body);
    sinon.assert.calledWith(mockRes.status, 200);
    sinon.assert.calledWith(mockRes.json, result);
    sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
    sinon.assert.calledOnce(connection.release as sinon.SinonStub);
  });

  const handlers = [
    ['getBlueprints', getBlueprints],
    ['createBlueprint', createBlueprint],
    ['getBlueprint', getBlueprint],
    ['updateBlueprint', updateBlueprint],
    ['retireBlueprint', retireBlueprint],
    ['setDefaultBlueprint', setDefaultBlueprint]
  ] as const;
  handlers.forEach(([method, handler]) => {
    it(`${method} commits the confirmed response and releases its connection`, async () => {
      const connection = getMockDBConnection({
        commit: sinon.stub().resolves(),
        rollback: sinon.stub().resolves(),
        release: sinon.stub()
      });
      sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
      const service = (
        method === 'createBlueprint'
          ? sinon.stub(BlueprintVersionService.prototype, method)
          : sinon.stub(BlueprintService.prototype, method)
      ).resolves({ blueprint_id: 1 } as any);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { blueprintId: '1' };
      mockReq.query = {};
      mockReq.body = { name: 'Schema' };
      await handler()(mockReq, mockRes, mockNext);
      sinon.assert.calledOnce(service);
      sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
      sinon.assert.calledOnce(connection.release as sinon.SinonStub);
      sinon.assert.calledWith(mockRes.json, { blueprint_id: 1 });
      sinon.assert.calledWith(mockRes.status, method === 'createBlueprint' ? 201 : 200);
    });

    it(`${method} rolls back and releases on failure`, async () => {
      const connection = getMockDBConnection({
        commit: sinon.stub().resolves(),
        rollback: sinon.stub().resolves(),
        release: sinon.stub()
      });
      sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
      const failure = new Error('failed');
      (method === 'createBlueprint'
        ? sinon.stub(BlueprintVersionService.prototype, method)
        : sinon.stub(BlueprintService.prototype, method)
      ).rejects(failure);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { blueprintId: '1' };
      mockReq.query = {};
      try {
        await handler()(mockReq, mockRes, mockNext);
        expect.fail('Expected failure');
      } catch (error) {
        expect(error).to.equal(failure);
      }
      sinon.assert.calledOnce(connection.rollback as sinon.SinonStub);
      sinon.assert.calledOnce(connection.release as sinon.SinonStub);
      sinon.assert.notCalled(connection.commit as sinon.SinonStub);
    });
  });

  it('validates camelCase bodies, nullable metadata, and forbidden lifecycle fields', () => {
    const ajv = new Ajv({ strict: false, formats: { date: /^\d{4}-\d{2}-\d{2}$/ } });
    const create = ajv.compile(CreateBlueprintRequestSchema);
    const update = ajv.compile(UpdateBlueprintRequestSchema);
    expect(create({ name: 'Schema' })).to.equal(true);
    for (const payload of [
      { name: ' ' },
      { name: 'Schema', versionNumber: 0 },
      { name: 'Schema', versionNumber: 1, is_default: true },
      { name: 'Schema', version_number: 1 }
    ]) {
      expect(create(payload)).to.equal(false);
    }
    expect(update({})).to.equal(true);
    expect(update({ versionNumber: 2 })).to.equal(false);
    expect(update({ description: null, parentBlueprintId: null, recordEffectiveDate: null })).to.equal(true);
    expect(update({ record_end_date: '2026-01-01' })).to.equal(false);
    expect(update({ isDefault: true })).to.equal(false);
  });
});
