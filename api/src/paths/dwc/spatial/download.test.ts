import AdmZip from 'adm-zip';
import chai, { expect } from 'chai';
import { Feature } from 'geojson';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { ISubmissionSpatialSearchResponseRow } from '../../../repositories/spatial-repository';
import { SpatialService } from '../../../services/spatial-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as download from './download';
import { GET } from './download';

chai.use(sinonChai);

describe('download', () => {
  describe('openApiScheme', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(GET.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      describe('should throw an error when', () => {
        describe('boundry', () => {
          it('is null', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                boundary: null,
                datasetID: []
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('boundary');
            expect(response.errors[0].message).to.equal('must be array');
          });

          it('is not a array', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                boundary: 123,
                datasetID: []
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('boundary');
            expect(response.errors[0].message).to.equal('must be array');
          });
        });

        describe('type', () => {
          it('is not an array', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                boundary: [],
                datasetID: [],
                type: 'not an array'
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('type');
            expect(response.errors[0].message).to.equal('must be array');
          });
        });

        describe('datasetID', () => {
          it('is undefined', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                boundary: []
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('datasetID');
            expect(response.errors[0].message).to.equal("must have required property 'datasetID'");
          });

          it('is null', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                boundary: [],
                datasetID: null
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('datasetID');
            expect(response.errors[0].message).to.equal('must be array');
          });

          it('is not an array', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                boundary: [],
                type: [],
                datasetID: 'not an array'
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('datasetID');
            expect(response.errors[0].message).to.equal('must be array');
          });
        });
      });
    });

    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(GET.apiDoc as unknown as OpenAPIResponseValidatorArgs);
      describe('should throw an error when', () => {
        it('returns a null response', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].path).to.equal('response');
          expect(response.errors[0].message).to.equal('must be string');
        });

        it('returns invalide response', () => {
          const apiResponse = [{}];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].message).to.equal('must be string');
        });
      });

      describe('should succeed when', () => {
        it('returns a response that can be turned back into object', async () => {
          const mockData: ISubmissionSpatialSearchResponseRow[] = [
            {
              taxa_data: [{ submission_spatial_component_id: 1 }],
              spatial_component: {
                spatial_data: {
                  type: 'FeatureCollection',
                  features: [
                    {
                      type: 'Feature',
                      properties: { type: 'Boundary' },
                      geometry: { type: 'Polygon', coordinates: [[]] }
                    }
                  ]
                }
              }
            },
            {
              taxa_data: [{ submission_spatial_component_id: 2 }],
              spatial_component: {
                spatial_data: {
                  type: 'FeatureCollection',
                  features: [
                    {
                      type: 'Feature',
                      properties: {
                        type: 'Occurrence'
                      },
                      geometry: { type: 'Point', coordinates: [] }
                    }
                  ]
                }
              }
            }
          ];
          // convert object into valid buffer
          const zip = new AdmZip();
          zip.addFile('results.json', Buffer.from(JSON.stringify(mockData)), 'Search Results.');

          const fileString = zip.toBuffer().toString('hex');
          const response = responseValidator.validateResponse(200, fileString);

          // Convert response back into a file
          const fileData = Buffer.from(fileString, 'hex');
          const responseZip = new AdmZip(fileData);
          const zipEntries = responseZip.getEntries();
          zipEntries.forEach((item) => {
            expect(JSON.parse(item.getData().toString())).to.eql(mockData);
          });

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('downloadSpatialComponents', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('catches and re-throws an error', async () => {
      const dbConnectionObj = getMockDBConnection({ rollback: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {};

      const findSpatialComponentsByCriteriaStub = sinon
        .stub(SpatialService.prototype, 'findSpatialComponentsByCriteria')
        .throws(new Error('test error'));

      const requestHandler = download.downloadSpatialComponents();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
        expect(dbConnectionObj.release).to.have.been.calledOnce;
        expect(findSpatialComponentsByCriteriaStub).to.be.calledWith({
          type: [],
          datasetID: [],
          boundary: []
        });
      }
    });

    it('uses getDBConnection', async () => {
      const dbConnectionObj = getMockDBConnection({ commit: sinon.stub(), release: sinon.stub() });
      const getDBConnectionStub = sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {};

      mockReq['keycloak_token'] = 'token';

      sinon.stub(SpatialService.prototype, 'findSpatialComponentsByCriteria').resolves([]);

      const requestHandler = download.downloadSpatialComponents();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);

      expect(getDBConnectionStub).to.be.calledWith('token');
    });

    it('uses getAPIUserDBConnection', async () => {
      const dbConnectionObj = getMockDBConnection({ commit: sinon.stub(), release: sinon.stub() });
      const getAPIUserDBConnectionStub = sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      mockReq.query = {};

      sinon.stub(SpatialService.prototype, 'findSpatialComponentsByCriteria').resolves([]);

      const requestHandler = download.downloadSpatialComponents();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);

      expect(getAPIUserDBConnectionStub).to.be.calledOnce;
    });

    it('returns 200', async () => {
      const datasetID = 'AAA-BBB-CCC-123';
      const dbConnectionObj = getMockDBConnection({ commit: sinon.stub(), release: sinon.stub() });
      sinon.stub(db, 'getAPIUserDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const boundaryFeature: Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[]] }
      };

      mockReq.query = {
        type: ['type'],
        boundary: [JSON.stringify(boundaryFeature)],
        datasetID: [datasetID]
      };

      const mockData: ISubmissionSpatialSearchResponseRow[] = [
        {
          taxa_data: [{ submission_spatial_component_id: 1 }],
          spatial_component: {
            spatial_data: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { type: 'Boundary' },
                  geometry: { type: 'Polygon', coordinates: [[]] }
                }
              ]
            }
          }
        },
        {
          taxa_data: [{ submission_spatial_component_id: 2 }],
          spatial_component: {
            spatial_data: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: {
                    type: 'Occurrence'
                  },
                  geometry: { type: 'Point', coordinates: [] }
                }
              ]
            }
          }
        }
      ];

      const findSpatialComponentsByCriteriaStub = sinon
        .stub(SpatialService.prototype, 'findSpatialComponentsByCriteria')
        .resolves(mockData);

      const requestHandler = download.downloadSpatialComponents();
      await requestHandler(mockReq, mockRes, mockNext);
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes).to.not.be.null;

      // Convert response back into a file
      const fileData = Buffer.from(mockRes.sendValue, 'hex');
      const zip = new AdmZip(fileData);
      const zipEntries = zip.getEntries();
      zipEntries.forEach((item) => {
        expect(JSON.parse(item.getData().toString())).to.eql(mockData);
      });
      expect(dbConnectionObj.commit).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
      expect(findSpatialComponentsByCriteriaStub).to.be.calledWith({
        type: ['type'],
        datasetID: [datasetID],
        boundary: [
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [[]] }
          }
        ]
      });
    });
  });
});
