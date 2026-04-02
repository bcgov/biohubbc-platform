// Integration test for cart checkout — verifies the full checkout flow
// (get feature IDs, create download, link features, update cart status)
// works correctly against the real database.
//
// Uses a transaction that is ROLLED BACK after each test, so no data is persisted.
//
// Run: make test-db
// Requires: make web (database must be running with seed data)

import { expect } from 'chai';
import SQL from 'sql-template-strings';
import { defaultPoolConfig, getAPIUserDBConnection, IDBConnection, initDBPool } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { CartService } from '../../services/cart-service';
import { DownloadService } from '../../services/download/download-service';
import { getOrCreateIntegrationTicketId } from '../helpers/test-submission-helpers';

describe('Cart checkout (integration)', function () {
  this.timeout(15000);

  let connection: IDBConnection;
  let cartService: CartService;
  let downloadService: DownloadService;

  before(() => {
    initDBPool(defaultPoolConfig);
  });

  beforeEach(async () => {
    connection = getAPIUserDBConnection();
    await connection.open();
    cartService = new CartService(connection);
    downloadService = new DownloadService(connection);
  });

  afterEach(async () => {
    await connection.rollback();
    connection.release();
  });

  /**
   * Helper: insert a minimal submission and return its ID.
   */
  async function createTestSubmission(): Promise<number> {
    const systemUserId = connection.systemUserId();

    await connection.sql(SQL`
      INSERT INTO contributor (client_id, description)
      SELECT 'SIMS', 'Integration test contributor'
      WHERE NOT EXISTS (
        SELECT 1
        FROM contributor
        WHERE client_id = 'SIMS'
          AND record_end_date IS NULL
      );
    `);

    const result = await connection.sql(SQL`
      INSERT INTO submission (uuid, system_user_id, contributor_id, name, description, comment, create_user)
      VALUES (
        gen_random_uuid(),
        ${systemUserId},
        (SELECT contributor_id FROM contributor WHERE client_id = 'SIMS' AND record_end_date IS NULL LIMIT 1),
        'Cart Checkout Test',
        'Test',
        'Test',
        ${systemUserId}
      )
      RETURNING submission_id;
    `);

    return result.rows[0].submission_id;
  }

  /**
   * Helper: insert a submission_feature and return its ID.
   */
  async function createTestFeature(submissionId: number, data: Record<string, unknown>): Promise<number> {
    const systemUserId = connection.systemUserId();
    const dataJson = JSON.stringify(data);

    const uploadResult = await connection.sql(SQL`
      INSERT INTO upload (upload_status, record_end_date, create_user)
      VALUES ('completed', now(), ${systemUserId})
      RETURNING upload_id;
    `);
    const uploadId = uploadResult.rows[0].upload_id;

    const ticket_id = await getOrCreateIntegrationTicketId(connection, submissionId, uploadId, systemUserId);

    const bridgeResult = await connection.sql(SQL`
      INSERT INTO submission_upload (submission_id, upload_id, ticket_id, create_user)
      VALUES (${submissionId}, ${uploadId}, ${ticket_id}, ${systemUserId})
      RETURNING submission_upload_id;
    `);
    const submissionUploadId = bridgeResult.rows[0].submission_upload_id;

    const result = await connection.sql(SQL`
      INSERT INTO submission_feature (submission_id, submission_upload_id, feature_type_id, data, data_byte_size, create_user)
      VALUES (
        ${submissionId},
        ${submissionUploadId},
        (SELECT feature_type_id FROM feature_type WHERE name = 'dataset' LIMIT 1),
        ${dataJson}::jsonb,
        octet_length(${dataJson}::jsonb::text),
        ${systemUserId}
      )
      RETURNING submission_feature_id;
    `);

    return result.rows[0].submission_feature_id;
  }

  /**
   * Helper: create a cart, add features, and return the cart ID.
   */
  async function createCartWithFeatures(featureIds: number[]): Promise<string> {
    const systemUserId = connection.systemUserId();
    const response = await cartService.createCart(systemUserId, featureIds);

    return response.cart.cart_id;
  }

  it('should create download, link features, and mark cart as checked out', async () => {
    // Setup: create submission with two features and a cart
    const submissionId = await createTestSubmission();
    const featureId1 = await createTestFeature(submissionId, { name: 'Dataset A' });
    const featureId2 = await createTestFeature(submissionId, { name: 'Dataset B' });
    const cartId = await createCartWithFeatures([featureId1, featureId2]);

    const systemUserId = connection.systemUserId();

    // Act: checkout
    const result = await cartService.checkoutCart(cartId, systemUserId);

    // Verify: download record exists with pending status
    const download = await downloadService.findDownloadById(result.download_id);
    expect(download).to.not.be.null;
    expect(download!.download_status).to.equal('pending');

    // Verify: download has cart_id set (features resolved at pipeline time from cart_submission_feature)
    const downloadRow = await connection.sql(SQL`
      SELECT cart_id, filters FROM download WHERE download_id = ${result.download_id};
    `);
    expect(downloadRow.rows[0].cart_id).to.equal(cartId);
    expect(downloadRow.rows[0].filters).to.be.null;

    // Verify: getDownloadFeatures resolves both features from the cart
    const features = await downloadService.getDownloadFeatures(result.download_id);
    expect(features).to.have.length(2);
    const featureIds = features.map((f: { submission_feature_id: number }) => f.submission_feature_id).sort();
    expect(featureIds).to.deep.equal([featureId1, featureId2].sort());

    // Verify: cart status is checked_out with checkout metadata
    const cart = await connection.sql(SQL`
      SELECT cart_status, checkout_date, checkout_user FROM cart WHERE cart_id = ${cartId};
    `);
    expect(cart.rows[0].cart_status).to.equal('checked_out');
    expect(cart.rows[0].checkout_date).to.not.be.null;
    expect(cart.rows[0].checkout_user).to.equal(systemUserId);
  });

  it('should throw HTTP400 when checking out an empty cart', async () => {
    const cartId = await createCartWithFeatures([]);
    const systemUserId = connection.systemUserId();

    try {
      await cartService.checkoutCart(cartId, systemUserId);
      expect.fail('Expected HTTP400');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP400);
      expect((error as HTTP400).message).to.equal('Cannot checkout an empty cart');
    }
  });

  it('should fail on double checkout (cart is no longer active)', async () => {
    const submissionId = await createTestSubmission();
    const featureId = await createTestFeature(submissionId, { name: 'Dataset' });
    const cartId = await createCartWithFeatures([featureId]);
    const systemUserId = connection.systemUserId();

    // First checkout succeeds
    await cartService.checkoutCart(cartId, systemUserId);

    // Second checkout fails — cart status is 'checked_out', so getCartSubmissionFeatureIds
    // returns empty (it filters on cart_status = 'active'), triggering the empty-cart guard
    try {
      await cartService.checkoutCart(cartId, systemUserId);
      expect.fail('Expected error on double checkout');
    } catch (error) {
      expect(error).to.be.instanceOf(HTTP400);
      expect((error as HTTP400).message).to.equal('Cannot checkout an empty cart');
    }
  });
});
