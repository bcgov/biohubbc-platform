import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { PersecutionAndHarmSecurity } from '../../../repositories/security-repository';
import { SecurityService } from '../../../services/security-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as list from './list';
import { GET } from './list';

chai.use(sinonChai);

describe('getPersecutionAndHarmRules', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('openApiSchema', () => {
    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(GET.apiDoc as unknown as OpenAPIResponseValidatorArgs);

      describe('should throw an error when', () => {
        it('returns a null response', async () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be array');
        });

        describe('invalid types', () => {
          describe('persecution_or_harm_id', () => {
            it('is undefined', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: undefined,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'persecution_or_harm_id'");
            });

            it('is null', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: null,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });

            it('is wrong type', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: '1',
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });

            it('is not an integer', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1.1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });
          });

          describe('persecution_or_harm_type_id', () => {
            it('is undefined', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: undefined,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'persecution_or_harm_type_id'");
            });

            it('is null', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: null,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });

            it('is wrong type', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: '1',
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });

            it('is not an integer', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1.1,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });
          });

          describe('wldtaxonomic_units_id', () => {
            it('is undefined', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: undefined,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'wldtaxonomic_units_id'");
            });

            it('is null', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: null,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });

            it('is wrong type', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: '1',
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });

            it('is not an integer', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1.1,
                  name: 'name',
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be integer');
            });
          });

          describe('name', () => {
            it('is undefined', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: undefined,
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'name'");
            });

            it('is null', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: null,
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });

            it('is wrong type', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: 1,
                  description: 'description'
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });
          });

          describe('description', () => {
            it('is undefined', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: undefined
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal("must have required property 'description'");
            });

            it('is null', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: null
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });

            it('is wrong type', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: 1
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });

            it('is not a string', async () => {
              const apiResponse = [
                {
                  persecution_or_harm_id: 1,
                  persecution_or_harm_type_id: 1,
                  wldtaxonomic_units_id: 1,
                  name: 'name',
                  description: 1
                }
              ];
              const response = responseValidator.validateResponse(200, apiResponse);

              expect(response.message).to.equal('The response was not valid.');
              expect(response.errors.length).to.equal(1);
              expect(response.errors[0].message).to.equal('must be string');
            });
          });
        });

        describe('should succeed when', () => {
          it('returns an empty response', async () => {
            const apiResponse: PersecutionAndHarmSecurity[] = [];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response).to.equal(undefined);
          });

          it('required values are valid', async () => {
            const apiResponse = [
              {
                persecution_or_harm_id: 1,
                persecution_or_harm_type_id: 1,
                wldtaxonomic_units_id: 1,
                name: 'name',
                description: 'description'
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response).to.equal(undefined);
          });
        });
      });
    });
  });

  it('should return the rows on success (empty)', async () => {
    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.query = { type: 'string' };

    const mockGetPersecutionAndHarmRules = sinon
      .stub(SecurityService.prototype, 'getPersecutionAndHarmRules')
      .resolves([]);

    const requestHandler = list.getPersecutionAndHarmRules();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockGetPersecutionAndHarmRules).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql([]);
  });

  it('should return the rows on success (not empty)', async () => {
    const data = {
      persecution_or_harm_id: 1,
      persecution_or_harm_type_id: 2,
      wldtaxonomic_units_id: 3,
      name: 'name',
      description: 'description'
    };

    const dbConnectionObj = getMockDBConnection({
      commit: sinon.stub(),
      rollback: sinon.stub(),
      release: sinon.stub()
    });

    sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

    const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

    mockReq.query = { type: 'string' };

    const mockGetPersecutionAndHarmRules = sinon
      .stub(SecurityService.prototype, 'getPersecutionAndHarmRules')
      .resolves([data]);

    const requestHandler = list.getPersecutionAndHarmRules();

    await requestHandler(mockReq, mockRes, mockNext);

    expect(mockGetPersecutionAndHarmRules).to.have.been.calledOnce;
    expect(mockRes.statusValue).to.equal(200);
    expect(mockRes.jsonValue).to.eql([data]);
  });
});
