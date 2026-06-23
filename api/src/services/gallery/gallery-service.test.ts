import chai, { expect } from 'chai';
import { describe } from 'mocha';
import sinon from 'sinon';
import sinonChai from 'sinon-chai';
import { getMockDBConnection } from '../../__mocks__/db';
import { createMockGalleryRecord } from '../../__mocks__/gallery';
import { ApiNotFoundError } from '../../errors/api-error';
import { HTTP409 } from '../../errors/http-error';
import { GalleryRepository } from '../../repositories/gallery/gallery-repository';
import { GalleryService } from './gallery-service';

chai.use(sinonChai);

describe('GalleryService', () => {
  afterEach(() => {
    sinon.restore();
  });

  describe('createGallery', () => {
    it('throws HTTP409 and does not write when an active gallery already uses the slug', async () => {
      // Verifies (S1): the active-slug pre-check short-circuits before the insert,
      // so a duplicate slug surfaces as a 409 rather than a unique-index 500.

      // Step 1: Stub the slug lookup to report an existing active gallery
      const findStub = sinon
        .stub(GalleryRepository.prototype, 'findActiveGalleryBySlug')
        .resolves(createMockGalleryRecord({ slug: 'home' }));
      const createStub = sinon.stub(GalleryRepository.prototype, 'createGallery');

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryService(mockDBConnection);

      // Step 3: Attempt to create a gallery with the taken slug
      try {
        await service.createGallery({ name: 'Home', slug: 'home', description: 'desc' });
        expect.fail('expected HTTP409');
      } catch (error) {
        // Step 4: The conflict is reported and the write never happens
        expect(error).to.be.instanceOf(HTTP409);
        expect(findStub).to.have.been.calledOnceWith('home');
        expect(createStub).to.not.have.been.called;
      }
    });

    it('creates the gallery with the resolved payload when the slug is free', async () => {
      // Verifies (S2): when the slug is free, the service forwards the exact
      // CreateGallery payload and returns the created row.

      // Step 1: Stub the slug lookup to report no existing gallery, and the insert to return a row
      sinon.stub(GalleryRepository.prototype, 'findActiveGalleryBySlug').resolves(null);
      const created = createMockGalleryRecord({
        gallery_id: 7,
        name: 'Featured',
        slug: 'featured',
        description: 'desc'
      });
      const createStub = sinon.stub(GalleryRepository.prototype, 'createGallery').resolves(created);

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryService(mockDBConnection);

      // Step 3: Create a gallery with a free slug and explicit visibility
      const result = await service.createGallery({
        name: 'Featured',
        slug: 'featured',
        visibility: 'private',
        description: 'desc'
      });

      // Step 4: The repository received the exact resolved payload
      expect(createStub).to.have.been.calledOnceWith({
        name: 'Featured',
        slug: 'featured',
        visibility: 'private',
        description: 'desc'
      });

      // Step 5: The created row is returned unchanged
      expect(result).to.eql(created);
    });

    it('defaults visibility to public and description to null when the request omits them', async () => {
      // Verifies (S2b): absent visibility/description are resolved to explicit
      // defaults (`'public'`, `null`) before reaching the write layer.

      // Step 1: Stub the slug lookup as free and capture the insert payload
      sinon.stub(GalleryRepository.prototype, 'findActiveGalleryBySlug').resolves(null);
      const createStub = sinon.stub(GalleryRepository.prototype, 'createGallery').resolves(createMockGalleryRecord());

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryService(mockDBConnection);

      // Step 3: Create a gallery with no visibility or description field
      await service.createGallery({ name: 'No description', slug: 'no-description' });

      // Step 4: The repository receives the resolved defaults
      expect(createStub).to.have.been.calledOnceWith({
        name: 'No description',
        slug: 'no-description',
        visibility: 'public',
        description: null
      });
    });
  });

  describe('updateGallery', () => {
    it('throws HTTP409 and does not write when the slug belongs to a different active gallery', async () => {
      // Verifies (S2c): the update pre-check rejects a slug already used by ANOTHER
      // active gallery with a clean 409, closing the gap where a colliding write
      // previously hit the unique index and surfaced a raw 500.

      // Step 1: Stub the slug lookup to report a DIFFERENT gallery owning the slug
      const findStub = sinon
        .stub(GalleryRepository.prototype, 'findActiveGalleryBySlug')
        .resolves(createMockGalleryRecord({ gallery_id: 99, slug: 'home' }));
      const updateStub = sinon.stub(GalleryRepository.prototype, 'updateGallery');

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryService(mockDBConnection);

      // Step 3: Attempt to move gallery 7 onto gallery 99's slug
      try {
        await service.updateGallery(7, { name: 'Home', slug: 'home', description: 'desc' });
        expect.fail('expected HTTP409');
      } catch (error) {
        // Step 4: The conflict is reported and the write never happens
        expect(error).to.be.instanceOf(HTTP409);
        expect(findStub).to.have.been.calledOnceWith('home');
        expect(updateStub).to.not.have.been.called;
      }
    });

    it('allows the update when the matching gallery is the one being updated (self-slug)', async () => {
      // Verifies (S2d): keeping a gallery's own slug (e.g. a name-only edit) must
      // NOT trip the pre-check against itself.

      // Step 1: Stub the slug lookup to return the SAME gallery being updated
      sinon
        .stub(GalleryRepository.prototype, 'findActiveGalleryBySlug')
        .resolves(createMockGalleryRecord({ gallery_id: 7, slug: 'home' }));
      const updated = createMockGalleryRecord({ gallery_id: 7, name: 'Home renamed', slug: 'home' });
      const updateStub = sinon.stub(GalleryRepository.prototype, 'updateGallery').resolves(updated);

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryService(mockDBConnection);

      // Step 3: Update gallery 7 keeping its own slug
      const result = await service.updateGallery(7, { name: 'Home renamed', slug: 'home', description: null });

      // Step 4: The update proceeds with the resolved payload and returns the row
      expect(updateStub).to.have.been.calledOnceWith(7, {
        name: 'Home renamed',
        slug: 'home',
        visibility: 'public',
        description: null
      });
      expect(result).to.eql(updated);
    });

    it('updates with the resolved payload when the slug is free', async () => {
      // Verifies (S2e): a free slug forwards the exact CreateGallery payload (absent
      // visibility/description resolved to defaults) and returns the updated row.

      // Step 1: Stub the slug lookup as free and the update to return a row
      sinon.stub(GalleryRepository.prototype, 'findActiveGalleryBySlug').resolves(null);
      const updated = createMockGalleryRecord({ gallery_id: 7, name: 'Renamed', slug: 'renamed', description: null });
      const updateStub = sinon.stub(GalleryRepository.prototype, 'updateGallery').resolves(updated);

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryService(mockDBConnection);

      // Step 3: Move gallery 7 to a free slug with no visibility or description field
      const result = await service.updateGallery(7, { name: 'Renamed', slug: 'renamed' });

      // Step 4: The repository receives the resolved payload and the row is returned
      expect(updateStub).to.have.been.calledOnceWith(7, {
        name: 'Renamed',
        slug: 'renamed',
        visibility: 'public',
        description: null
      });
      expect(result).to.eql(updated);
    });
  });

  describe('getGalleryById', () => {
    it('forwards the publicOnly flag to the repository', async () => {
      // Verifies (V1): a public read scopes the lookup to public galleries, so the
      // repository receives publicOnly=true and a private gallery surfaces as a 404.

      // Step 1: Stub the repository get
      const getStub = sinon
        .stub(GalleryRepository.prototype, 'getGalleryById')
        .resolves(createMockGalleryRecord({ gallery_id: 3 }));

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryService(mockDBConnection);

      // Step 3: Read gallery 3 with the public scope
      await service.getGalleryById(3, true);

      // Step 4: The repository received the publicOnly flag
      expect(getStub).to.have.been.calledOnceWith(3, true);
    });

    it('propagates ApiNotFoundError when no matching gallery is found', async () => {
      // Verifies (V2): a private gallery on a public read (or a missing gallery) is a 404.

      // Step 1: Stub the repository get to reject as not-found
      sinon.stub(GalleryRepository.prototype, 'getGalleryById').rejects(new ApiNotFoundError('Gallery not found'));

      // Step 2: Create the service
      const mockDBConnection = getMockDBConnection();
      const service = new GalleryService(mockDBConnection);

      // Step 3: The not-found error propagates
      try {
        await service.getGalleryById(99, true);
        expect.fail('expected ApiNotFoundError');
      } catch (error) {
        expect(error).to.be.instanceOf(ApiNotFoundError);
      }
    });
  });
});
