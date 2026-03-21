import { Knex } from 'knex';

/**
 * Seeds contributor codesets and codes for SIMS contributor.
 *
 * Creates:
 * - life_stage codeset with codes: adult, juvenile, old_adult, subadult, pup, calf
 * - sex codeset with codes: male, female, unknown
 *
 * @export
 * @param {Knex} knex
 * @return {*}  {Promise<void>}
 */
export async function seed(knex: Knex): Promise<void> {
  // Get or create SIMS contributor
  const simsContributors = await knex('contributor').where('client_id', 'SIMS').select('contributor_id');

  let simsContributorId: number;

  if (simsContributors.length > 0) {
    simsContributorId = simsContributors[0].contributor_id;
  } else {
    // Create SIMS contributor if it doesn't exist
    const simsUserRow = await knex('system_user')
      .where('user_identifier', 'SIMS')
      .whereNull('record_end_date')
      .select('system_user_id')
      .first();

    const simsUserId = simsUserRow?.system_user_id;

    if (!simsUserId) {
      throw new Error('SIMS system user not found');
    }

    const insertRes = await knex('contributor')
      .insert({
        client_id: 'SIMS',
        description: 'Species Inventory Management System',
        create_user: simsUserId
      })
      .returning('contributor_id');

    simsContributorId = insertRes[0].contributor_id;
  }

  // Get SIMS user for create_user
  const simsUserRow = await knex('system_user')
    .where('user_identifier', 'SIMS')
    .whereNull('record_end_date')
    .select('system_user_id')
    .first();

  const simsUserId = simsUserRow?.system_user_id;

  if (!simsUserId) {
    throw new Error('SIMS system user not found');
  }

  // Delete existing codesets/codes if they exist (soft delete via record_end_date)
  await knex('contributor_codeset')
    .where({ contributor_id: simsContributorId })
    .whereNull('record_end_date')
    .update({ record_end_date: knex.fn.now() });

  // Create life_stage codeset
  const lifeStageCodesetRes = await knex('contributor_codeset')
    .insert({
      contributor_id: simsContributorId,
      key: 'life_stage',
      label: 'Life Stage',
      description: 'The life stage classification for an animal.',
      create_user: simsUserId
    })
    .returning('contributor_codeset_id');

  const lifeStageCodesetId = lifeStageCodesetRes[0].contributor_codeset_id;

  // Create life_stage codes
  const lifeStageCodesData = [
    {
      key: 'adult',
      label: 'Adult',
      description: 'An adult individual'
    },
    {
      key: 'juvenile',
      label: 'Juvenile',
      description: 'A juvenile individual'
    },
    {
      key: 'old_adult',
      label: 'Old Adult',
      description: 'An old adult individual'
    },
    {
      key: 'subadult',
      label: 'Subadult',
      description: 'A subadult individual'
    },
    {
      key: 'pup',
      label: 'Pup',
      description: 'A pup (young mammal)'
    },
    {
      key: 'calf',
      label: 'Calf',
      description: 'A calf (young ungulate)'
    }
  ];

  for (const code of lifeStageCodesData) {
    await knex('contributor_codeset_code').insert({
      contributor_codeset_id: lifeStageCodesetId,
      key: code.key,
      label: code.label,
      description: code.description,
      create_user: simsUserId
    });
  }

  // Create sex codeset
  const sexCodesetRes = await knex('contributor_codeset')
    .insert({
      contributor_id: simsContributorId,
      key: 'sex',
      label: 'Sex',
      description: 'The biological sex of an animal',
      create_user: simsUserId
    })
    .returning('contributor_codeset_id');

  const sexCodesetId = sexCodesetRes[0].contributor_codeset_id;

  // Create sex codes
  const sexCodesData = [
    {
      key: 'male',
      label: 'Male',
      description: 'A male individual'
    },
    {
      key: 'female',
      label: 'Female',
      description: 'A female individual'
    },
    {
      key: 'unknown',
      label: 'Unknown',
      description: 'Sex is unknown'
    }
  ];

  for (const code of sexCodesData) {
    await knex('contributor_codeset_code').insert({
      contributor_codeset_id: sexCodesetId,
      key: code.key,
      label: code.label,
      description: code.description,
      create_user: simsUserId
    });
  }
}
