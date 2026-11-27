import { Knex } from 'knex';
import { getKnex } from '../database/db';
import { CountResult } from '../models/count';
import {
  FormSubmission,
  FormSubmissionData,
  FormSubmissionFilters,
  FormSubmissionListItem,
  InsertFormSubmission
} from '../models/form-submission';
import { ApiPaginationOptions } from '../zod-schema/pagination';
import { BaseRepository } from './base-repository';

const FORM_SUBMISSION_COLUMNS = [
  'form_submission_id',
  'uuid',
  'form_id',
  'form_version_id',
  'team_id',
  'submission_id',
  'status',
  'data',
  'submitted_date',
  'create_date',
  'create_user'
];

/**
 * Persistence for form submissions: the drafts submitters edit and the submission each became.
 *
 * @export
 * @class FormSubmissionRepository
 * @extends {BaseRepository}
 */
export class FormSubmissionRepository extends BaseRepository {
  /**
   * Insert a draft form submission.
   *
   * @param {InsertFormSubmission} data - Form submission row.
   * @return {Promise<FormSubmission>} The created form submission.
   * @memberof FormSubmissionRepository
   */
  async insertFormSubmission(data: InsertFormSubmission): Promise<FormSubmission> {
    const knex = getKnex();
    const query = knex('form_submission')
      .insert({
        form_id: data.formId,
        form_version_id: data.formVersionId,
        team_id: data.teamId,
        data: JSON.stringify(data.data)
      })
      .returning(FORM_SUBMISSION_COLUMNS);

    const response = await this.connection.knex(query, FormSubmission);

    return response.rows[0];
  }

  /**
   * Get an active form submission of a form.
   *
   * @param {number} formId - Owning form.
   * @param {string} formSubmissionUuid - Form submission identifier.
   * @return {Promise<FormSubmission | undefined>} The form submission, or undefined when absent from the form.
   * @memberof FormSubmissionRepository
   */
  async getFormSubmission(formId: number, formSubmissionUuid: string): Promise<FormSubmission | undefined> {
    const knex = getKnex();
    const query = knex('form_submission')
      .select(FORM_SUBMISSION_COLUMNS)
      .where('form_id', formId)
      .where('uuid', formSubmissionUuid)
      .whereNull('record_end_date');

    const response = await this.connection.knex(query, FormSubmission);

    return response.rows[0];
  }

  /**
   * Get an active form submission of a form and lock its row until the transaction ends, serializing submits.
   *
   * @param {number} formId - Owning form.
   * @param {string} formSubmissionUuid - Form submission identifier.
   * @return {Promise<FormSubmission | undefined>} The locked form submission, or undefined when absent from the form.
   * @memberof FormSubmissionRepository
   */
  async getFormSubmissionForUpdate(formId: number, formSubmissionUuid: string): Promise<FormSubmission | undefined> {
    const knex = getKnex();
    const query = knex('form_submission')
      .select(FORM_SUBMISSION_COLUMNS)
      .where('form_id', formId)
      .where('uuid', formSubmissionUuid)
      .whereNull('record_end_date')
      .forUpdate();

    const response = await this.connection.knex(query, FormSubmission);

    return response.rows[0];
  }

  /**
   * Replace a form submission's draft and the published version it was saved against, returning it to draft.
   *
   * @param {number} formSubmissionId - Form submission identifier.
   * @param {number} formVersionId - Published version the draft was saved against.
   * @param {FormSubmissionData} data - Draft document.
   * @return {Promise<FormSubmission>} The updated form submission.
   * @memberof FormSubmissionRepository
   */
  async updateFormSubmissionDraft(
    formSubmissionId: number,
    formVersionId: number,
    data: FormSubmissionData
  ): Promise<FormSubmission> {
    const knex = getKnex();
    const query = knex('form_submission')
      .where('form_submission_id', formSubmissionId)
      .update({ form_version_id: formVersionId, data: JSON.stringify(data), status: 'draft' })
      .returning(FORM_SUBMISSION_COLUMNS);

    const response = await this.connection.knex(query, FormSubmission);

    return response.rows[0];
  }

