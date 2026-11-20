import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { CountResult } from '../models/count';
import { Form, FormFilters, FormListItem, InsertForm, UpdateForm } from '../models/form';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const FORM_COLUMNS = [
  'form_id',
  'slug',
  'contributor_id',
  'team_id',
  'name',
  'description',
  'is_public',
  'record_end_date'
];

/**
 * Persistence for form identity, slug, owning contributor, administration team, descriptive metadata and access.
 *
 * @export
 * @class FormRepository
 * @extends {BaseRepository}
 */
export class FormRepository extends BaseRepository {
  /**
   * List a deterministic page of active forms, each with its latest active version.
   *
   * @param {FormFilters} filters - Administrative search filters.
   * @param {ApiPaginationOptions} pagination - Validated pagination and sorting.
   * @return {Promise<FormListItem[]>} Matching page of forms.
   * @memberof FormRepository
   */
  async getForms(filters: FormFilters, pagination: ApiPaginationOptions): Promise<FormListItem[]> {
    const knex = getKnex();
    const query = this.applyFormFilters(knex('form as f'), filters)
      .joinRaw(
        `LEFT JOIN LATERAL (
          SELECT form_version_id, version_number, record_effective_date
          FROM form_version
          WHERE form_id = f.form_id AND record_end_date IS NULL
          ORDER BY version_number DESC
          LIMIT 1
        ) fv ON true`
      )
      .select(
        'f.form_id',
        'f.slug',
        'f.name',
        'f.description',
        'f.is_public',
        knex.raw('f.create_date::text AS create_date'),
        'fv.form_version_id',
        'fv.version_number',
        knex.raw('fv.record_effective_date::text AS record_effective_date')
      )
      .orderBy(`f.${pagination.sort ?? 'name'}`, pagination.order ?? 'asc', 'last')
      .orderBy('f.form_id', 'asc')
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);

    const response = await this.connection.knex(query, FormListItem);

    return response.rows;
  }

  /**
   * Count active forms using the same predicates as the administrative list.
   *
   * @param {FormFilters} filters - Administrative search filters.
   * @return {Promise<CountResult>} Matching count row.
   * @memberof FormRepository
   */
  async getFormsCount(filters: FormFilters): Promise<CountResult> {
    const knex = getKnex();
    const query = this.applyFormFilters(knex('form as f'), filters).select(knex.raw('count(*)::integer AS count'));

    const response = await this.connection.knex(query, CountResult);

    return response.rows[0];
  }

  /**
   * Get a form, including a retired form.
   *
   * @param {number} formId - Form identifier.
   * @return {Promise<Form | undefined>} The form, or undefined when absent.
   * @memberof FormRepository
   */
  async getForm(formId: number): Promise<Form | undefined> {
    const knex = getKnex();
    const query = knex('form').select(FORM_COLUMNS).where('form_id', formId);

    const response = await this.connection.knex(query, Form);

    return response.rows[0];
  }

  /**
   * Find the active form addressed by a slug.
   *
   * @param {string} slug - Form slug.
   * @return {Promise<Form | undefined>} The active form, or undefined when no active form uses the slug.
   * @memberof FormRepository
   */
  async findActiveFormBySlug(slug: string): Promise<Form | undefined> {
    const knex = getKnex();
    const query = knex('form').select(FORM_COLUMNS).where('slug', slug).whereNull('record_end_date');

    const response = await this.connection.knex(query, Form);

    return response.rows[0];
  }

  /**
   * Insert a form.
   *
   * @param {InsertForm} data - Form row.
   * @return {Promise<Form>} The created form.
   * @memberof FormRepository
   */
  async insertForm(data: InsertForm): Promise<Form> {
    const knex = getKnex();
    const query = knex('form')
      .insert({
        slug: data.slug,
        contributor_id: data.contributorId,
        team_id: data.teamId,
        name: data.name,
        description: data.description,
        is_public: data.isPublic
      })
      .returning(FORM_COLUMNS);

    const response = await this.connection.knex(query, Form);

    return response.rows[0];
  }

  /**
   * Replace a form's mutable metadata. The slug, contributor and administration team never change.
   *
   * @param {number} formId - Form identifier.
   * @param {UpdateForm} data - Mutable form metadata.
   * @return {Promise<Form>} The updated form.
   * @memberof FormRepository
   */
  async updateForm(formId: number, data: UpdateForm): Promise<Form> {
    const knex = getKnex();
    const query = knex('form')
      .where('form_id', formId)
      .update({ name: data.name, description: data.description, is_public: data.isPublic })
      .returning(FORM_COLUMNS);

    const response = await this.connection.knex(query, Form);

    return response.rows[0];
  }

  /**
   * Apply administrative predicates to list and count queries. Retired forms are always excluded.
   *
   * @param {Knex.QueryBuilder} query - Base query over `form as f`.
   * @param {FormFilters} filters - Administrative search filters.
   * @return {Knex.QueryBuilder} Filtered query.
   * @memberof FormRepository
   */
  private applyFormFilters(query: Knex.QueryBuilder, filters: FormFilters): Knex.QueryBuilder {
    query.whereNull('f.record_end_date');

    if (filters.keyword) {
      query.where(function () {
        this.whereILike('f.name', `%${filters.keyword}%`).orWhereILike('f.slug', `%${filters.keyword}%`);
      });
    }

    return query;
  }
}
