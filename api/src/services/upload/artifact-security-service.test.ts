import chai, { expect } from 'chai';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { ArtifactSecurity, CreateArtifactSecurity, UpdateArtifactSecurity } from '../../models/artifact-security';
import { SecurityStatusEnum } from '../../models/artifact-security-scan-file';
import { ArtifactSecurityRepository } from '../../repositories/upload/artifact-security-repository';
import { getMockDBConnection } from '../../__mocks__/db';
import { ArtifactSecurityService } from './artifact-security-service';

chai.use(sinonChai);

describe('ArtifactSecurityService', () => {
  let mockDBConnection: any;
  let service: ArtifactSecurityService;

  beforeEach(() => {
    mockDBConnection = getMockDBConnection();
    service = new ArtifactSecurityService(mockDBConnection);
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('getArtifactSecurity', () => {
    it('should return a single security record', async () => {
      const fakeSecurity: ArtifactSecurity = {
        artifact_security_id: 'uuid-1',
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.CLEAN
      };

      const stub = sinon.stub(ArtifactSecurityRepository.prototype, 'getArtifactSecurity').resolves(fakeSecurity);

      const result = await service.getArtifactSecurity('uuid-1');

      expect(stub).to.have.been.calledWith('uuid-1');
      expect(result).to.eql(fakeSecurity);
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
    it('should insert a new security record and return its ID', async () => {
      const fakeInput: CreateArtifactSecurity = {
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.CLEAN
      };

      const stub = sinon
        .stub(ArtifactSecurityRepository.prototype, 'insertArtifactSecurity')
        .resolves({ security_id: 'uuid-new' });

      const result = await service.insertArtifactSecurity(fakeInput);

      expect(stub).to.have.been.calledWith(fakeInput);
      expect(result).to.eql({ security_id: 'uuid-new' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: CreateArtifactSecurity = {
        artifact_id: 'artifact-1',
        security: SecurityStatusEnum.CLEAN
      };

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
    it('should update an existing security record and return its ID', async () => {
      const fakeInput: UpdateArtifactSecurity = {
        security: SecurityStatusEnum.INFECTED
      };

      const stub = sinon
        .stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity')
        .resolves({ security_id: 'uuid-1' });

      const result = await service.updateArtifactSecurity('uuid-1', fakeInput);

      expect(stub).to.have.been.calledWith('uuid-1', fakeInput);
      expect(result).to.eql({ security_id: 'uuid-1' });
    });

    it('should throw an error if repository fails', async () => {
      const fakeInput: UpdateArtifactSecurity = {
        security: SecurityStatusEnum.INFECTED
      };

      sinon.stub(ArtifactSecurityRepository.prototype, 'updateArtifactSecurity').throws(new Error('Update failed'));

      try {
        await service.updateArtifactSecurity('uuid-1', fakeInput);
        expect.fail('Expected error not thrown');
      } catch (err) {
        expect((err as Error).message).to.equal('Update failed');
      }
    });
  });
});
