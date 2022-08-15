import { expect } from 'chai';
import { Request } from 'express';
import { describe } from 'mocha';
import { HTTP401 } from '../../errors/http-error';
import * as authentication from './authentication';

describe('authenticateRequest', () => {
  describe('throws HTTP401', () => {
    it('when request is undefined', async () => {
      try {
        await authentication.authenticateRequest(undefined as unknown as Request);
        expect.fail();
      } catch (actualError) {
        expect(actualError).instanceOf(HTTP401);
      }
    });

    it('when request is empty', async () => {
      try {
        await authentication.authenticateRequest({} as unknown as Request);
        expect.fail();
      } catch (actualError) {
        expect(actualError).instanceOf(HTTP401);
      }
    });

    it('when headers are empty', async () => {
      try {
        await authentication.authenticateRequest({
          headers: {}
        } as unknown as Request);
        expect.fail();
      } catch (actualError) {
        expect(actualError).instanceOf(HTTP401);
      }
    });

    it('when authorization header is not a bearer token', async () => {
      try {
        await authentication.authenticateRequest({
          headers: {
            authorization: 'Not a bearer token'
          }
        } as unknown as Request);
        expect.fail();
      } catch (actualError) {
        expect(actualError).instanceOf(HTTP401);
      }
    });

    it('when authorization header bearer is missing the token', async () => {
      try {
        await authentication.authenticateRequest({
          headers: {
            authorization: 'Bearer '
          }
        } as unknown as Request);
        expect.fail();
      } catch (actualError) {
        expect(actualError).instanceOf(HTTP401);
      }
    });

    it('when authorization header bearer is not a valid token', async () => {
      try {
        await authentication.authenticateRequest({
          headers: {
            authorization: 'Bearer not-encoded'
          }
        } as unknown as Request);
        expect.fail();
      } catch (actualError) {
        expect(actualError).instanceOf(HTTP401);
      }
    });

    it('when authorization header bearer token is an missing required data', async () => {
      try {
        await authentication.authenticateRequest({
          headers: {
            // sample encoded json web token from jwt.io (without kid header)
            authorization:
              'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
          }
        } as unknown as Request);
        expect.fail();
      } catch (actualError) {
        expect(actualError).instanceOf(HTTP401);
      }
    });
  });
});

describe('authenticateRequestOptional', () => {
  describe('returns true', () => {
    it('when request is undefined', async () => {
      const requestMock = undefined as unknown as Request;

      const response = await authentication.authenticateRequestOptional(requestMock);

      expect(response).to.be.true;
      expect(requestMock?.['keycloak_token']).to.be.undefined;
    });

    it('when request is empty', async () => {
      const requestMock = {} as unknown as Request;

      const response = await authentication.authenticateRequestOptional(requestMock);

      expect(response).to.be.true;
      expect(requestMock['keycloak_token']).to.be.undefined;
    });

    it('when headers are empty', async () => {
      const requestMock = {
        headers: {}
      } as unknown as Request;

      const response = await authentication.authenticateRequestOptional(requestMock);

      expect(response).to.be.true;
      expect(requestMock['keycloak_token']).to.be.undefined;
    });

    it('when authorization header is not a bearer token', async () => {
      const requestMock = {
        headers: {
          authorization: 'Not a bearer token'
        }
      } as unknown as Request;

      const response = await authentication.authenticateRequestOptional(requestMock);

      expect(response).to.be.true;
      expect(requestMock['keycloak_token']).to.be.undefined;
    });

    it('when authorization header bearer is missing the token', async () => {
      const requestMock = {
        headers: {
          authorization: 'Bearer '
        }
      } as unknown as Request;

      const response = await authentication.authenticateRequestOptional(requestMock);

      expect(response).to.be.true;
      expect(requestMock['keycloak_token']).to.be.undefined;
    });

    it('when authorization header bearer is not a valid token', async () => {
      const requestMock = {
        headers: {
          authorization: 'Bearer not-encoded'
        }
      } as unknown as Request;

      const response = await authentication.authenticateRequestOptional(requestMock);

      expect(response).to.be.true;
      expect(requestMock['keycloak_token']).to.be.undefined;
    });

    it('when authorization header bearer token is an missing required data', async () => {
      const requestMock = {
        headers: {
          // sample encoded json web token from jwt.io (without kid header)
          authorization:
            'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
        }
      } as unknown as Request;

      const response = await authentication.authenticateRequestOptional(requestMock);

      expect(response).to.be.true;
      expect(requestMock['keycloak_token']).to.be.undefined;
    });
  });
});
