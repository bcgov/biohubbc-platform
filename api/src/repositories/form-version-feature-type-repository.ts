import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { FormSectionRow, InsertFormSection } from '../models/form';
import { BaseRepository } from './base-repository';

/**
 * Persistence for the section presentation of Blueprint feature types within form versions.
 *
 * @export
 * @class FormVersionFeatureTypeRepository
 * @extends {BaseRepository}
 */
export class FormVersionFeatureTypeRepository extends BaseRepository {
  /**
   * Get the sections of a form version in display order.
   *
   * Sections are the active feature types of the version's Blueprint; presentation is joined on and defaults to the
   * feature type's display name and false flags, so a Blueprint also edited outside the form builder still reads
   * correctly.
   *
   * @param {number} formVersionId - Owning form version.
   * @return {Promise<FormSectionRow[]>} Sections ordered by section sort.
   * @memberof FormVersionFeatureTypeRepository
   */
  async getFormSections(formVersionId: number): Promise<FormSectionRow[]> {
    const knex = getKnex();
    const query = knex('form_version as fv')
      .join('blueprint_feature_type as bft', 'bft.blueprint_id', 'fv.blueprint_id')
      .join('feature_type as ft', 'ft.feature_type_id', 'bft.feature_type_id')
      .leftJoin('form_version_feature_type as c', function () {
        this.on('c.form_version_id', 'fv.form_version_id').andOn(
          'c.blueprint_feature_type_id',
          'bft.blueprint_feature_type_id'
        );
      })
      .select(
        'bft.blueprint_feature_type_id',
        'bft.feature_type_id',
        'ft.name as feature_type_name',
        'ft.display_name as feature_type_display_name',
        knex.raw('COALESCE(c.label, ft.display_name) AS label'),
        'c.description',
        knex.raw('COALESCE(c.required_value, false) AS required_value'),
        knex.raw('COALESCE(c.allow_multiple, false) AS allow_multiple'),
        'bft.sort'
      )
      .where('fv.form_version_id', formVersionId)
      .whereNull('bft.record_end_date')
      .orderBy('bft.sort', 'asc', 'last')
      .orderBy('bft.blueprint_feature_type_id', 'asc');

    const response = await this.connection.knex(query, FormSectionRow);

    return response.rows;
  }

  /**
   * Delete the section presentation of a draft version before it is replaced.
   *
   * @param {number} formVersionId - Owning form version.
   * @return {Promise<void>}
   * @memberof FormVersionFeatureTypeRepository
   */
  async deleteFormSections(formVersionId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('form_version_feature_type').where('form_version_id', formVersionId).delete();

    await this.connection.knex(query);
  }

  /**
   * Insert section presentation rows in one statement.
   *
   * @param {InsertFormSection[]} sections - Section presentation to insert.
   * @return {Promise<void>}
   * @memberof FormVersionFeatureTypeRepository
   */
  async insertFormSections(sections: InsertFormSection[]): Promise<void> {
    if (!sections.length) {
      return;
    }

    const formVersionIds = sections.map((section) => section.formVersionId);
    const blueprintFeatureTypeIds = sections.map((section) => section.blueprintFeatureTypeId);
    const labels = sections.map((section) => section.label);
    const descriptions = sections.map((section) => section.description);
    const requiredValues = sections.map((section) => section.requiredValue);
    const allowMultiples = sections.map((section) => section.allowMultiple);

    const sqlStatement = SQL`
      INSERT INTO form_version_feature_type (
        form_version_id,
        blueprint_feature_type_id,
        label,
        description,
        required_value,
        allow_multiple
      )
      SELECT * FROM unnest(
        ${formVersionIds}::integer[],
        ${blueprintFeatureTypeIds}::integer[],
        ${labels}::text[],
        ${descriptions}::text[],
        ${requiredValues}::boolean[],
        ${allowMultiples}::boolean[]
      );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Copy a version's section presentation onto a revision, matching sections by feature type between the two
   * versions' Blueprints.
   *
   * @param {number} sourceFormVersionId - Version being revised.
   * @param {number} formVersionId - Revision whose Blueprint was copied from the source's.
   * @return {Promise<void>}
   * @memberof FormVersionFeatureTypeRepository
   */
  async copyFormSections(sourceFormVersionId: number, formVersionId: number): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO form_version_feature_type (
        form_version_id,
        blueprint_feature_type_id,
        label,
        description,
        required_value,
        allow_multiple
      )
      SELECT target_fv.form_version_id, target_bft.blueprint_feature_type_id,
        c.label, c.description, c.required_value, c.allow_multiple
      FROM form_version_feature_type c
      JOIN blueprint_feature_type source_bft ON source_bft.blueprint_feature_type_id = c.blueprint_feature_type_id
      JOIN form_version target_fv ON target_fv.form_version_id = ${formVersionId}
      JOIN blueprint_feature_type target_bft
        ON target_bft.blueprint_id = target_fv.blueprint_id
       AND target_bft.feature_type_id = source_bft.feature_type_id
       AND target_bft.record_end_date IS NULL
      WHERE c.form_version_id = ${sourceFormVersionId};
    `;

    await this.connection.sql(sqlStatement);
  }
}
