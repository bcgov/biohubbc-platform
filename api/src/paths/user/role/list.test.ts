import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { ApiGeneralError } from '../../../errors/api-error';
import { UserService } from '../../../services/user-service';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../__mocks__/db';
import * as list from './list';

chai.use(sinonChai);

describe('roles', () => {
  describe('openApiSchema', () => {
    describe('response validation', () => {
      const responseValidator = new OpenAPIResponseValidator(
        list.GET.apiDoc as unknown as OpenAPIResponseValidatorArgs
      );

      describe('should throw an error when', () => {
        describe('required return properties is missing', () => {
          it('property system_role_id', async () => {
            const apiResponse = [{}];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'system_role_id'");
          });

          it('property name', async () => {
            const apiResponse = [{ system_role_id: 1 }];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal("must have required property 'name'");
          });
        });

        describe('return properties are invalid types', () => {
          it('null value', async () => {
            const apiResponse = null;
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be array');
          });

          it('is not an object', async () => {
            const apiResponse = [''];
            const response = responseValidator.validateResponse(200, apiResponse);

            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be object');
          });

          it('property system_role_id', async () => {
            const apiResponse = [
              {
                system_role_id: '1',
                name: 'admin'
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);
            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be integer');
          });

          it('property name', async () => {
            const apiResponse = [
              {
                system_role_id: 1,
                name: 2
              }
            ];
            const response = responseValidator.validateResponse(200, apiResponse);
            expect(response.message).to.equal('The response was not valid.');
            expect(response.errors[0].message).to.equal('must be string');
          });
        });
      });
    });
  });

  describe('getRoleList', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should rollback on error', async () => {
      const dbConnectionObj = getMockDBConnection({
        commit: sinon.stub(),
        rollback: sinon.stub(),
        release: sinon.stub()
      });

      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(UserService.prototype, 'getRoles').throws('error' as unknown as ApiGeneralError);

      try {
        const requestHandler = list.getRoleList();

        await requestHandler(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (actualError) {
        expect(dbConnectionObj.commit).to.not.be.called;
        expect(dbConnectionObj.rollback).to.be.calledOnce;
        expect(dbConnectionObj.release).to.be.calledOnce;
      }
    });

    it('should return rows on success', async () => {
      const mockDBConnection = getMockDBConnection();

      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();

      sinon.stub(db, 'getDBConnection').returns(mockDBConnection);

      const mockResponse = [
        {
          system_role_id: 1,
          name: 'admin'
        }
      ];

      sinon.stub(UserService.prototype, 'getRoles').resolves(mockResponse);

      const requestHandler = list.getRoleList();

      await requestHandler(mockReq, mockRes, mockNext);

      expect(mockRes.jsonValue).to.eql(mockResponse);
    });
  });
});
