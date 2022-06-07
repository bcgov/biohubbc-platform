import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import qs from 'qs';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../../database/db';
import { ApiGeneralError } from '../../../../errors/api-error';
import { IGetMapOccurrenceData, OccurrenceService } from '../../../../services/occurrence-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import { GET, listOccurrences } from './list';

chai.use(sinonChai);

describe('occurrences', () => {
  describe('openApiSchema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(GET.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      const basicRequest = {
        headers: {
          'content-type': 'application/json'
        },
        body: {},
        params: {},
        query: {}
      };

      describe('should throw an error when', () => {
        it('has invalid type', async () => {
          const request = { ...basicRequest, query: { spatial: false } };
          const response = requestValidator.validateRequest(request);

          expect(response.status).to.equal(400);
          expect(response.errors[0].message).to.equal('must be string');
        });
      });

      describe('should succeed when', () => {
        it('has valid undefined value', async () => {
          const request = { ...basicRequest, query: {} };
          const response = requestValidator.validateRequest(request);

          expect(response).to.equal(undefined);
        });

        it('has valid spatial value', async () => {
          const request = { ...basicRequest, query: { spatial: 'test' } };
          const response = requestValidator.validateRequest(request);

          expect(response).to.equal(undefined);
        });
      });
    });
    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(GET.apiDoc as unknown as OpenAPIResponseValidatorArgs);

      describe('should throw an error when', () => {
        describe('required return properties is missing', () => {
          it('property id', async () => {
            const apiResponse = [{}];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'id'");
          });

          it('property taxonid', async () => {
            const apiResponse = [
              {
                id: 1
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'taxonid'");
          });

          it('property geometry', async () => {
            const apiResponse = [
              {
                id: 1,
                taxonid: 'moose'
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'geometry'");
          });

          it('property observations', async () => {
            const apiResponse = [
              {
                id: 1,
                taxonid: 'moose',
                geometry: 'string'
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'observations'");
          });

          it('property observations.eventdate', async () => {
            const apiResponse = [
              {
                id: 1,
                taxonid: 'moose',
                geometry: 'string',
                observations: [{}]
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'eventdate'");
          });

          it('property observations.data', async () => {
            const apiResponse = [
              {
                id: 1,
                taxonid: 'moose',
                geometry: 'string',
                observations: [{ eventdate: {} }]
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'data'");
          });

          it('property observations.data.lifestage', async () => {
            const apiResponse = [
              {
                id: 1,
                taxonid: 'moose',
                geometry: 'string',
                observations: [{ eventdate: {}, data: [{}] }]
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'lifestage'");
          });

          it('property observations.data.vernacularname', async () => {
            const apiResponse = [
              {
                id: 1,
                taxonid: 'moose',
                geometry: 'string',
                observations: [{ eventdate: {}, data: [{ lifestage: 'string' }] }]
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'vernacularname'");
          });

          it('property observations.data.sex', async () => {
            const apiResponse = [
              {
                id: 1,
                taxonid: 'moose',
                geometry: 'string',
                observations: [{ eventdate: {}, data: [{ lifestage: 'string', vernacularname: 'string' }] }]
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'sex'");
          });

          it('property observations.data.individualcount', async () => {
            const apiResponse = [
              {
                id: 1,
                taxonid: 'moose',
                geometry: 'string',
                observations: [
                  { eventdate: {}, data: [{ lifestage: 'string', vernacularname: 'string', sex: 'string' }] }
                ]
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'individualcount'");
          });

          it('property observations.data.organismquantity', async () => {
            const apiResponse = [
              {
                id: 1,
                taxonid: 'moose',
                geometry: 'string',
                observations: [
                  {
                    eventdate: {},
                    data: [{ lifestage: 'string', vernacularname: 'string', sex: 'string', individualcount: 0 }]
                  }
                ]
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'organismquantity'");
          });

          it('property observations.data.organismquantitytype', async () => {
            const apiResponse = [
              {
                id: 1,
                taxonid: 'moose',
                geometry: 'string',
                observations: [
                  {
                    eventdate: {},
                    data: [
                      {
                        lifestage: 'string',
                        vernacularname: 'string',
                        sex: 'string',
                        individualcount: 0,
                        organismquantity: 'string'
                      }
                    ]
                  }
                ]
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'organismquantitytype'");
          });
        });

        describe('return properties are invalid types', () => {
          it('null value', async () => {
            const apiResponse = null;
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be array');
          });
        });
      });

      describe('should succeed when', () => {
        it('has valid empty value', async () => {
          const apiResponse: any[] = [];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });

        it('has valid values', async () => {
          const apiResponse = [
            {
              id: 1,
              taxonid: 'moose',
              geometry: 'string',
              observations: [
                {
                  eventdate: {},
                  data: [
                    {
                      lifestage: 'string',
                      vernacularname: 'string',
                      sex: 'string',
                      individualcount: 0,
                      organismquantity: 'string',
                      organismquantitytype: 'string'
                    }
                  ]
                }
              ]
            }
          ];
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response).to.equal(undefined);
        });
      });
    });
  });

  describe('listOccurrences', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should throw an error if getMapOccurrences throws an ApiGeneralError', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(OccurrenceService.prototype, 'getMapOccurrences').throws('error' as unknown as ApiGeneralError);

      try {
        const requestHandler = listOccurrences();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect(dbConnectionObj.commit).to.not.be.called;
        expect(dbConnectionObj.rollback).to.be.calledOnce;
        expect(dbConnectionObj.release).to.be.calledOnce;
      }
    });

    it('should use spatial search if feature type is passed as query', async () => {
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const mockRequest = qs.stringify({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          coordinates: [
            [
              [1, 2],
              [1, 2],
              [1, 2],
              [1, 2],
              [1, 2]
            ]
          ]
        }
      });

      mockReq.query = { spatial: mockRequest };

      const mockResponse = [] as IGetMapOccurrenceData[];

      const serviceStub = sinon.stub(OccurrenceService.prototype, 'getMapOccurrences').resolves([]);

      const requestHandler = listOccurrences();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(serviceStub).to.be.calledOnceWith(qs.parse(mockRequest));
      expect(mockRes.jsonValue).to.eql(mockResponse);
    });

    it('should return rows on success', async () => {
      const mockDBConnection = getMockDBConnection();
      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      const mockResponse = [] as IGetMapOccurrenceData[];

      sinon.stub(OccurrenceService.prototype, 'getMapOccurrences').resolves([]);

      const requestHandler = listOccurrences();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.jsonValue).to.eql(mockResponse);
    });
  });
});
