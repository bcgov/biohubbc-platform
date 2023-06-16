import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
// import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { POST } from './requestAccess';
import { ISubmitArtifactRequestAccess } from '../../../services/gcnotify-service';

chai.use(sinonChai);

describe.only('requestAccess', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('request validation', () => {
    const requestValidator = new OpenAPIRequestValidator(POST.apiDoc as unknown as OpenAPIRequestValidatorArgs);

    const defaultRequest: { params: Partial<ISubmitArtifactRequestAccess> } = {
      params: {
        fullName: 'string',
        emailAddress: 'string',
        phoneNumber: 'string',
        reasonDescription: 'string',
        hasSignedAgreement: false,
        artifactIds: [1],
        pathToParent: 'string',
        companyInformation: {
          companyName: 'string',
          jobTitle: 'string',
          streetAddress: 'string',
          city: 'string',
          postalCode: 'string',
        },
        professionalOrganization: {
          organizationName: 'string',
          memberNumber: 'string',
        }
      }
    };

    describe('should throw an error when', () => {
      describe('missing field', () => {
        it('fullName', () => {
          const request = { ...defaultRequest }
          delete request.params.fullName;

          const response = requestValidator.validateRequest(request);
          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal("must have required property 'fullName'");
          expect(response.errors[0].path).to.equal("hello world");
        })
      });
      
    })
  });

});
