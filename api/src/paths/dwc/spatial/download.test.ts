import { expect } from "chai";
import { describe } from "mocha";
import OpenAPIRequestValidator, { OpenAPIRequestValidatorArgs } from "openapi-request-validator";
import OpenAPIResponseValidator, { OpenAPIResponseValidatorArgs } from "openapi-response-validator";
import { GET } from "./download";


describe('download', () => {
    describe('openApiScheme', () => {
        describe('request validation', () => {
            const requestValidator = new OpenAPIRequestValidator(GET.apiDoc as unknown as OpenAPIRequestValidatorArgs);

            describe('should throw an error when', () => {
                describe('boundry', () => {
                    it('is undefined', async () => {
                        const request = {
                            headers: {
                                'content-type': 'application/json'
                            },
                            query: {}
                        }

                        const response = requestValidator.validateRequest(request)
                        expect(response.status).to.equal(400);
                        expect(response.errors[0].path).to.equal('boundary');
                        expect(response.errors[0].message).to.equal("must have required property 'boundary'");
                    })
                })
            })
        })

        describe('response validation', () => {
            const responseValidator = new OpenAPIResponseValidator(GET.apiDoc as unknown as OpenAPIResponseValidatorArgs);
            describe('should throw an error when', () => {
                it('returns a null response', async () => {});
                it('returns invalide/ malformed response (file buffer cannot be decoded)')
            })

            describe('should succeed when', () => {
                it('response data can be converted into zip (ADM)')
            })
        });
    })
})