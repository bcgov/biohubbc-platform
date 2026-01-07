import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import {
  ArtifactQuarantine,
  CreateArtifactQuarantine,
  UpdateArtifactQuarantine
} from '../../models/artifact-quarantine';
import { SecurityStatusEnum } from '../../models/artifact-quarantine-scan-file';
import { ArtifactQuarantineRepository } from '../../repositories/upload/artifact-quarantine-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactQuarantineService } from './artifact-quarantine-service';

chai.use(sinonChai);

describe('ArtifactQuarantineService', () => {
  let mockDBConnection: any;
  let service: ArtifactQuarantineService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new ArtifactQuarantineService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactQuarantine', () => {
    it('should return a single quarantine record', async () => {
      const fakeQuarantine: ArtifactQuarantine = {
        artifact_quarantine_id: 'uuid-1',
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.CLEAN
      };

      const stub = sinon.stub(ArtifactQuarantineRepository.prototype, 'getArtifactQuarantine').resolves(fakeQuarantine);

      const result = await service.getArtifactQuarantine('uuid-1');

      expect(stub).to.have.been.calledWith('uuid-1');
      expect(result).to.eql(fakeQuarantine);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactQuarantineRepository.prototype, 'getArtifactQuarantine').throws(new Error('DB Error'));

      try {
        await service.getArtifactQuarantine('uuid-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertArtifactQuarantine', () => {
    it('should insert a new quarantine record and return its ID', async () => {
      const fakeInput: CreateArtifactQuarantine = {
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.CLEAN
      };

      const stub = sinon
        .stub(ArtifactQuarantineRepository.prototype, 'insertArtifactQuarantine')
        .resolves({ quarantine_id: 'uuid-new' });

      const result = await service.insertArtifactQuarantine(fakeInput);

      expect(stub).to.have.been.calledWith(fakeInput);
      expect(result).to.eql({ quarantine_id: 'uuid-new' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateArtifactQuarantine = {
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.CLEAN
      };

      sinon.stub(ArtifactQuarantineRepository.prototype, 'insertArtifactQuarantine').throws(new Error('Insert failed'));

      try {
        await service.insertArtifactQuarantine(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('updateArtifactQuarantine', () => {
    it('should update an existing quarantine record and return its ID', async () => {
      const fakeInput: UpdateArtifactQuarantine = {
        security: SecurityStatusEnum.INFECTED
      };

      const stub = sinon
        .stub(ArtifactQuarantineRepository.prototype, 'updateArtifactQuarantine')
        .resolves({ quarantine_id: 'uuid-1' });

      const result = await service.updateArtifactQuarantine('uuid-1', fakeInput);

      expect(stub).to.have.been.calledWith('uuid-1', fakeInput);
      expect(result).to.eql({ quarantine_id: 'uuid-1' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateArtifactQuarantine = {
        security: SecurityStatusEnum.INFECTED
      };

      sinon.stub(ArtifactQuarantineRepository.prototype, 'updateArtifactQuarantine').throws(new Error('Update failed'));

      try {
        await service.updateArtifactQuarantine('uuid-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });
});
