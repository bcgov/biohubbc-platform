import chai, { expect } from 'chai';
import { Feature, FeatureCollection } from 'geojson';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { ISubmissionSpatialComponent } from '../../../repositories/spatial-repository';
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
        describe('type', () => {
          it('is undefined', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                boundary: 'not null'
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('type');
            expect(response.errors[0].message).to.equal("must have required property 'type'");
          });

          it('is null', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                type: null,
                boundary: 'not null'
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('type');
            expect(response.errors[0].message).to.equal('must be array');
          });

          it('is not an array', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                type: 'not an array',
                boundary: 'not null'
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('type');
            expect(response.errors[0].message).to.equal('must be array');
          });
        });

        describe('boundary', () => {
          it('is undefined', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                type: [search.SPATIAL_COMPONENT_TYPE.BOUNDARY]
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('boundary');
            expect(response.errors[0].message).to.equal("must have required property 'boundary'");
          });

          it('is null', async () => {
            const request = {
              headers: {
                'content-type': 'application/json'
              },
              query: {
                type: [search.SPATIAL_COMPONENT_TYPE.OCCURRENCE],
                boundary: null
              }
            };

            const response = requestValidator.validateRequest(request);

            expect(response.status).to.equal(400);
            expect(response.errors[0].path).to.equal('boundary');
            expect(response.errors[0].message).to.equal('must be string');
          });
        });
      });

      describe('should succeed when', () => {
        it('values are valid', async () => {
          const request = {
            headers: {
              'content-type': 'application/json'
            },
            query: {
              type: [search.SPATIAL_COMPONENT_TYPE.OCCURRENCE],
              boundary: 'not null'
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
              featureCollection: {
                type: 'Feature',
                properties: {},
                geometry: { type: 'Point', coordinates: [-123.43791961669922, 48.63449682909913] }
              },
              submissionSpatialComponentId: 1
            }
          ];

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].path).to.equal('0/featureCollection');
          expect(response.errors[0].message).to.equal("must have required property 'features'");
          expect(response.errors[1].path).to.equal('0/featureCollection/type');
          expect(response.errors[1].message).to.equal('must be equal to one of the allowed values');
        });

        it('returns invalid response (missing submissionSpatialComponentId)', async () => {
          const apiResponse = [
            {
              featureCollection: {
                type: 'FeatureCollection',
                properties: {},
                geometry: { type: 'Point', coordinates: [-123.43791961669922, 48.63449682909913] }
              }
            }
          ];

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors[0].path).to.equal('0');
          expect(response.errors[0].message).to.equal("must have required property 'submissionSpatialComponentId'");
        });
      });

      describe('should succeed when', () => {
        it('required values are valid (empty)', async () => {
          const apiResponse: FeatureCollection[] = [];

          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });

        it('required values are valid', async () => {
          const apiResponse = [
            {
              featureCollection: {
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
              },
              submissionSpatialComponentId: 1
            },
            {
              featureCollection: {
                type: 'FeatureCollection',
                features: [
                  {
                    type: 'Feature',
                    properties: {},
                    geometry: { type: 'Point', coordinates: [-123.43791961669922, 48.63449682909913] }
                  }
                ]
              },
              submissionSpatialComponentId: 2
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

      const boundaryFeature: Feature = {
        type: 'Feature',
        properties: {},
        geometry: { type: 'Polygon', coordinates: [[]] }
      };

      mockReq.query = {
        type: [search.SPATIAL_COMPONENT_TYPE.OCCURRENCE],
        boundary: JSON.stringify(boundaryFeature)
      };

      sinon.stub(SpatialService.prototype, 'findSpatialComponentsByCriteria').throws(new Error('test error'));

      const requestHandler = search.searchSpatialComponents();

      try {
        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect((actualError as Error).message).to.equal('test error');
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
        expect(dbConnectionObj.release).to.have.been.calledOnce;
      }
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
        type: [search.SPATIAL_COMPONENT_TYPE.OCCURRENCE],
        boundary: JSON.stringify(boundaryFeature)
      };

      const mockResponse = [
        {
          spatial_component: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { type: 'Boundary' },
                geometry: { type: 'Polygon', coordinates: [[]] }
              }
            ]
          },
          submission_spatial_component_id: 1
        },
        {
          spatial_component: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { type: 'Occurrence' },
                geometry: { type: 'Point', coordinates: [[]] }
              }
            ]
          },
          submission_spatial_component_id: 2
        }
      ] as unknown as ISubmissionSpatialComponent[];

      sinon.stub(SpatialService.prototype, 'findSpatialComponentsByCriteria').resolves(mockResponse);

      const requestHandler = search.searchSpatialComponents();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql([
        {
          featureCollection: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { type: 'Boundary' },
                geometry: { type: 'Polygon', coordinates: [[]] }
              }
            ]
          },
          submissionSpatialComponentId: 1
        },
        {
          featureCollection: {
            type: 'FeatureCollection',
            features: [
              {
                type: 'Feature',
                properties: { type: 'Occurrence' },
                geometry: { type: 'Point', coordinates: [[]] }
              }
            ]
          },
          submissionSpatialComponentId: 2
        }
      ]);
      expect(dbConnectionObj.commit).to.have.been.calledOnce;
      expect(dbConnectionObj.release).to.have.been.calledOnce;
    });
  });
});
