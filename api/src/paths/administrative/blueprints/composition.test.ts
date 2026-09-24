import Ajv from 'ajv';
import { expect } from 'chai';
import { RequestHandler } from 'express';
import { OpenAPIV3 } from 'openapi-types';
import sinon from 'sinon';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { dbDependencies } from '../../../database/db';
import { ensureHTTPError } from '../../../errors/http-error';
import { authorizationDependencies } from '../../../request-handlers/security/authorization';
import { BlueprintCompositionService } from '../../../services/blueprint-composition-service';
import { BlueprintFeatureTypePropertyService } from '../../../services/blueprint-feature-type-property-service';
import { BlueprintFeatureTypeService } from '../../../services/blueprint-feature-type-service';
import {
  createBlueprintFeatureTypeProperty,
  getBlueprintFeatureTypeProperties,
  GET as propertiesGET,
  POST as propertiesPOST
} from './{blueprintId}/properties';
import {
  deleteBlueprintFeatureTypeProperty,
  DELETE as propertyDELETE,
  PUT as propertyPUT,
  updateBlueprintFeatureTypeProperty
} from './{blueprintId}/properties/{assignmentId}';
import {
  createBlueprintFeatureType,
  getBlueprintFeatureTypes,
  GET as typesGET,
  POST as typesPOST
} from './{blueprintId}/types';
import { GET as availableTypesGET, getAvailableFeatureTypesForBlueprint } from './{blueprintId}/types/available';
import {
  deleteBlueprintFeatureType,
  getBlueprintFeatureType,
  DELETE as typeDELETE,
  GET as typeGET
} from './{blueprintId}/types/{assignmentId}';
import {
  GET as availablePropertiesGET,
  getAvailableFeaturePropertiesForBlueprintFeatureType
} from './{blueprintId}/types/{assignmentId}/properties/available';

