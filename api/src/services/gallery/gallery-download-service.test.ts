import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockDownloadRecord } from '../../__mocks__/download';
import { createMockGalleryRecord } from '../../__mocks__/gallery';
import { ApiNotFoundError } from '../../errors/api-error';
import { HTTP409 } from '../../errors/http-error';
import { DownloadRepository } from '../../repositories/download/download-repository';
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
      sinon.stub(GalleryDownloadRepository.prototype, 'galleryDownloadExists').resolves(false);
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
      sinon.stub(GalleryDownloadRepository.prototype, 'galleryDownloadExists').resolves(false);
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

    it('throws HTTP409 and does not write when the download already exists in the gallery', async () => {
      sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord({ gallery_id: 3 }));
      sinon.stub(DownloadRepository.prototype, 'getDownloadById').resolves(createMockDownloadRecord());
      sinon.stub(GalleryDownloadRepository.prototype, 'galleryDownloadExists').resolves(true);
      const addStub = sinon.stub(GalleryDownloadRepository.prototype, 'addDownloadToGallery');

      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      try {
        await service.addDownloadToGallery(3, 'aaaa0000-0000-0000-0000-000000000042', 1);
        expect.fail('expected HTTP409');
      } catch (error) {
        expect(error).to.be.instanceOf(HTTP409);
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
    it('uses the admin gallery guard', async () => {
      // Step 1: Stub the gallery guard to pass and the membership query to return none
      const getStub = sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord());
      sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloads').resolves([]);
      sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloadsCount').resolves(0);

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Read the gallery's contents
      await service.getGalleryDownloads(1);

      // Step 4: The admin gallery guard received the id
      expect(getStub).to.have.been.calledOnceWith(1);
    });

    it('propagates ApiNotFoundError and fetches no downloads or count when the gallery is missing', async () => {
      // Verifies (S6): the gallery guard runs before any membership or export work,
      // so a missing gallery is a 404 with no wasted fetches.

      // Step 1: Stub the gallery guard to reject as not-found
      const getStub = sinon
        .stub(GalleryRepository.prototype, 'getGalleryById')
        .rejects(new ApiNotFoundError('Gallery not found'));
      const membersStub = sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloads');
      const countStub = sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloadsCount');

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
        expect(countStub).to.not.have.been.called;
      }
    });

    it('returns empty downloads and count when the gallery has no download records', async () => {
      sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord());
      const membersStub = sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloads').resolves([]);
      const countStub = sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloadsCount').resolves(0);

      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      const result = await service.getGalleryDownloads(1);

      expect(result).to.eql({ downloads: [], count: 0 });
      expect(membersStub).to.have.been.calledOnceWith(1);
      expect(countStub).to.have.been.calledOnceWith(1);
    });

    it('uses Promise.all to fetch paginated downloads and count', async () => {
      sinon.stub(GalleryRepository.prototype, 'getGalleryById').resolves(createMockGalleryRecord());
      const members = [
        createMockDownloadRecord({ download_id: 'first' }),
        createMockDownloadRecord({ download_id: 'second' })
      ];
      const membersStub = sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloads').resolves(members);
      const countStub = sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloadsCount').resolves(7);

      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);
      const pagination = { page: 2, limit: 10, sort: 'create_date', order: 'desc' as const };

      const result = await service.getGalleryDownloads(1, pagination);

      expect(result).to.eql({ downloads: members, count: 7 });
      expect(membersStub).to.have.been.calledOnceWith(1, pagination);
      expect(countStub).to.have.been.calledOnceWith(1);
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
      sinon.stub(GalleryDownloadRepository.prototype, 'getGalleryDownloadsCount').resolves(2);

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryDownloadService(mockDBConnection);

      // Step 3: Read the gallery's contents
      const result = await service.getGalleryDownloads(1);

      // Step 4: The member order is preserved
      expect(result.downloads.map((member) => member.download_id)).to.eql(['first', 'second']);
    });
  });
});
