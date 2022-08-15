import chai, { expect } from "chai";
import { Feature } from 'geojson';
import { describe } from "mocha";
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { SpatialService } from '../../../services/spatial-service';
// import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from "openapi-request-validator";
// import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from "openapi-response-validator";
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
// import { GET } from "./download";
import * as download from './download';

chai.use(sinonChai);

describe.only('download', () => {
    // describe('openApiScheme', () => {
    //     describe('request validation', () => {
    //         const requestValidator = new OpenAPIRequestValidator(GET.apiDoc as unknown as OpenAPIRequestValidatorArgs);

    //         describe('should throw an error when', () => {
    //             describe('boundry', () => {
    //                 it('is undefined', async () => {
    //                     const request = {
    //                         headers: {
    //                             'content-type': 'application/json'
    //                         },
    //                         query: {}
    //                     }

    //                     const response = requestValidator.validateRequest(request)
    //                     expect(response.status).to.equal(400);
    //                     expect(response.errors[0].path).to.equal('boundary');
    //                     expect(response.errors[0].message).to.equal("must have required property 'boundary'");
    //                 })
    //             })
    //         })
    //     })

    //     describe('response validation', () => {
    //         // const responseValidator = new OpenAPIResponseValidator(GET.apiDoc as unknown as OpenAPIResponseValidatorArgs);
    //         describe('should throw an error when', () => {
    //             it('returns a null response', async () => {});
    //             it('returns invalide/ malformed response (file buffer cannot be decoded)')
    //         })

    //         describe('should succeed when', () => {
    //             it('response data can be converted into zip (ADM)')
    //         })
    //     });
    // })
    
    describe('downloadSpatialComponents', () => {
        afterEach(() => {
            sinon.restore()
        });

        it('catches and re-throws an error', async () => {
            const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
            sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

            const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

            const boundaryFeature: Feature = {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Polygon', coordinates: [[]] }
            };

            mockReq.query = {
                type: ['type'],
                boundary: JSON.stringify(boundaryFeature)
            };

            sinon.stub(SpatialService.prototype, 'findSpatialComponentsByCriteria').throws(new Error('test error'));

            const requestHandler = download.downloadSpatialComponents();

            try {
                await requestHandler(mockReq, mockRes, mockNext);
                expect.fail();
            } catch (actualError) {
                expect((actualError as Error).message).to.equal('test error');
                expect(dbConnectionObj.rollback).to.have.been.calledOnce;
                expect(dbConnectionObj.release).to.have.been.calledOnce;
            }
        });
    });
})