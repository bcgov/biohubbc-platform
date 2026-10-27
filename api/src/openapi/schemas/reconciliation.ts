import { OpenAPIV3 } from 'openapi-types';
import { ReconciliationType } from '../../models/reconciliation';
import { submissionUploadParameters } from './submission-upload';

export const reconciliationFeatureParameters: OpenAPIV3.ParameterObject[] = [
  ...submissionUploadParameters,
  { in: 'path', name: 'reconciliation', required: true, schema: { type: 'string', enum: ReconciliationType.options } }
];