  /**
   * Record that a form submission's current content has been submitted, and the submission it belongs to.
   *
   * @param {number} formSubmissionId - Form submission identifier.
   * @param {number} submissionId - Submission the form submission became.
   * @return {Promise<FormSubmission>} The updated form submission.
   * @memberof FormSubmissionRepository
   */
  async markFormSubmissionSubmitted(formSubmissionId: number, submissionId: number): Promise<FormSubmission> {
    const knex = getKnex();
    const query = knex('form_submission')
      .where('form_submission_id', formSubmissionId)
      .update({ submission_id: submissionId, status: 'submitted', submitted_date: knex.fn.now() })
      .returning(FORM_SUBMISSION_COLUMNS);

    const response = await this.connection.knex(query, FormSubmission);

    return response.rows[0];
  }

  /**
   * List a deterministic page of a form's active submissions, each with its submitter and latest upload.
   *
   * @param {number} formId - Owning form.
   * @param {FormSubmissionFilters} filters - Optional team member scope.
   * @param {ApiPaginationOptions} pagination - Validated pagination and sorting.
   * @return {Promise<FormSubmissionListItem[]>} Matching page of form submissions.
   * @memberof FormSubmissionRepository
   */
  async getFormSubmissions(
    formId: number,
    filters: FormSubmissionFilters,
    pagination: ApiPaginationOptions
  ): Promise<FormSubmissionListItem[]> {
    const knex = getKnex();
    const query = this.applyFormSubmissionFilters(knex('form_submission as fs'), formId, filters)
      .leftJoin('system_user as u', 'u.system_user_id', 'fs.create_user')
      .joinRaw(
        `LEFT JOIN LATERAL (
          SELECT su.submission_upload_id, su.status, su.decision
          FROM form_submission_upload fsu
          JOIN submission_upload su ON su.submission_upload_id = fsu.submission_upload_id
          WHERE fsu.form_submission_id = fs.form_submission_id AND su.record_end_date IS NULL
          ORDER BY su.create_date DESC, su.submission_upload_id DESC
          LIMIT 1
        ) latest ON true`
      )
      .select(
        'fs.form_submission_id',
        'fs.uuid',
        'fs.status',
        'fs.submitted_date',
        'fs.create_date',
        'u.user_identifier as submitted_by_identifier',
        'latest.submission_upload_id',
        'latest.status as upload_status',
        'latest.decision as upload_decision'
      )
      .orderBy(`fs.${pagination.sort ?? 'create_date'}`, pagination.order ?? 'desc', 'last')
      .orderBy('fs.form_submission_id', 'desc')
      .limit(pagination.limit)
      .offset((pagination.page - 1) * pagination.limit);

    const response = await this.connection.knex(query, FormSubmissionListItem);

    return response.rows;
  }

  /**
   * Count a form's active submissions using the same predicates as the list.
   *
   * @param {number} formId - Owning form.
   * @param {FormSubmissionFilters} filters - Optional team member scope.
   * @return {Promise<CountResult>} Matching count row.
   * @memberof FormSubmissionRepository
   */
  async getFormSubmissionsCount(formId: number, filters: FormSubmissionFilters): Promise<CountResult> {
    const knex = getKnex();
    const query = this.applyFormSubmissionFilters(knex('form_submission as fs'), formId, filters).select(
      knex.raw('count(*)::integer AS count')
    );

    const response = await this.connection.knex(query, CountResult);

    return response.rows[0];
  }

  /**
   * Scope list and count queries to a form's active submissions and, when filtered, to those whose team the user is
   * an active member of.
   *
   * @param {Knex.QueryBuilder} query - Base query over `form_submission as fs`.
   * @param {number} formId - Owning form.
   * @param {FormSubmissionFilters} filters - Optional team member scope.
   * @return {Knex.QueryBuilder} Filtered query.
   * @memberof FormSubmissionRepository
   */
  private applyFormSubmissionFilters(
    query: Knex.QueryBuilder,
    formId: number,
    filters: FormSubmissionFilters
  ): Knex.QueryBuilder {
    query.where('fs.form_id', formId).whereNull('fs.record_end_date');

    if (filters.teamMemberSystemUserId !== null) {
      const systemUserId = filters.teamMemberSystemUserId;

      query.whereExists(function () {
        this.select(1)
          .from('team_member as tm')
          .join('team as t', 't.team_id', 'tm.team_id')
          .whereRaw('tm.team_id = fs.team_id')
          .where('tm.system_user_id', systemUserId)
          .whereNull('tm.record_end_date')
          .whereNull('t.record_end_date');
      });
    }

    return query;
  }
}
