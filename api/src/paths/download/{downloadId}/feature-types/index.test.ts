import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getDownloadFeatureTypes } from '.';
import { getMockDBConnection, getRequestHandlerMocks } from '../../../../__mocks__/db';
import * as db from '../../../../database/db';
import { HTTP403, HTTP409, HTTPError } from '../../../../errors/http-error';
import { DownloadExportFeatureType } from '../../../../models/download-version-export';
import { DownloadExportService } from '../../../../services/download/download-export-service';

chai.use(sinonChai);

const DOWNLOAD_ID = 'aaaa0000-0000-0000-0000-000000000001';

describe('paths/download/{downloadId}/feature-types/index', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('getDownloadFeatureTypes', () => {
    it('threads the path param and system user into getDownloadVersionExportFeatureTypes and returns its result', async () => {
      // Verifies: the GET reads downloadId from the path and the system user from the connection, passes
      // both to the service, and returns the feature-type array verbatim. The column derivation itself is
      // unit-tested on the service, not here.

      // Step 1: Stub the DB connection (spying commit) and the single service call
      const dbConnectionObj = getMockDBConnection({ systemUserId: () => 42, commit: sinon.stub() });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);

      const featureTypes: DownloadExportFeatureType[] = [
        { feature_type: 'observation', columns: ['submission_feature_id', 'uuid', 'parent_uuid'] }
      ];
      const featureTypesStub = sinon
        .stub(DownloadExportService.prototype, 'getDownloadVersionExportFeatureTypes')
        .resolves(featureTypes);

      // Step 2: Send the request with the path param
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };

      await getDownloadFeatureTypes()(mockReq, mockRes, mockNext);

      // Step 3: Verify the service got (downloadId, systemUserId)
      expect(featureTypesStub).to.have.been.calledOnceWith(DOWNLOAD_ID, 42);

      // Step 4: Verify the response and that the transaction committed
      expect(mockRes.statusValue).to.equal(200);
      expect(mockRes.jsonValue).to.eql(featureTypes);
      expect(dbConnectionObj.commit).to.have.been.calledOnce;
    });

    it('propagates HTTP403 and rolls back + releases the connection', async () => {
      // Verifies: an auth failure in the service surfaces unchanged through the route, and the
      // catch/finally still rolls back the transaction and releases the connection.

      // Step 1: Stub the DB connection (spying rollback + release) and reject from the service
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 42,
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadExportService.prototype, 'getDownloadVersionExportFeatureTypes')
        .rejects(new HTTP403('Access denied'));

      // Step 2: Send the request and capture the error
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };

      try {
        await getDownloadFeatureTypes()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        // Step 3: Verify the 403 propagated
        expect(error).to.be.instanceOf(HTTP403);
        expect((error as HTTPError).status).to.equal(403);

        // Step 4: Verify the failed transaction rolled back and the connection was released
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
        expect(dbConnectionObj.release).to.have.been.calledOnce;
      }
    });

    it('propagates HTTP409 when the download is not ready and rolls back + releases the connection', async () => {
      // Verifies: a not-ready download surfaces a 409 unchanged through the route, and the catch/finally
      // still rolls back the transaction and releases the connection.

      // Step 1: Stub the DB connection (spying rollback + release) and reject from the service
      const dbConnectionObj = getMockDBConnection({
        systemUserId: () => 42,
        rollback: sinon.stub(),
        release: sinon.stub()
      });
      sinon.stub(db.dbDependencies, 'getDBConnection').returns(dbConnectionObj);
      sinon
        .stub(DownloadExportService.prototype, 'getDownloadVersionExportFeatureTypes')
        .rejects(new HTTP409('Download is not ready'));

      // Step 2: Send the request and capture the error
      const { mockReq, mockRes, mockNext } = getRequestHandlerMocks();
      mockReq.keycloak_token = 'token';
      mockReq.params = { downloadId: DOWNLOAD_ID };

      try {
        await getDownloadFeatureTypes()(mockReq, mockRes, mockNext);
        expect.fail();
      } catch (error) {
        // Step 3: Verify the 409 propagated
        expect(error).to.be.instanceOf(HTTP409);
        expect((error as HTTPError).status).to.equal(409);

        // Step 4: Verify the failed transaction rolled back and the connection was released
        expect(dbConnectionObj.rollback).to.have.been.calledOnce;
        expect(dbConnectionObj.release).to.have.been.calledOnce;
      }
    });
  });
});
