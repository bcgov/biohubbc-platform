import { expect } from 'chai';
import { describe } from 'mocha';
import { Readable } from 'node:stream';
import sinon from 'sinon';
import * as biohubTarParser from '../../utils/biohub-tar-parser';
import { getMockDBConnection } from '../../__mocks__/db';
import { ContributorCodesetCodeService } from '../contributor-codeset-code-service';
import { ContributorCodesetService } from '../contributor-codeset-service';
import { ContributorService } from '../contributor-service';
import { ObjectStorageService } from '../object-storage/object-storage-service';
import { CodesetIngestionService } from './codeset-ingestion-service';

describe('CodesetIngestionService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('ingestCodesetsFromTarball', () => {
    it('inserts contributor codes in bounded 10k batches', async () => {
      const dbConnection = getMockDBConnection();
      const service = new CodesetIngestionService(dbConnection);

      sinon
        .stub(ContributorService.prototype, 'getContributorBySubmissionUploadId')
        .resolves({ contributor_id: 123 } as any);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(ContributorCodesetService.prototype, 'createCodeset').resolves({ contributor_codeset_id: 321 } as any);

      const createCodesStub = sinon
        .stub(ContributorCodesetCodeService.prototype, 'createContributorCodesetCodes')
        .resolves([]);

      sinon.stub(biohubTarParser, 'streamCodesetsFromTarball').callsFake(async (_stream, onCodesets) => {
        const codes: Record<string, { label: string; description: string; external_id: string }> = {};
        for (let index = 0; index < 10001; index += 1) {
          codes[`key-${index}`] = {
            label: `label-${index}`,
            description: `desc-${index}`,
            external_id: `${index}`
          };
        }

        await onCodesets({
          agency: {
            label: 'Agency',
            description: 'Agency codes',
            external_id: 'agency',
            codes
          }
        } as any);
      });

      await service.ingestCodesetsFromTarball('archive/key.tar', 'submission-upload-1');

      expect(createCodesStub.callCount).to.equal(2);
      expect(createCodesStub.firstCall.args[0]).to.have.length(10000);
      expect(createCodesStub.secondCall.args[0]).to.have.length(1);
    });

    it('propagates tar stream extraction failures', async () => {
      const dbConnection = getMockDBConnection();
      const service = new CodesetIngestionService(dbConnection);

      sinon
        .stub(ContributorService.prototype, 'getContributorBySubmissionUploadId')
        .resolves({ contributor_id: 123 } as any);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(biohubTarParser, 'streamCodesetsFromTarball').rejects(new Error('codeset stream failed'));

      try {
        await service.ingestCodesetsFromTarball('archive/key.tar', 'submission-upload-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('codeset stream failed');
      }
    });

    it('throws when codeset payload is malformed', async () => {
      const dbConnection = getMockDBConnection();
      const service = new CodesetIngestionService(dbConnection);

      sinon
        .stub(ContributorService.prototype, 'getContributorBySubmissionUploadId')
        .resolves({ contributor_id: 123 } as any);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(biohubTarParser, 'streamCodesetsFromTarball').callsFake(async (_stream, onCodesets) => {
        await onCodesets({
          broken: {
            codes: {
              x: { label: 'X' }
            }
          }
        } as any);
      });

      try {
        await service.ingestCodesetsFromTarball('archive/key.tar', 'submission-upload-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('Codeset label is required');
      }
    });

    it('propagates contributor code persistence failures', async () => {
      const dbConnection = getMockDBConnection();
      const service = new CodesetIngestionService(dbConnection);

      sinon
        .stub(ContributorService.prototype, 'getContributorBySubmissionUploadId')
        .resolves({ contributor_id: 123 } as any);
      sinon.stub(ObjectStorageService.prototype, 'getFileStream').resolves(Readable.from(Buffer.alloc(0)));
      sinon.stub(ContributorCodesetService.prototype, 'createCodeset').rejects(new Error('create codeset failed'));
      sinon.stub(biohubTarParser, 'streamCodesetsFromTarball').callsFake(async (_stream, onCodesets) => {
        await onCodesets({
          agency: {
            label: 'Agency',
            description: 'Agency codes',
            external_id: 'agency',
            codes: {
              aarde: { label: 'Aarde' }
            }
          }
        } as any);
      });

      try {
        await service.ingestCodesetsFromTarball('archive/key.tar', 'submission-upload-1');
        expect.fail();
      } catch (error) {
        expect((error as Error).message).to.equal('create codeset failed');
      }
    });
  });
});
