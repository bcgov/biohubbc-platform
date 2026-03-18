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

    const result = await connection.sql(SQL`
      INSERT INTO submission (uuid, system_user_id, source_system, name, description, comment, create_user)
      VALUES (gen_random_uuid(), ${systemUserId}, 'SIMS', 'Cart Checkout Test', 'Test', 'Test', ${systemUserId})
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

    const ticket_id = await getOrCreateIntegrationTicketId(connection, uploadId, systemUserId);

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

    // Verify: both features linked in download_feature
    const features = await connection.sql(SQL`
      SELECT submission_feature_id FROM download_feature
      WHERE download_id = ${result.download_id}
      ORDER BY submission_feature_id;
    `);
    expect(features.rows).to.have.length(2);
    expect(features.rows.map((r: { submission_feature_id: number }) => r.submission_feature_id)).to.deep.equal([
      featureId1,
      featureId2
    ]);

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

/**
 * Integration tests insert into `submission_upload` directly.
 * Since `submission_upload.ticket_id` is now NOT NULL, ensure a ticket exists first.
 */
async function getOrCreateIntegrationTicketId(connection: IDBConnection, uploadId: string, systemUserId: number) {
  const teamName = 'Integration Ticket Team';
  const subject = `Submission Upload - ${uploadId}`;

  const existingTicket = await connection.sql(SQL`
    SELECT ticket_id
    FROM ticket
    WHERE subject = ${subject}
      AND record_end_date IS NULL
    LIMIT 1;
  `);

  const existingTicketId = existingTicket.rows[0]?.ticket_id as string | undefined;
  if (existingTicketId) {
    return existingTicketId;
  }

  const existingTeam = await connection.sql(SQL`
    SELECT team_id
    FROM team
    WHERE name = ${teamName}
      AND record_end_date IS NULL
    LIMIT 1;
  `);

  const existingTeamId = existingTeam.rows[0]?.team_id as string | undefined;
  const teamId =
    existingTeamId ??
    (
      await connection.sql(SQL`
        INSERT INTO team (name, description, create_user)
        VALUES (${teamName}, 'Integration test team for ticket linking.', ${systemUserId})
        RETURNING team_id;
      `)
    ).rows[0].team_id;

  const nextSlug = await connection.sql(SQL`
    WITH
      day_context AS (
        SELECT TO_CHAR((now() AT TIME ZONE 'UTC')::date, 'DDD') AS day_of_year
      ),
      latest AS (
        SELECT
          COALESCE(MAX(RIGHT(ticket_slug, 5)::integer), -1) AS last_value
        FROM ticket, day_context
        WHERE ticket_slug LIKE day_context.day_of_year || '%'
      ),
      next_value AS (
        SELECT
          day_context.day_of_year,
          latest.last_value + 1 AS next_sequence
        FROM day_context, latest
      )
    SELECT
      day_of_year || LPAD(next_sequence::text, 5, '0') AS ticket_slug
    FROM next_value;
  `);

  const ticketSlug = nextSlug.rows[0].ticket_slug as string;

  const createdTicket = await connection.sql(SQL`
    INSERT INTO ticket (
      ticket_slug,
      subject,
      description,
      team_id,
      priority,
      status,
      create_user
    )
    VALUES (
      ${ticketSlug},
      ${subject},
      NULL,
      ${teamId},
      'medium',
      'open',
      ${systemUserId}
    )
    RETURNING ticket_id;
  `);

  const ticketId = createdTicket.rows[0].ticket_id as string;

  await connection.sql(SQL`
    INSERT INTO ticket_status (ticket_id, status, create_user)
    VALUES (${ticketId}, 'open', ${systemUserId});
  `);

  return ticketId;
}
