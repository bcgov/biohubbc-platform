import { OpenAPIV3 } from 'openapi-types';

export const submissionUploadParameters: OpenAPIV3.ParameterObject[] = [
  { in: 'path', name: 'submissionId', required: true, schema: { type: 'integer', minimum: 1 } },
  { in: 'path', name: 'submissionUploadId', required: true, schema: { type: 'string', format: 'uuid' } }
];
