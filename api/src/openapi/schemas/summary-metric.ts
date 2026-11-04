import { OpenAPIV3 } from 'openapi-types';
import { paginationResponseSchema } from './pagination';

/** A JSON value, including null, with its stored type preserved. */
export const SummaryMetricValueSchema: OpenAPIV3.SchemaObject = {
  oneOf: [
    { type: 'string', nullable: true },
    { type: 'number' },
    { type: 'boolean' },
    { type: 'object', additionalProperties: true },
    { type: 'array', items: {} }
  ]
};

export const SummaryMetricSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary_metric_id',
    'key',
    'name',
    'description',
    'record_effective_date',
    'record_end_date',
    'create_date'
  ],
  properties: {
    summary_metric_id: { type: 'integer', minimum: 1 },
    key: { type: 'string', maxLength: 100 },
    name: { type: 'string', maxLength: 200 },
    description: { type: 'string' },
    record_effective_date: { type: 'string', format: 'date-time' },
    record_end_date: { type: 'string', format: 'date-time', nullable: true },
    create_date: { type: 'string', format: 'date-time' }
  }
};

export const CreateSummaryMetricRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['key', 'name', 'description'],
  properties: {
    key: { type: 'string', minLength: 1, maxLength: 100, pattern: '^[a-z][a-z0-9_]*$' },
    name: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string' }
  }
};

export const UpdateSummaryMetricRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'description'],
  properties: {
    name: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string' }
  }
};

export const SummaryMetricListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['summary_metrics', 'pagination'],
  properties: {
    summary_metrics: { type: 'array', items: SummaryMetricSchema },
    pagination: paginationResponseSchema
  }
};

export const SummaryMetricDataSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: [
    'summary_metrics_data_id',
    'summary_metric_id',
    'run_id',
    'calculated_at',
    'value',
    'record_effective_date',
    'record_end_date',
    'create_date'
  ],
  properties: {
    summary_metrics_data_id: {
      type: 'string',
      pattern: '^[1-9][0-9]*$',
      description: 'Bigint identifier as a string.'
    },
    summary_metric_id: { type: 'integer', minimum: 1 },
    run_id: { type: 'string', format: 'uuid' },
    calculated_at: { type: 'string', format: 'date-time' },
    value: SummaryMetricValueSchema,
    record_effective_date: { type: 'string', format: 'date-time' },
    record_end_date: { type: 'string', format: 'date-time', nullable: true },
    create_date: { type: 'string', format: 'date-time' }
  }
};

export const CreateSummaryMetricDataRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['summary_metric_id', 'run_id', 'calculated_at', 'value'],
  properties: {
    summary_metric_id: { type: 'integer', minimum: 1, maximum: 2147483647 },
    run_id: { type: 'string', format: 'uuid' },
    calculated_at: { type: 'string', format: 'date-time' },
    value: SummaryMetricValueSchema
  }
};

export const UpdateSummaryMetricDataRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['value'],
  properties: { value: SummaryMetricValueSchema }
};

export const SummaryMetricDataListResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['summary_metrics_data', 'pagination'],
  properties: {
    summary_metrics_data: { type: 'array', items: SummaryMetricDataSchema },
    pagination: paginationResponseSchema
  }
};

export const LatestSummaryMetricDataResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['summary_metrics_data'],
  properties: {
    summary_metrics_data: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'summary_metrics_data_id',
          'summary_metric_id',
          'run_id',
          'calculated_at',
          'value',
          'key',
          'name',
          'description'
        ],
        properties: {
          summary_metrics_data_id: { type: 'string' },
          summary_metric_id: { type: 'integer' },
          run_id: { type: 'string', format: 'uuid' },
          calculated_at: { type: 'string', format: 'date-time' },
          value: SummaryMetricValueSchema,
          key: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' }
        }
      }
    }
  }
};