const operations = [
  typesGET,
  typesPOST,
  propertiesGET,
  propertiesPOST,
  typeGET,
  typeDELETE,
  propertyPUT,
  propertyDELETE,
  availableTypesGET,
  availablePropertiesGET
];
describe('Blueprint composition API boundaries', () => {
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

  const handlers = [
    [BlueprintFeatureTypeService, 'getBlueprintFeatureTypes', getBlueprintFeatureTypes],
    [BlueprintFeatureTypeService, 'getBlueprintFeatureType', getBlueprintFeatureType],
    [BlueprintFeatureTypePropertyService, 'getBlueprintFeatureTypeProperties', getBlueprintFeatureTypeProperties],
    [BlueprintCompositionService, 'createBlueprintFeatureType', createBlueprintFeatureType],
    [BlueprintCompositionService, 'createBlueprintFeatureTypeProperty', createBlueprintFeatureTypeProperty],
    [BlueprintCompositionService, 'updateBlueprintFeatureTypeProperty', updateBlueprintFeatureTypeProperty],
    [BlueprintCompositionService, 'deleteBlueprintFeatureType', deleteBlueprintFeatureType],
    [BlueprintCompositionService, 'deleteBlueprintFeatureTypeProperty', deleteBlueprintFeatureTypeProperty],
    [BlueprintCompositionService, 'getAvailableFeatureTypesForBlueprint', getAvailableFeatureTypesForBlueprint],
    [
      BlueprintCompositionService,
      'getAvailableFeaturePropertiesForBlueprintFeatureType',
      getAvailableFeaturePropertiesForBlueprintFeatureType
    ]
  ] as const;
  handlers.forEach(([Service, method, handler]) => {
    it(`${method} commits the confirmed response and releases its connection`, async () => {
      const connection = getMockDBConnection({
        commit: sinon.stub().resolves(),
        rollback: sinon.stub().resolves(),
        release: sinon.stub()
      });
      sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
      const service = sinon.stub(Service.prototype as any, method).resolves({ blueprint_id: 1 } as any);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { blueprintId: '1', assignmentId: '2' };
      mockReq.query = {};
      mockReq.body = { name: 'Schema' };
      await handler()(mockReq, mockRes, mockNext);
      sinon.assert.calledOnce(service);
      sinon.assert.calledOnce(connection.commit as sinon.SinonStub);
      sinon.assert.calledOnce(connection.release as sinon.SinonStub);
      sinon.assert.calledWith(mockRes.json, { blueprint_id: 1 });
      sinon.assert.calledWith(
        mockRes.status,
        method === 'createBlueprintFeatureType' || method === 'createBlueprintFeatureTypeProperty' ? 201 : 200
      );
    });

    it(`${method} rolls back and releases on failure`, async () => {
      const connection = getMockDBConnection({
        commit: sinon.stub().resolves(),
        rollback: sinon.stub().resolves(),
        release: sinon.stub()
      });
      sinon.stub(dbDependencies, 'getDBConnection').returns(connection);
      const failure = new Error('failed');
      sinon.stub(Service.prototype as any, method).rejects(failure);
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.params = { blueprintId: '1', assignmentId: '2' };
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

  it('rejects sort and mutable identities while preserving boolean/omission semantics', () => {
    const ajv = new Ajv({ strict: false });
    const createBlueprintFeatureType = ajv.compile(
      (typesPOST.apiDoc!.requestBody as OpenAPIV3.RequestBodyObject).content['application/json'].schema!
    );
    const createBlueprintFeatureTypeProperty = ajv.compile(
      (propertiesPOST.apiDoc!.requestBody as OpenAPIV3.RequestBodyObject).content['application/json'].schema!
    );
    const updateBlueprintFeatureTypeProperty = ajv.compile(
      (propertyPUT.apiDoc!.requestBody as OpenAPIV3.RequestBodyObject).content['application/json'].schema!
    );
    expect(createBlueprintFeatureType({ featureTypeId: 3 })).equal(true);
    expect(createBlueprintFeatureType({ featureTypeId: 3, sort: 1 })).equal(false);
    expect(createBlueprintFeatureTypeProperty({ blueprintFeatureTypeId: 2, featurePropertyId: 5, sort: null })).equal(
      false
    );
    expect(updateBlueprintFeatureTypeProperty({ sort: 1 })).equal(false);
    expect(createBlueprintFeatureTypeProperty({ blueprintFeatureTypeId: 2, featurePropertyId: 5 })).equal(true);
    expect(updateBlueprintFeatureTypeProperty({ featurePropertyId: 6 })).equal(false);
    expect(updateBlueprintFeatureTypeProperty({ requiredValue: null })).equal(false);
    expect(updateBlueprintFeatureTypeProperty({ requiredValue: false, allowMultiple: true })).equal(true);
    expect(createBlueprintFeatureTypeProperty({ featurePropertyId: 5 })).equal(false);
  });
});

// Exercise the same OpenAPI router used by the API, including literal-vs-parameter matching.
import express from 'express';
import { initialize } from 'express-openapi';
import { AddressInfo } from 'node:net';
import { rootAPIDoc } from '../../../openapi/root-api-doc';
import * as availableRoutes from './{blueprintId}/types/available';
import * as typeRoutes from './{blueprintId}/types/{assignmentId}';

describe('Blueprint composition literal routing', () => {
  afterEach(() => sinon.restore());
  it('routes /types/available to the selector instead of a numeric assignment', async () => {
    const app = express();
    sinon.stub(authorizationDependencies, 'authorizeRequest').resolves(true);
    sinon.stub(dbDependencies, 'getDBConnection').returns(getMockDBConnection());
    const selector = sinon
      .stub(BlueprintCompositionService.prototype, 'getAvailableFeatureTypesForBlueprint')
      .resolves({ options: [], pagination: { total: 0, current_page: 1, last_page: 1, per_page: 25 } });
    const detail = sinon.stub(BlueprintFeatureTypeService.prototype, 'getBlueprintFeatureType');
    await initialize({
      app,
      apiDoc: {
        openapi: '3.0.0',
        info: { title: 'Routing test', version: '1' },
        paths: {},
        components: {
          responses: rootAPIDoc.components.responses,
          schemas: rootAPIDoc.components.schemas,
          securitySchemes: { Bearer: { type: 'http', scheme: 'bearer' } }
        }
      },
      paths: [
        { path: '/administrative/blueprints/{blueprintId}/types/{assignmentId}', module: typeRoutes },
        { path: '/administrative/blueprints/{blueprintId}/types/available', module: availableRoutes }
      ],
      securityHandlers: { Bearer: () => true }
    });
    const server = app.listen(0);
    try {
      const response = await fetch(
        `http://127.0.0.1:${(server.address() as AddressInfo).port}/administrative/blueprints/1/types/available`
      );
      expect(response.status).equal(200);
      sinon.assert.calledOnce(selector);
      sinon.assert.notCalled(detail);
    } finally {
      await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    }
  });
});
