import { expect } from 'chai';
import { describe } from 'mocha';
import { default as Sinon, default as sinon } from 'sinon';
import { HTTPError } from '../errors/http-error';
import { getMockDBConnection } from '../__mocks__/db';
import { AdministrativeService } from './administrative-service';

describe('administrativeService', () => {
  describe('updateAdministrativeActivity', () => {
    afterEach(() => {
      Sinon.restore();
    });

    const dbConnectionObj = getMockDBConnection();
    const administrativeService = new AdministrativeService(dbConnectionObj);

    it('should throw a 500 error when failed to update administrative activity', async () => {
      const mockQuery = sinon.stub();

      mockQuery.resolves({
        rowCount: null
      });

      try {
        await administrativeService.updateAdministrativeActivity(1, 2);

        expect.fail();
      } catch (actualError) {
        expect((actualError as HTTPError).status).to.equal(500);
        expect((actualError as HTTPError).message).to.equal('Failed to update administrative activity');
      }
    });
  });
});
