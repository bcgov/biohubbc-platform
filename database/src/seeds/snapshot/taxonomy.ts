import { Knex } from 'knex';

/** Minimal ITIS-backed taxonomy records referenced by the committed snapshot features. */
const SNAPSHOT_TAXA = [
  {
    itisTsn: 177925,
    parentItisTsn: 177920,
    scientificName: 'Strix occidentalis',
    rank: 'Species',
    commonName: 'Spotted Owl'
  },
  { itisTsn: 180702, parentItisTsn: 1277211, scientificName: 'Alces', rank: 'Genus', commonName: 'Moose' },
  {
    itisTsn: 180703,
    parentItisTsn: 180702,
    scientificName: 'Alces alces',
    rank: 'Species',
    commonName: 'Moose'
  },
  {
    itisTsn: 180701,
    parentItisTsn: 180700,
    scientificName: 'Rangifer tarandus',
    rank: 'Species',
    commonName: 'Caribou'
  },
  {
    itisTsn: 625197,
    parentItisTsn: 180701,
    scientificName: 'Rangifer tarandus tarandus',
    rank: 'Subspecies',
    commonName: 'Caribou'
  }
] as const;

/**
 * Seed the taxonomy cache entries referenced by snapshot feature payloads.
 *
 * This runs before the snapshot idempotency check so an existing local snapshot can acquire missing
 * taxonomy data simply by rerunning the seeds. Existing active cache records are always preserved.
 */
export async function seedSnapshotTaxa(knex: Knex): Promise<void> {
  const systemUser = await knex('system_user')
    .select('system_user_id')
    .whereNull('record_end_date')
    .orderBy('system_user_id')
    .first();

  if (!systemUser) {
    throw new Error('seed 10: no active system user was found for snapshot taxonomy');
  }

  for (const taxon of SNAPSHOT_TAXA) {
    const existing = await knex('taxon')
      .select('taxon_id')
      .where({ itis_tsn: taxon.itisTsn })
      .whereNull('record_end_date')
      .first();

    if (existing) {
      continue;
    }

    await knex('taxon').insert({
      itis_tsn: taxon.itisTsn,
      parent_itis_tsn: taxon.parentItisTsn,
      itis_scientific_name: taxon.scientificName,
      rank: taxon.rank,
      common_name: taxon.commonName,
      itis_data: JSON.stringify({
        tsn: String(taxon.itisTsn),
        parentTSN: String(taxon.parentItisTsn),
        scientificName: taxon.scientificName,
        rank: taxon.rank,
        commonName: taxon.commonName,
        source: 'ITIS snapshot seed'
      }),
      itis_update_date: knex.fn.now(),
      create_user: systemUser.system_user_id
    });
  }

  // Preserve the stable ITIS relationship separately from the database FK, then resolve the FK only
  // when the immediate parent also has an active row in this cache. This also repairs pre-existing rows
  // when seeds are rerun; their raw ITIS payloads already contain `parentTSN`.
  await knex.raw(`--sql
    UPDATE taxon AS child
    SET parent_itis_tsn = NULLIF(child.itis_data->>'parentTSN', '')::integer
    WHERE child.record_end_date IS NULL
      AND child.itis_data->>'parentTSN' IS NOT NULL
      AND child.parent_itis_tsn IS DISTINCT FROM NULLIF(child.itis_data->>'parentTSN', '')::integer;

    UPDATE taxon AS child
    SET parent_taxon_id = parent.taxon_id
    FROM taxon AS parent
    WHERE child.parent_itis_tsn = parent.itis_tsn
      AND child.record_end_date IS NULL
      AND parent.record_end_date IS NULL
      AND child.parent_taxon_id IS DISTINCT FROM parent.taxon_id;
  `);
}
