import chai, { expect } from 'chai';
import { describe } from 'mocha';
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from 'openapi-request-validator';
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from 'openapi-response-validator';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { POST } from './requestAccess';
import { cloneDeep } from 'lodash';

chai.use(sinonChai);

describe.only('requestAccess', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('OpenAPI schema', () => {
    describe('request validation', () => {
      const requestValidator = new OpenAPIRequestValidator(POST.apiDoc as unknown as OpenAPIRequestValidatorArgs);

      const defaultRequest: any = {
        headers: { 'content-type': 'application/json' },
        
        body: {
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
        it('artifactIds has less than one item', () => {
          const request = cloneDeep({ ...defaultRequest });
          request.body.artifactIds = [];

          const response = requestValidator.validateRequest(request);
    
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must NOT have fewer than 1 items');
          expect(response.errors[0].path).to.equal("artifactIds");
        });

        describe('request is missing field', () => {
          it('fullName', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.fullName;

            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'fullName'");
            expect(response.errors[0].path).to.equal("fullName");
          });

          it('emailAddress', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.emailAddress;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'emailAddress'");
            expect(response.errors[0].path).to.equal("emailAddress");
          });

          it('phoneNumber', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.phoneNumber;
    
            const response = requestValidator.validateRequest(request);
            console.log(response)
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'phoneNumber'");
            expect(response.errors[0].path).to.equal("phoneNumber");
          });

          it('reasonDescription', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.reasonDescription;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'reasonDescription'");
            expect(response.errors[0].path).to.equal("reasonDescription");
          });

          it('hasSignedAgreement', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.hasSignedAgreement;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'hasSignedAgreement'");
            expect(response.errors[0].path).to.equal("hasSignedAgreement");
          });

          it('artifactIds', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.artifactIds;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'artifactIds'");
            expect(response.errors[0].path).to.equal("artifactIds");
          });

          it('pathToParent', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.pathToParent;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'pathToParent'");
            expect(response.errors[0].path).to.equal("pathToParent");
          });

          it('companyInformation/companyName', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.companyInformation.companyName;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'companyName'");
            expect(response.errors[0].path).to.equal("companyInformation.companyName");
          });

          it('companyInformation/jobTitle', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.companyInformation.jobTitle;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'jobTitle'");
            expect(response.errors[0].path).to.equal("companyInformation.jobTitle");
          });

          it('companyInformation/streetAddress', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.companyInformation.streetAddress;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'streetAddress'");
            expect(response.errors[0].path).to.equal("companyInformation.streetAddress");
          });

          it('companyInformation/city', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.companyInformation.city;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'city'");
            expect(response.errors[0].path).to.equal("companyInformation.city");
          });

          it('companyInformation/city', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.companyInformation.city;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'city'");
            expect(response.errors[0].path).to.equal("companyInformation.city");
          });

          it('companyInformation/postalCode', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.companyInformation.postalCode;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'postalCode'");
            expect(response.errors[0].path).to.equal("companyInformation.postalCode");
          });

          it('professionalOrganization/organizationName', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.professionalOrganization.organizationName;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'organizationName'");
            expect(response.errors[0].path).to.equal("professionalOrganization.organizationName");
          });

          it('professionalOrganization/memberNumber', () => {
            const request = cloneDeep({ ...defaultRequest });
            delete request.body.professionalOrganization.memberNumber;
    
            const response = requestValidator.validateRequest(request);
      
            expect(response.errors.length).to.equal(1);
            expect(response.errors[0].message).to.equal("must have required property 'memberNumber'");
            expect(response.errors[0].path).to.equal("professionalOrganization.memberNumber");
          });
        });

      });

      describe('should not throw an error when', () => {
        it('all fields are included', () => {
          const request = cloneDeep({ ...defaultRequest });
          const response = requestValidator.validateRequest(request);
          expect(response).to.be.undefined;
        });

        it('only required fields are included', () => {
          const request = cloneDeep({ ...defaultRequest });

          delete request.body.companyInformation;
          delete request.body.professionalOrganization;

          const response = requestValidator.validateRequest(request);
          expect(response).to.be.undefined;
          expect(request.body.companyInformation).to.be.undefined;
          expect(request.body.professionalOrganization).to.be.undefined;
        });
      });
    });

    describe.only('response valiation', () => {
      const responseValidator = new OpenAPIResponseValidator(POST.apiDoc as unknown as OpenAPIResponseValidatorArgs);
      
      describe('should fail when', () => {
        it('respones is null', () => {
          const apiResponse = null;
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be boolean');
        });

        it('response is string', () => {
          const apiResponse = 'true';
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be boolean');
        });

        it('response is object', () => {
          const apiResponse = { key: 'value' };
          const response = responseValidator.validateResponse(200, apiResponse);

          expect(response.message).to.equal('The response was not valid.');
          expect(response.errors.length).to.equal(1);
          expect(response.errors[0].message).to.equal('must be boolean');
        })
      });

      describe('should succeed when', () => {
        it('response is boolean', () => {
          //
        })
      })
    })
  })

});
