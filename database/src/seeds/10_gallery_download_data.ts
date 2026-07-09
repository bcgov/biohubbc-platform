import { Knex } from 'knex';

const DB_SCHEMA = process.env.DB_SCHEMA;

/**
 * Seed the 'home' gallery with featured downloads for local and test environments only.
 *
 * Creates 12 gallery-eligible downloads (approved policy → download → ready version → gallery
 * membership) plus 2 ineligible ones (a pending and a failed version) so the landing section's
 * eligibility filter, hybrid pin/newest-first ordering, pagination, and feature-count formatting
 * are all observable locally. Membership create dates are staggered one hour apart so newest-first
 * ordering is deterministic, and the two oldest eligible memberships are pinned (sort 1 and 2) so
 * pins visibly lead the grid despite being the oldest additions.
 *
 * Idempotent: if the home gallery already has any active gallery_download membership, the seed
 * returns without inserting anything, so re-running adds nothing.
 */
export async function seed(knex: Knex): Promise<void> {
  await knex.transaction(async (trx) => {
    await trx.raw('set search_path = ??;', [DB_SCHEMA]);

    const gallery = await trx('gallery')
      .select('gallery_id')
      .where({ slug: 'home' })
      .whereNull('record_end_date')
      .first();

    // The home gallery is created by the earlier gallery seed; without it there is nothing to populate.
    if (!gallery) {
      return;
    }

    const existingMembership = await trx('gallery_download')
      .select('gallery_download_id')
      .where({ gallery_id: gallery.gallery_id })
      .whereNull('record_end_date')
      .first();

    if (existingMembership) {
      return;
    }

    // Resolve create_user for inserts (audit trigger may set it; fallback for environments where it does not)
    const createUserRow = await trx('system_user').whereNull('record_end_date').select('system_user_id').first();
    const createUser = createUserRow?.system_user_id ?? 1;

    /**
     * Create one featured download and its full FK chain: an approved policy (one per download —
     * the download_policy_unique constraint forbids sharing), the download itself, a version
     * carrying the materialization status, and the gallery membership.
     *
     * The membership's create_date is set at INSERT time via raw SQL (now() minus ageHours) rather
     * than a JS Date — the audit trigger freezes now() per transaction and makes create_date
     * immutable on UPDATE, so staggering must happen in the INSERT and in database time.
     */
    const seedFeaturedDownload = async (options: {
      name: string;
      description: string;
      versionStatus: 'ready' | 'pending' | 'failed';
      featureCount: number | null;
      sort: number | null;
      ageHours: number;
    }) => {
      const [policy] = await trx('policy')
        .insert({
          name: options.name,
          description: options.description,
          status: 'approved',
          create_user: createUser
        })
        .returning(['policy_id']);

      const [download] = await trx('download')
        .insert({
          policy_id: policy.policy_id,
          format: 'parquet',
          requested_by: null,
          create_user: createUser
        })
        .returning(['download_id']);

      await trx('download_version').insert({
        download_id: download.download_id,
        status: options.versionStatus,
        feature_count: options.featureCount,
        completed_at: options.versionStatus === 'pending' ? null : trx.fn.now(),
        materialized_at: options.versionStatus === 'ready' ? trx.fn.now() : null,
        error_message: options.versionStatus === 'failed' ? 'Materialization failed during export' : null,
        create_user: createUser
      });

      await trx('gallery_download').insert({
        gallery_id: gallery.gallery_id,
        download_id: download.download_id,
        sort: options.sort,
        create_date: trx.raw("now() - (? * interval '1 hour')", [options.ageHours]),
        create_user: createUser
      });
    };

    // Feature counts chosen to exercise the tile count formatter: singular (1), plain (412),
    // thousands compaction (17412 → 17.4k), millions compaction (2500000 → 2.5M); rest arbitrary.
    // The formatter cases sit at the newest (lowest age) positions so they land on page one.
    const eligibleDownloads: { featureCount: number; description: string }[] = [
      { featureCount: 17412, description: 'Moose aerial survey observations across the Skeena region' },
      { featureCount: 412, description: 'Coastal amphibian call-count monitoring stations' },
      { featureCount: 1, description: 'Single confirmed sighting of a northern spotted owl' },
      { featureCount: 2500000, description: 'Province-wide acoustic bat telemetry detections' },
      { featureCount: 96, description: 'Grizzly bear DNA hair-snag sampling sites' },
      { featureCount: 1204, description: 'Fisher den box occupancy records from the central interior' },
      { featureCount: 5300, description: 'Songbird point-count surveys in the Okanagan valley' },
      { featureCount: 88213, description: 'Caribou GPS collar relocations for the Chilcotin herds' },
      { featureCount: 342, description: 'Western toad breeding pond assessments' },
      { featureCount: 7, description: 'Badger burrow observations along the Thompson corridor' },
      { featureCount: 64000, description: 'Bull trout redd counts from long-term index streams' },
      { featureCount: 950, description: 'Marbled murrelet nest platform habitat plots' }
    ];

    // Older memberships have larger ageHours. The two oldest are pinned (sort 1 and 2) so the
    // curator-pin rule is visible locally: pins lead the grid even though they are the oldest.
    for (let i = 0; i < eligibleDownloads.length; i++) {
      await seedFeaturedDownload({
        name: `Featured Dataset ${i + 1}`,
        description: eligibleDownloads[i].description,
        versionStatus: 'ready',
        featureCount: eligibleDownloads[i].featureCount,
        sort: i === 10 ? 1 : i === 11 ? 2 : null,
        ageHours: i
      });
    }

    // Ineligible memberships: versions that never reached 'ready' must not tile in the gallery.
    await seedFeaturedDownload({
      name: 'Ineligible Pending Dataset',
      description: 'Still materializing; must not appear as a gallery tile',
      versionStatus: 'pending',
      featureCount: null,
      sort: null,
      ageHours: 12
    });

    await seedFeaturedDownload({
      name: 'Ineligible Failed Dataset',
      description: 'Materialization failed; must not appear as a gallery tile',
      versionStatus: 'failed',
      featureCount: null,
      sort: null,
      ageHours: 13
    });
  });
}
