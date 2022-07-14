import Ajv, { AnySchema, ErrorObject } from 'ajv';
import { ValidationError, XMLValidator } from 'fast-xml-parser';
import { IDBConnection } from '../database/db';
import { ValidationRepository } from '../repositories/validation-repository';
import { DBService } from './db-service';

export class ValidationService extends DBService {
  validationRepository: ValidationRepository;

  ajv: Ajv;

  constructor(connection: IDBConnection) {
    super(connection);

    this.validationRepository = new ValidationRepository(connection);

    this.ajv = new Ajv();
  }

  /**
   * Check if an object is valid against a specified JSON Schema.
   *
   * @param {*} jsonObject
   * @param {AnySchema} jsonSchema
   * @return {*}  {(Promise<{ isValid: boolean; errors: ErrorObject[] | null | undefined }>)}
   * @memberof ValidationService
   */
  async isJSONObjectValidAgainstJSONSchema(
    jsonObject: any,
    jsonSchema: AnySchema
  ): Promise<{ isValid: boolean; errors: ErrorObject[] | null | undefined }> {
    const isValid = await this.ajv.validate(jsonSchema, jsonObject);

    return { isValid: !!isValid, errors: this.ajv.errors };
  }

  /**
   * Checks if an object is a valid JSON Schema.
   *
   * @see https://json-schema.org/
   * @param {AnySchema} jsonSchema
   * @return {*}  {(Promise<{ isValid: boolean; errors: ErrorObject[] | null | undefined }>)}
   * @memberof ValidationService
   */
  async isJSONSchemaValid(
    jsonSchema: AnySchema
  ): Promise<{ isValid: boolean; errors: ErrorObject[] | null | undefined }> {
    const isValid = await this.ajv.validateSchema(jsonSchema);

    return { isValid: !!isValid, errors: this.ajv.errors };
  }

  /**
   * Checks if a string is valid XML.
   *
   * @param {*} xmlString
   * @return {*}  {(Promise<{ isValid: boolean; errors: ValidationError[] | null | undefined }>)}
   * @memberof ValidationService
   */
  async isXMLValid(xmlString: string): Promise<{ isValid: boolean; errors: ValidationError[] | null | undefined }> {
    const isValid = XMLValidator.validate(xmlString);

    if (isValid !== true) {
      return { isValid: false, errors: [isValid] };
    }

    return { isValid: true, errors: null };
  }
}
