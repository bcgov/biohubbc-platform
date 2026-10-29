import SQL from 'sql-template-strings';
import { getKnex } from '../database/db';
import { FormFieldRow, InsertFormField } from '../models/form';
import { BaseRepository } from './base-repository';

/**
 * Persistence for the field presentation of Blueprint property assignments within form versions.
 *
 * @export
 * @class FormVersionFeatureTypePropertyRepository
 * @extends {BaseRepository}
 */
export class FormVersionFeatureTypePropertyRepository extends BaseRepository {
  /**
   * Get the fields of a form version in display order.
   *
   * Fields are the active property assignments of the active feature types of the version's Blueprint; presentation
   * is joined on, the label defaults to the property's display name, and a code-valued field carries its codeset.
   *
   * @param {number} formVersionId - Owning form version.
   * @return {Promise<FormFieldRow[]>} Fields ordered by feature type assignment, then field sort.
   * @memberof FormVersionFeatureTypePropertyRepository
   */
  async getFormFields(formVersionId: number): Promise<FormFieldRow[]> {
    const knex = getKnex();
    const query = knex('form_version as fv')
      .join('blueprint_feature_type as bft', 'bft.blueprint_id', 'fv.blueprint_id')
      .join(
        'blueprint_feature_type_property as bftp',
        'bftp.blueprint_feature_type_id',
        'bft.blueprint_feature_type_id'
      )
      .join('feature_property as fp', 'fp.feature_property_id', 'bftp.feature_property_id')
      .join('feature_property_type as pt', 'pt.feature_property_type_id', 'fp.feature_property_type_id')
      .leftJoin('form_version_feature_type_property as c', function () {
        this.on('c.form_version_id', 'fv.form_version_id').andOn(
          'c.blueprint_feature_type_property_id',
          'bftp.blueprint_feature_type_property_id'
        );
      })
      .select(
        'bftp.blueprint_feature_type_property_id',
        'bftp.blueprint_feature_type_id',
        'bftp.feature_property_id',
        'fp.name as feature_property_name',
        'fp.display_name as feature_property_display_name',
        'pt.name as type_name',
        knex.raw('COALESCE(c.label, fp.display_name) AS label'),
        'c.description',
        'c.contributor_codeset_id',
        'bftp.sort'
      )
      .where('fv.form_version_id', formVersionId)
      .whereNull('bft.record_end_date')
      .whereNull('bftp.record_end_date')
      .orderBy('bftp.blueprint_feature_type_id', 'asc')
      .orderBy('bftp.sort', 'asc', 'last')
      .orderBy('bftp.blueprint_feature_type_property_id', 'asc');

    const response = await this.connection.knex(query, FormFieldRow);

    return response.rows;
  }

  /**
   * Delete the field presentation of a draft version before it is replaced.
   *
   * @param {number} formVersionId - Owning form version.
   * @return {Promise<void>}
   * @memberof FormVersionFeatureTypePropertyRepository
   */
  async deleteFormFields(formVersionId: number): Promise<void> {
    const knex = getKnex();
    const query = knex('form_version_feature_type_property').where('form_version_id', formVersionId).delete();

    await this.connection.knex(query);
  }

  /**
   * Insert field presentation rows in one statement.
   *
   * @param {InsertFormField[]} fields - Field presentation to insert.
   * @return {Promise<void>}
   * @memberof FormVersionFeatureTypePropertyRepository
   */
  async insertFormFields(fields: InsertFormField[]): Promise<void> {
    if (!fields.length) {
      return;
    }

    const formVersionIds = fields.map((field) => field.formVersionId);
    const blueprintFeatureTypePropertyIds = fields.map((field) => field.blueprintFeatureTypePropertyId);
    const labels = fields.map((field) => field.label);
    const descriptions = fields.map((field) => field.description);
    const contributorCodesetIds = fields.map((field) => field.contributorCodesetId);

    const sqlStatement = SQL`
      INSERT INTO form_version_feature_type_property (
        form_version_id,
        blueprint_feature_type_property_id,
        label,
        description,
        contributor_codeset_id
      )
      SELECT * FROM unnest(
        ${formVersionIds}::integer[],
        ${blueprintFeatureTypePropertyIds}::integer[],
        ${labels}::text[],
        ${descriptions}::text[],
        ${contributorCodesetIds}::integer[]
      );
    `;

    await this.connection.sql(sqlStatement);
  }

  /**
   * Copy a version's field presentation onto a revision, matching fields by feature type and property between the two
   * versions' Blueprints.
   *
   * @param {number} sourceFormVersionId - Version being revised.
   * @param {number} formVersionId - Revision whose Blueprint was copied from the source's.
   * @return {Promise<void>}
   * @memberof FormVersionFeatureTypePropertyRepository
   */
  async copyFormFields(sourceFormVersionId: number, formVersionId: number): Promise<void> {
    const sqlStatement = SQL`
      INSERT INTO form_version_feature_type_property (
        form_version_id,
        blueprint_feature_type_property_id,
        label,
        description,
        contributor_codeset_id
      )
      SELECT target_fv.form_version_id, target_bftp.blueprint_feature_type_property_id, c.label, c.description,
        c.contributor_codeset_id
      FROM form_version_feature_type_property c
      JOIN blueprint_feature_type_property source_bftp
        ON source_bftp.blueprint_feature_type_property_id = c.blueprint_feature_type_property_id
      JOIN blueprint_feature_type source_bft ON source_bft.blueprint_feature_type_id = source_bftp.blueprint_feature_type_id
      JOIN form_version target_fv ON target_fv.form_version_id = ${formVersionId}
      JOIN blueprint_feature_type target_bft
        ON target_bft.blueprint_id = target_fv.blueprint_id
       AND target_bft.feature_type_id = source_bft.feature_type_id
       AND target_bft.record_end_date IS NULL
      JOIN blueprint_feature_type_property target_bftp
        ON target_bftp.blueprint_feature_type_id = target_bft.blueprint_feature_type_id
       AND target_bftp.feature_property_id = source_bftp.feature_property_id
       AND target_bftp.record_end_date IS NULL
      WHERE c.form_version_id = ${sourceFormVersionId};
    `;

    await this.connection.sql(sqlStatement);
  }
}
