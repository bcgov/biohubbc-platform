import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import * as db from '../../../database/db';
import { HTTPError } from '../../../errors/http-error';
import { SecurityService } from '../../../services/security-service';
import { getMockDBConnection } from '../../../__mocks__/db';
import * as getSignedUrl from './getSignedUrl';

chai.use(sinonChai);

describe('getSignedUrl', () => {
  describe('getArtifactSignedUrl', () => {
    afterEach(() => {
      sinon.restore();
    });

    it('should return the signed URL successfully', async () => {
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 1000
      });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getSignedURLStub = sinon
        .stub(SecurityService.prototype, 'getSecuredArtifactBasedOnRulesAndPermissions')
        .resolves('sample-signedURL');

      let actualResult: any = null;

      const sampleReq = {
        params: {
          artifactId: 200
        }
      } as any;

      const sampleRes = {
        status: () => {
          return {
            send: (result: any) => {
              actualResult = result;
            }
          };
        }
      };

      const result = getSignedUrl.getArtifactSignedUrl();

      await result(sampleReq, sampleRes as any, null as unknown as any);

      expect(actualResult).to.eql('sample-signedURL');
      expect(getSignedURLStub).to.be.calledWith(200);
    });

    it('should catch and rethrow errors', async () => {
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 1000
      });
      sinon.stub(db, 'getDBConnection').returns(dbConnectionObj);

      const getS3SignedURLStub = sinon
        .stub(SecurityService.prototype, 'getSecuredArtifactBasedOnRulesAndPermissions')
        .throws(new Error('test failed to get signed URL'));

      const sampleReq = {
        params: {
          artifactId: 200
        }
      } as any;

      try {
        const result = getSignedUrl.getArtifactSignedUrl();

        await result(sampleReq, null as unknown as any, null as unknown as any);
        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).message).to.equal('test failed to get signed URL');
        expect(getS3SignedURLStub).to.be.calledOnce;
      }
    });
  });
});
