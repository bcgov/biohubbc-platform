import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { POST, requestAccess } from './requestAccess';

chai.use(sinonChai);

describe('requestAccess', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('request validation', () => {
    const requestValidator = new OpenAPIRequestValidator(GET.apiDoc as unknown as OpenAPIRequestValidatorArgs);

    describe('should throw an error when', () => {
      it('', () => {
        const request = {
          //
        };

        const response = requestValidator.validateRequest(request);
      })
    })
  });

});
