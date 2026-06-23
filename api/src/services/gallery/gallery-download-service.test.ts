import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockDownloadRecord, createMockDownloadVersionExportListRow } from '../../__mocks__/download';
import { createMockGalleryRecord } from '../../__mocks__/gallery';
import { ApiNotFoundError } from '../../errors/api-error';
import { DownloadRepository } from '../../repositories/download/download-repository';
import { DownloadVersionExportRepository } from '../../repositories/download/download-version-export-repository';
import { GalleryDownloadRepository } from '../../repositories/gallery/gallery-download-repository';
import { GalleryRepository } from '../../repositories/gallery/gallery-repository';
import { GalleryDownloadService } from './gallery-download-service';

chai.use(sinonChai);

describe('GalleryDownloadService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('addDownloadToGallery', () => {
    it('adds the download when both the gallery and download exist', async () => {
      // Verifies (S3): both guards pass, and the repo insert receives the
      // (galleryId, downloadId, sort) tuple including the explicit sort value.

      // Step 1: Stub the gallery guard and the download existence check to pass
      sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord({ gallery_id: 3 }));
      sinon.stub(DownloadRepository.prototype, 'getDownloadById').resolves(createMockDownloadRecord());
      const addStub = sinon.stub(GalleryDownloadRepository.prototype, 'addDownloadToGallery').resolves();

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Add a download with an explicit sort
      await service.addDownloadToGallery(3, 'aaaa0000-0000-0000-0000-000000000042', 5);

      // Step 4: The repo insert receives the full tuple, sort included
      expect(addStub).to.have.been.calledOnceWith(3, 'aaaa0000-0000-0000-0000-000000000042', 5);
    });

    it('forwards sort as null when it is omitted', async () => {
      // Verifies (S3b): an absent sort is resolved to null (`sort ?? null`) so the
      // member lands at the end of the gallery ordering.

      // Step 1: Stub both guards to pass
      sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord({ gallery_id: 3 }));
      sinon.stub(DownloadRepository.prototype, 'getDownloadById').resolves(createMockDownloadRecord());
      const addStub = sinon.stub(GalleryDownloadRepository.prototype, 'addDownloadToGallery').resolves();

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Add a download without a sort argument
      await service.addDownloadToGallery(3, 'aaaa0000-0000-0000-0000-000000000042');

      // Step 4: The repo insert receives null for sort
      expect(addStub).to.have.been.calledOnceWith(3, 'aaaa0000-0000-0000-0000-000000000042', null);
    });

    it('propagates ApiNotFoundError and skips the download check and write when the gallery is missing', async () => {
      // Verifies (S4): the gallery guard runs first; a missing gallery short-circuits
      // before the download lookup or any write.

      // Step 1: Stub the gallery guard to reject as not-found
      const getStub = sinon
        .stub(GalleryRepository.prototype, 'getGalleryById')
        .rejects(new ApiNotFoundError('Gallery not found'));
      const getDownloadStub = sinon.stub(DownloadRepository.prototype, 'getDownloadById');
      const addStub = sinon.stub(GalleryDownloadRepository.prototype, 'addDownloadToGallery');

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Attempt to add to a missing gallery
      try {
        await service.addDownloadToGallery(99, 'aaaa0000-0000-0000-0000-000000000042', 1);
        expect.fail('expected ApiNotFoundError');
      } catch (error) {
        // Step 4: The not-found error propagates and downstream steps never run
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect(getStub).to.have.been.calledOnceWith(99);
        expect(getDownloadStub).to.not.have.been.called;
        expect(addStub).to.not.have.been.called;
      }
    });

    it('propagates the not-found error from getDownloadById and does not write when the download does not exist', async () => {
      // Verifies (S5): a well-formed but non-existent download id is rejected by
      // getDownloadById (which throws internally) rather than letting the FK
      // violation surface as a 500 — and the membership write never happens.

      // Step 1: Stub the gallery guard to pass and the download get to throw not-found
      sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord({ gallery_id: 3 }));
      sinon.stub(DownloadRepository.prototype, 'getDownloadById').rejects(new ApiNotFoundError('Download not found'));
      const addStub = sinon.stub(GalleryDownloadRepository.prototype, 'addDownloadToGallery');

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Attempt to add a non-existent download
      try {
        await service.addDownloadToGallery(3, 'aaaa0000-0000-0000-0000-000000000099', 1);
        expect.fail('expected ApiNotFoundError');
      } catch (error) {
        // Step 4: The not-found error propagates and the write never happens
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect(addStub).to.not.have.been.called;
      }
    });
  });

  describe('removeDownloadFromGallery', () => {
    it('forwards the remove to the repository', async () => {
      // Verifies (S5b): the service delegates the soft-delete straight to the repo.

      // Step 1: Stub the repository remove
      const removeStub = sinon.stub(GalleryDownloadRepository.prototype, 'removeDownloadFromGallery').resolves();

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Remove a download from a gallery
      await service.removeDownloadFromGallery(3, 'aaaa0000-0000-0000-0000-000000000042');

      // Step 4: The repository received the membership coordinates
      expect(removeStub).to.have.been.calledOnceWith(3, 'aaaa0000-0000-0000-0000-000000000042');
    });
  });

  describe('getGalleryDownloads', () => {
    it('forwards the publicOnly flag to the gallery guard', async () => {
      // Verifies (V3): a public contents read scopes the gallery guard to public
      // galleries, so a private gallery's members surface as a 404.

      // Step 1: Stub the gallery guard to pass and the membership query to return none
      const getStub = sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord());
      sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloads').resolves([]);

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Read the gallery's contents with the public scope
      await service.getGalleryDownloads(1, true);

      // Step 4: The gallery guard received the publicOnly flag
      expect(getStub).to.have.been.calledOnceWith(1, true);
    });

    it('propagates ApiNotFoundError and fetches no members or exports when the gallery is missing', async () => {
      // Verifies (S6): the gallery guard runs before any membership or export work,
      // so a missing gallery is a 404 with no wasted fetches.

      // Step 1: Stub the gallery guard to reject as not-found
      const getStub = sinon
        .stub(GalleryRepository.prototype, 'getGalleryById')
        .rejects(new ApiNotFoundError('Gallery not found'));
      const membersStub = sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloads');
      const exportsStub = sinon.stub(DownloadVersionExportRepository.prototype, 'listExportsByDownloadVersionIds');

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Attempt to read contents of a missing gallery
      try {
        await service.getGalleryDownloads(99);
        expect.fail('expected ApiNotFoundError');
      } catch (error) {
        // Step 4: The not-found error propagates and no further work runs
        expect(error).to.be.instanceOf(ApiNotFoundError);
        expect(getStub).to.have.been.calledOnceWith(99);
        expect(membersStub).to.not.have.been.called;
        expect(exportsStub).to.not.have.been.called;
      }
    });

    it('returns an empty array and skips the export fetch when the gallery has no members', async () => {
      // Verifies (S7): an existing gallery with no active members short-circuits to
      // [] and never reaches the export batch fetch.

      // Step 1: Stub the gallery guard to pass and the membership query to return none
      sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord());
      const membersStub = sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloads').resolves([]);
      const exportsStub = sinon.stub(DownloadVersionExportRepository.prototype, 'listExportsByDownloadVersionIds');

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Read the empty gallery's contents
      const result = await service.getGalleryDownloads(1);

      // Step 4: The result is an empty array and the export fetch is skipped
      expect(result).to.eql([]);
      expect(membersStub).to.have.been.calledOnceWith(1);
      expect(exportsStub).to.not.have.been.called;
    });

    it('attaches grouped exports to each member, with an empty array for members that have none', async () => {
      // Verifies (S8): exports are grouped by download_id and spread onto each
      // member; a member with no exports falls through to [] (the `?? []` decision).

      // Step 1: Stub two members, one with exports and one without
      const memberA = createMockDownloadRecord({ download_id: 'a' });
      const memberB = createMockDownloadRecord({ download_id: 'b' });
      const exportA1 = createMockDownloadVersionExportListRow({
        download_version_export_id: 'ex-a1',
        download_id: 'a'
      });
      const exportA2 = createMockDownloadVersionExportListRow({
        download_version_export_id: 'ex-a2',
        download_id: 'a'
      });

      sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord());
      sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloads').resolves([memberA, memberB]);
      sinon
        .stub(DownloadVersionExportRepository.prototype, 'listExportsByDownloadVersionIds')
        .resolves([exportA1, exportA2]);

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Read the gallery's contents
      const result = await service.getGalleryDownloads(1);

      // Step 4: Member A carries its two exports; member B falls through to []
      expect(result).to.have.length(2);
      expect(result[0].download_id).to.equal('a');
      expect(result[0].exports).to.eql([exportA1, exportA2]);
      expect(result[1].download_id).to.equal('b');
      expect(result[1].exports).to.eql([]);
    });

    it('passes each member’s latest download version id to the export fetch', async () => {
      // Verifies (S9): every member's already-resolved latest download_version_id is
      // forwarded to the batch fetch — so exports[] reflects the displayed version and no
      // member is silently dropped from the exports lookup.

      // Step 1: Stub three members with distinct download version ids
      const versionIds = ['version-1', 'version-2', 'version-3'];
      sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord());
      sinon
        .stub(GalleryDownloadRepository.prototype, 'getGalleryDownloads')
        .resolves(
          versionIds.map((id, index) =>
            createMockDownloadRecord({ download_id: `download-${index + 1}`, download_version_id: id })
          )
        );
      const exportsStub = sinon
        .stub(DownloadVersionExportRepository.prototype, 'listExportsByDownloadVersionIds')
        .resolves([]);

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Read the gallery's contents
      await service.getGalleryDownloads(1);

      // Step 4: The batch fetch receives the full download-version-id set in member order
      expect(exportsStub).to.have.been.calledOnceWith(versionIds);
    });

    it('preserves the member order returned by the repository', async () => {
      // Verifies (S8b): the service maps members in place, so the repository's
      // explicit ordering is the order the consumer sees.

      // Step 1: Stub members in a deliberate order
      sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord());
      sinon
        .stub(GalleryDownloadRepository.prototype, 'getGalleryDownloads')
        .resolves([
          createMockDownloadRecord({ download_id: 'first' }),
          createMockDownloadRecord({ download_id: 'second' })
        ]);
      sinon.stub(DownloadVersionExportRepository.prototype, 'listExportsByDownloadVersionIds').resolves([]);

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Read the gallery's contents
      const result = await service.getGalleryDownloads(1);

      // Step 4: The member order is preserved
      expect(result.map((member) => member.download_id)).to.eql(['first', 'second']);
    });
  });
});
