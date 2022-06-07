import { IDBConnection } from '../database/db';
import { IInsertSecuritySchema, ISecurityModel, SecurityRepository } from '../repositories/security-repository';
import { DBService } from './db-service';
import { SubmissionService } from './submission-service';

export class SecurityService extends DBService {
  securityRepository: SecurityRepository;

  constructor(connection: IDBConnection) {
    super(connection);

    this.securityRepository = new SecurityRepository(connection);
  }

  /**
   *Insert Security Schema into db
   *
   * @param {IInsertSecuritySchema} securitySchema
   * @return {*}  {Promise<{ security_id: number }>}
   * @memberof SecurityService
   */
  async insertSecuritySchema(styleSchema: IInsertSecuritySchema): Promise<{ security_id: number }> {
    return this.securityRepository.insertSecuritySchema(styleSchema);
  }

  /**
   *Get Security Schema from db with given id
   *
   * @param {number} securityId
   * @return {*}  {Promise<ISecurityModel>}
   * @memberof SecurityService
   */
  async getSecuritySchemaBySecurityId(securityId: number): Promise<ISecurityModel> {
    return this.securityRepository.getSecuritySchemaBySecurityId(securityId);
  }

  /**
   * Run security Validation on submission record
   *
   * @param {number} submissionId
   * @param {ISecurityModel} securitySchema
   * @return {*}  {Promise<{ secure: true }>}
   * @memberof SecurityService
   */
  async validateSecurityOfSubmission(
    submissionId: number,
    securitySchema: ISecurityModel
  ): Promise<{ secure: boolean }> {
    const submissionService = new SubmissionService(this.connection);

    const submission = await submissionService.getSubmissionRecordBySubmissionId(submissionId);

    //TODO this is a temp setup until further requirements are set
    if (securitySchema && submission.submission_id) {
      return { secure: true };
    }

    return { secure: false };
  }
}
