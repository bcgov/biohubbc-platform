import { getKnex } from '../database/db';
import { ApiNotFoundError } from '../errors/api-error';
import { FormVersion } from '../models/form';
import { BaseRepository } from './base-repository';

const FORM_VERSION_COLUMNS = [
  'form_version_id',
  'form_id',
  'blueprint_id',
  'version_number',
  'record_effective_date',
  'record_end_date'
];

/**
 * Persistence for form revisions.
 *
 * @export
 * @class FormVersionRepository
 * @extends {BaseRepository}
 */
export class FormVersionRepository extends BaseRepository {
  /**
   * Get a form version within its form, including a published or retired version.
   *
   * @param {number} formId - Owning form.
   * @param {number} formVersionId - Form version identifier.
   * @return {Promise<FormVersion | undefined>} The version, or undefined when absent from the form.
   * @memberof FormVersionRepository
   */
  async getFormVersion(formId: number, formVersionId: number): Promise<FormVersion | undefined> {
    const knex = getKnex();
    const query = knex('form_version')
      .select(FORM_VERSION_COLUMNS)
      .where('form_id', formId)
      .where('form_version_id', formVersionId);

    const response = await this.connection.knex(query, FormVersion);

    return response.rows[0];
  }

  /**
   * Get the active published version of a form: the version submitters fill in.
   *
   * @param {number} formId - Owning form.
   * @return {Promise<FormVersion | undefined>} The active published version, or undefined when none is published.
   * @memberof FormVersionRepository
   */
  async getPublishedFormVersion(formId: number): Promise<FormVersion | undefined> {
    const knex = getKnex();
    const query = knex('form_version')
      .select(FORM_VERSION_COLUMNS)
      .where('form_id', formId)
      .whereNotNull('record_effective_date')
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, FormVersion);

    return response.rows[0];
  }

  /**
   * Get the active draft version of a form.
   *
   * @param {number} formId - Owning form.
   * @return {Promise<FormVersion | undefined>} The active draft, or undefined when the form has none.
   * @memberof FormVersionRepository
   */
  async getDraftFormVersion(formId: number): Promise<FormVersion | undefined> {
    const knex = getKnex();
    const query = knex('form_version')
      .select(FORM_VERSION_COLUMNS)
      .where('form_id', formId)
      .whereNull('record_effective_date')
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, FormVersion);

    return response.rows[0];
  }

  /**
   * Insert a draft version, joined to its Blueprint, with the next version number of its form.
   *
   * @param {number} formId - Owning form.
   * @param {number} blueprintId - The version's own draft Blueprint.
   * @return {Promise<FormVersion>} The created draft version.
   * @memberof FormVersionRepository
   */
  async insertFormVersion(formId: number, blueprintId: number): Promise<FormVersion> {
    const knex = getKnex();
    const query = knex('form_version')
      .insert({
        form_id: formId,
        blueprint_id: blueprintId,
        version_number: knex('form_version')
          .where('form_id', formId)
          .select(knex.raw('COALESCE(MAX(version_number), 0) + 1')),
        record_effective_date: null
      })
      .returning(FORM_VERSION_COLUMNS);

    const response = await this.connection.knex(query, FormVersion);

    return response.rows[0];
  }

  /**
   * Publish a draft form version from today.
   *
   * @param {number} formVersionId - Form version identifier.
   * @return {Promise<void>}
   * @throws {ApiNotFoundError} If no active draft version exists for the id.
   * @memberof FormVersionRepository
   */
  async publishFormVersion(formVersionId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('form_version')
      .update({ record_effective_date: knex.fn.now() })
      .where('form_version_id', formVersionId)
      .whereNull('record_effective_date')
      .whereNull('record_end_date');

    const response = await this.connection.knex(query);

    if (response.rowCount !== 1) {
      throw new ApiNotFoundError('Draft form version not found', [
        'FormVersionRepository->publishFormVersion',
        { formVersionId }
      ]);
    }
  }

  /**
   * Retire an active published form version once a newer version replaces it.
   *
   * @param {number} formVersionId - Published form version identifier.
   * @return {Promise<void>}
   * @memberof FormVersionRepository
   */
  async retireFormVersion(formVersionId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('form_version')
      .update({ record_end_date: knex.fn.now() })
      .where('form_version_id', formVersionId)
      .whereNotNull('record_effective_date')
      .whereNull('record_end_date');

    await this.connection.knex(query);
  }
}
