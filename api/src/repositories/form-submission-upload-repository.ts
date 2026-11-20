import { getKnex } from '../database/db';
import {
  FormSubmissionLatestUpload,
  FormSubmissionUploadFeatures,
  InsertFormSubmissionUpload
} from '../models/form-submission';
import { BaseRepository } from './base-repository';

/**
 * Persistence for the immutable content of each submit of a form submission: the source its submission upload
 * ingests instead of a tarball.
 *
 * @export
 * @class FormSubmissionUploadRepository
 * @extends {BaseRepository}
 */
export class FormSubmissionUploadRepository extends BaseRepository {
  /**
   * Insert the content of one submit.
   *
   * @param {InsertFormSubmissionUpload} data - Submitted draft document and features.
   * @return {Promise<void>}
   * @memberof FormSubmissionUploadRepository
   */
  async insertFormSubmissionUpload(data: InsertFormSubmissionUpload): Promise<void> {
    const knex = getKnex();
    const query = knex('form_submission_upload').insert({
      submission_upload_id: data.submissionUploadId,
      form_submission_id: data.formSubmissionId,
      form_version_id: data.formVersionId,
      data: JSON.stringify(data.data),
      features: JSON.stringify(data.features)
    });

    await this.connection.knex(query);
  }

  /**
   * Find the features a submission upload ingests, when the upload came from a form.
   *
   * @param {string} submissionUploadId - Submission upload identifier.
   * @return {Promise<FormSubmissionUploadFeatures | undefined>} The features, or undefined for a tarball upload.
   * @memberof FormSubmissionUploadRepository
   */
  async findFormSubmissionUploadFeatures(
    submissionUploadId: string
  ): Promise<FormSubmissionUploadFeatures | undefined> {
    const knex = getKnex();
    const query = knex('form_submission_upload').select('features').where('submission_upload_id', submissionUploadId);

    const response = await this.connection.knex(query, FormSubmissionUploadFeatures);

    return response.rows[0];
  }

  /**
   * Get the latest active submit of a form submission, with its upload's processing status and review decision.
   *
   * @param {number} formSubmissionId - Form submission identifier.
   * @return {Promise<FormSubmissionLatestUpload | undefined>} The latest submit, or undefined when never submitted.
   * @memberof FormSubmissionUploadRepository
   */
  async getLatestFormSubmissionUpload(formSubmissionId: number): Promise<FormSubmissionLatestUpload | undefined> {
    const knex = getKnex();
    const query = knex('form_submission_upload as fsu')
      .join('submission_upload as su', 'su.submission_upload_id', 'fsu.submission_upload_id')
      .select('su.submission_upload_id', 'su.status', 'su.decision', 'fsu.data', 'su.create_date')
      .where('fsu.form_submission_id', formSubmissionId)
      .whereNull('su.record_end_date')
      .orderBy('su.create_date', 'desc')
      .orderBy('su.submission_upload_id', 'desc')
      .limit(1);

    const response = await this.connection.knex(query, FormSubmissionLatestUpload);

    return response.rows[0];
  }

  /**
   * Get an active submit of a form submission by its upload.
   *
   * @param {number} formSubmissionId - Form submission identifier.
   * @param {string} submissionUploadId - Submission upload identifier.
   * @return {Promise<FormSubmissionLatestUpload | undefined>} The submit, or undefined when the upload is not one of
   * the form submission's active submits.
   * @memberof FormSubmissionUploadRepository
   */
  async getFormSubmissionUpload(
    formSubmissionId: number,
    submissionUploadId: string
  ): Promise<FormSubmissionLatestUpload | undefined> {
    const knex = getKnex();
    const query = knex('form_submission_upload as fsu')
      .join('submission_upload as su', 'su.submission_upload_id', 'fsu.submission_upload_id')
      .select('su.submission_upload_id', 'su.status', 'su.decision', 'fsu.data', 'su.create_date')
      .where('fsu.form_submission_id', formSubmissionId)
      .where('fsu.submission_upload_id', submissionUploadId)
      .whereNull('su.record_end_date');

    const response = await this.connection.knex(query, FormSubmissionLatestUpload);

    return response.rows[0];
  }
}
