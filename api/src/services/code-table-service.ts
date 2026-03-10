import { IDBConnection } from '../database/db';
import { Code, CreateCode } from '../models/code';
import { CodeTableRepository } from '../repositories/code-table-repository';
import { DBService } from './db-service';

export class CodeTableService extends DBService {
  codeTableRepository: CodeTableRepository;

  /**
   * Creates an instance of CodeTableService.
   *
   * @param {IDBConnection} connection
   * @memberof CodeTableService
   */
  constructor(connection: IDBConnection) {
    super(connection);
    this.codeTableRepository = new CodeTableRepository(connection);
  }

  /**
   * Create a code row.
   *
   * @param {CreateCode} payload
   * @return {Promise<Code>}
   * @memberof CodeTableService
   */
  createCode(payload: CreateCode): Promise<Code> {
    return this.codeTableRepository.insertCode(payload);
  }

  /**
   * Get a code row by id.
   *
   * @param {number} codeId
   * @return {Promise<Code>}
   * @memberof CodeTableService
   */
  getCodeById(codeId: number): Promise<Code> {
    return this.codeTableRepository.getCodeById(codeId);
  }

  /**
   * Get code rows by code category id.
   *
   * @param {number} codeCategoryId
   * @return {Promise<Code[]>}
   * @memberof CodeTableService
   */
  getCodesByCodeCategoryId(codeCategoryId: number): Promise<Code[]> {
    return this.codeTableRepository.getCodesByCodeCategoryId(codeCategoryId);
  }
}
