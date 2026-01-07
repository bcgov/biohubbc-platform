import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { SecurityStatusEnum } from '../../models/security-status';
import { ArtifactSecurityRepository } from '../../repositories/upload/artifact-security-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactSecurityService } from './artifact-security-service';

chai.use(sinonChai);

describe('ArtifactSecurityService', () => {
  let mockDBConnection: any;
  let service: ArtifactSecurityService;

  const mockSecurityRecord: ArtifactSecurity = {
    artifact_security_id: 'uuid-1',
    artifact_id: 'artifact-1',
    security: SecurityStatusEnum.CLEAN
  };

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new ArtifactSecurityService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurity', () => {
    it('should return a single security record', async () => {
      const stub = sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(mockSecurityRecord);

      const result = await service.getArtifactSecurity('uuid-1');

      expect(stub).to.have.been.calledOnceWithExactly('uuid-1');
      expect(result).to.eql(mockSecurityRecord);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').throws(new Error('DB Error'));

      try {
        await service.getArtifactSecurity('uuid-1');
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('DB Error');
      }
    });
  });

  describe('insertArtifactSecurity', () => {
    const fakeInput: CreateArtifactSecurity = {
      artifact_id: 'artifact-1',
      security: SecurityStatusEnum.CLEAN
    };

    it('should insert a new security record and return it', async () => {
      const stub = sinon
        .stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurity')
        .resolves(mockSecurityRecord);

      const result = await service.insertArtifactSecurity(fakeInput);

      expect(stub).to.have.been.calledOnceWithExactly(fakeInput);
      expect(result).to.eql(mockSecurityRecord);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurity').throws(new Error('Insert failed'));

      try {
        await service.insertArtifactSecurity(fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Insert failed');
      }
    });
  });

  describe('updateArtifactSecurity', () => {
    const fakeUpdate: UpdateArtifactSecurity = {
      security: SecurityStatusEnum.INFECTED
    };

    it('should update an existing security record and return it', async () => {
      const stub = sinon
        .stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity')
        .resolves(mockSecurityRecord);

      const result = await service.updateArtifactSecurity('uuid-1', fakeUpdate);

      expect(stub).to.have.been.calledOnceWithExactly('uuid-1', fakeUpdate);
      expect(result).to.eql(mockSecurityRecord);
    });

    it('should allow updating to the same security value', async () => {
      const stub = sinon
        .stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity')
        .resolves(mockSecurityRecord);

      const sameValueUpdate = { security: SecurityStatusEnum.CLEAN };
      const result = await service.updateArtifactSecurity('uuid-1', sameValueUpdate);

      expect(stub).to.have.been.calledOnceWithExactly('uuid-1', sameValueUpdate);
      expect(result).to.eql(mockSecurityRecord);
    });

    it('should throw an error if repository fails', async () => {
      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').throws(new Error('Update failed'));

      try {
        await service.updateArtifactSecurity('uuid-1', fakeUpdate);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });
});
