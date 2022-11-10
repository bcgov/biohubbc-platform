import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  AdministrativeRepository,
  IAdministrativeActivity,
  ICreateAdministrativeActivity
} from '../repositories/administrative-repository';
import { getMockDBConnection } from '../__mocks__/db';
import { AdministrativeService } from './administrative-service';

chai.use(sinonChai);

describe('administrativeService', () => {
  describe('updateAdministrativeActivity', () => {
    afterEach(() => {
      sinon.restore();
    });

    const dbConnectionObj = getMockDBConnection();
    const administrativeService = new AdministrativeService(dbConnectionObj);

    it('should return id value', async () => {
      const AdministrativeRepositoryStub = sinon
        .stub(AdministrativeRepository.prototype, 'updateAdministrativeActivity')
        .resolves({ id: 1 });

      const result = await administrativeService.updateAdministrativeActivity(1, 2);

      expect(result).to.eql({ id: 1 });
      expect(AdministrativeRepositoryStub).to.have.been.calledOnce;
    });
  });

  describe('getPendingAccessRequestCount', () => {
    afterEach(() => {
      sinon.restore();
    });

    const dbConnectionObj = getMockDBConnection();
    const administrativeService = new AdministrativeService(dbConnectionObj);

    it('should return id value', async () => {
      const AdministrativeRepositoryStub = sinon
        .stub(AdministrativeRepository.prototype, 'getPendingAccessRequestCount')
        .resolves(1);

      const result = await administrativeService.getPendingAccessRequestCount('string');

      expect(result).to.eql(1);
      expect(AdministrativeRepositoryStub).to.have.been.calledOnce;
    });
  });

  describe('createAdministrativeActivity', () => {
    afterEach(() => {
      sinon.restore();
    });

    const dbConnectionObj = getMockDBConnection();
    const administrativeService = new AdministrativeService(dbConnectionObj);

    it('should return id value', async () => {
      const AdministrativeRepositoryStub = sinon
        .stub(AdministrativeRepository.prototype, 'createAdministrativeActivity')
        .resolves({ id: 1 } as unknown as ICreateAdministrativeActivity);

      const result = await administrativeService.createAdministrativeActivity(1, 'string');

      expect(result).to.eql({ id: 1 });
      expect(AdministrativeRepositoryStub).to.have.been.calledOnce;
    });
  });

  describe('getAdministrativeActivities', () => {
    afterEach(() => {
      sinon.restore();
    });

    const dbConnectionObj = getMockDBConnection();
    const administrativeService = new AdministrativeService(dbConnectionObj);

    it('should return id value', async () => {
      const AdministrativeRepositoryStub = sinon
        .stub(AdministrativeRepository.prototype, 'getAdministrativeActivities')
        .resolves([{ id: 1 } as unknown as IAdministrativeActivity]);

      const result = await administrativeService.getAdministrativeActivities('string', ['string']);

      expect(result).to.eql([{ id: 1 }]);
      expect(AdministrativeRepositoryStub).to.have.been.calledOnce;
    });
  });
});
