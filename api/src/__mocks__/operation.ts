import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { OpenAPIV3, OpenAPIV3_1 } from 'openapi-types';

/**
 * Returns the request handler at `index` in an express-openapi operation.
 *
 * `Operation` is either a single handler function or an array of handlers, and only the array form
 * can be indexed. Path files export their operations as handler arrays (authorization first, then the
 * route handler), so tests reach a specific step through this helper.
 *
 * @param {Operation} operation The exported operation (e.g. `GET`, `POST`).
 * @param {number} index The position of the handler in the operation's handler array.
 * @return {*}  {RequestHandler} The handler at that position.
 * @throws {Error} If the operation is a single function or has no handler at `index`.
 */
export const getOperationHandler = (operation: Operation, index: number): RequestHandler => {
  if (typeof operation === 'function') {
    throw new TypeError('Operation is a single handler function, not a handler array');
  }

  const handler = operation[index];

  if (!handler) {
    throw new Error(`Operation has no handler at index ${index}`);
  }

  return handler;
};

/**
 * Returns the `application/json` request body schema declared in an operation's OpenAPI document.
 *
 * `apiDoc` is typed as any OpenAPI version's operation, and only OpenAPI 3 operations declare a
 * `requestBody`, so the schema is narrowed out here rather than at each call site.
 *
 * @param {Operation} operation The exported operation (e.g. `POST`, `PUT`).
 * @return {*}  {OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject | OpenAPIV3.ReferenceObject} The JSON request
 *   body schema.
 * @throws {Error} If the operation declares no inline JSON request body schema.
 */
export const getRequestBodySchema = (
  operation: Operation
): OpenAPIV3.SchemaObject | OpenAPIV3_1.SchemaObject | OpenAPIV3.ReferenceObject => {
  const apiDoc = operation.apiDoc;

  if (!apiDoc || !('requestBody' in apiDoc) || !apiDoc.requestBody || '$ref' in apiDoc.requestBody) {
    throw new Error('Operation declares no inline request body');
  }

  const schema = apiDoc.requestBody.content['application/json']?.schema;

  if (!schema) {
    throw new Error('Operation declares no application/json request body schema');
  }

  return schema;
};
