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
import * as search from './search';
import { GET } from './search';

chai.use(sinonChai);

describe('search', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(GET.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      describe('should throw an error when', () => {
        describe('boundary', () => {
          it('is null', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                boundary: null
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('boundary');
            expect(response.errors[0].message).to.equal('must be array');
          });

          it('is not an array', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                boundary: 123
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

      describe('should succeed when', () => {
        it('all values are provided and valid', async () => {
          const request = {
            headers: {
              'content-type': 'application/json'
            },
            query: {
              boundary: ['not null'],
              type: ['type'],
              datasetID: ['id']
            }
          };
          const response = requestValidator.validateRequest(request);

          expect(response).to.be.undefined;
        });

        it('required values are provided and valid', async () => {
          const request = {
            headers: {
              'content-type': 'application/json'
            },
            query: {
              boundary: ['not null']
            }
          };
          const response = requestValidator.validateRequest(request);

          expect(response).to.be.undefined;
        });

        it('optional values are provided and valid', async () => {
          const request = {
            headers: {
              'content-type': 'application/json'
            },
            query: {
              boundary: ['not null'],
              type: null,
              datasetID: null
            }
          };
          const response = requestValidator.validateRequest(request);

          expect(response).to.be.undefined;
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
          expect(response.errors[0].message).to.equal('must be array');
        });

        it('returns invalid response (not an array of FeatureCollection)', async () => {
          // array of `Feature` rather than `FeatureCollection`
          const apiResponse = [
            {
              taxa_data: [
                { submission_spatial_component_id: 1 }
              ],
              spatial_data: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Point', coordinates: [-123.43791961669922, 48.63449682909913] }
              }
            }
          ];

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].path).to.equal('0/spatial_data');
          expect(response.errors[0].message).to.equal("must have required property 'features'");
          expect(response.errors[1].path).to.equal('0/spatial_data/type');
          expect(response.errors[1].message).to.equal('must be equal to one of the allowed values');
        });

        it('returns invalid response (missing submission_spatial_component_id)', async () => {
          const apiResponse = [
            {
              spatial_data: {
                type: 'FeatureCollection',
                properties: {},
                geometry: { type: 'Point', coordinates: [-123.43791961669922, 48.63449682909913] }
              }
            }
          ];

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].path).to.equal('0');
          expect(response.errors[0].message).to.equal("must have required property 'submission_spatial_component_id'");
        });
      });

      describe('should succeed when', () => {
        it('required values are valid (empty)', async () => {
          const apiResponse: any[] = [];

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });

        it('required values are valid', async () => {
          const apiResponse = [
            {
              taxa_data: [
                { submission_spatial_component_id: 1 }
              ],
              spatial_data: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'Polygon',
                      coordinates: [
                        [
                          [-123.43785926699638, 48.634569504210184],
                          [-123.43786899000405, 48.634561749249066],
                          [-123.43785356730223, 48.63456285710074],
                          [-123.43785926699638, 48.634569504210184]
                        ]
                      ]
                    }
                  },
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: {
                      type: 'Polygon',
                      coordinates: [
                        [
                          [-123.43785926699638, 48.634569504210184],
                          [-123.43786899000405, 48.634561749249066],
                          [-123.43785356730223, 48.63456285710074],
                          [-123.43785926699638, 48.634569504210184]
                        ]
                      ]
                    }
                  }
                ]
              }
            },
            {
              taxa_data: [
                { submission_spatial_component_id: 2 }
              ],
              spatial_data: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Point', coordinates: [-123.43791961669922, 48.63449682909913] }
                  }
                ]
              }
            }
          ];

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('searchSpatialComponents', () => {
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

      const requestHandler = search.searchSpatialComponents();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
        expect(dbConnectionObj.release).to.have.been.calledOnce;

        expect(findSpatialComponentsByCriteriaStub).to.be.calledWith({
          type: [],
          species: [],
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

      const requestHandler = search.searchSpatialComponents();

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

      const requestHandler = search.searchSpatialComponents();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);

      expect(getAPIUserDBConnectionStub).to.be.calledOnce;
    });

    it('returns 200', async () => {
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
        boundary: [JSON.stringify(boundaryFeature)]
      };

      const mockResponse: ISubmissionSpatialSearchResponseRow[] = [
        {
          taxa_data: [
            { submission_spatial_component_id: 1 }
          ],
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
          taxa_data: [
            { submission_spatial_component_id: 2 }
          ],
          spatial_component: {
            spatial_data: {
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  properties: { type: 'Occurrence' },
                  geometry: { type: 'Point', coordinates: [] }
                }
              ]
            }
          }
        }
      ];

      const findSpatialComponentsByCriteriaStub = sinon
        .stub(SpatialService.prototype, 'findSpatialComponentsByCriteria')
        .resolves(mockResponse);

      const requestHandler = search.searchSpatialComponents();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql([
        {
          submission_spatial_component_id: 1,
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
        },
        {
          submission_spatial_component_id: 2,
          spatial_data: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { type: 'Occurrence' },
                geometry: { type: 'Point', coordinates: [] }
              }
            ]
          }
        }
      ]);
      expect(dbConnectionObj.commit).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
      expect(findSpatialComponentsByCriteriaStub).to.be.calledWith({
        type: ['type'],
        species: [],
        datasetID: [],
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
