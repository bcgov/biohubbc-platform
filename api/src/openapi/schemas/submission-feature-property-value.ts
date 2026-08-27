/**
 * OpenAPI schemas for the values of indexed submitted properties, as returned by the
 * feature-detail properties list.
 *
 * Scalar-typed values are plain strings. Reference-typed values are structured objects that always
 * carry a display `label` plus the stable identifiers the UI links with. The object schemas are
 * disjoint (each requires every key and forbids extra keys), so a value matches exactly one `oneOf`
 * member under strict response validation.
 */

import { OpenAPIV3 } from 'openapi-types';

/**
 * Schema for a taxon-valued property: `{ taxon_id, tsn, rank, label }`.
 */
export const taxonPropertyValueSchema: OpenAPIV3.SchemaObject = {
  title: 'TaxonPropertyValue',
  type: 'object',
  required: ['taxon_id', 'tsn', 'rank', 'label'],
  additionalProperties: false,
  properties: {
    taxon_id: {
      type: 'integer',
      description: 'BioHub taxon identifier; identifies the taxon a link targets'
    },
    tsn: {
      type: 'integer',
      description: 'ITIS taxonomic serial number'
    },
    rank: {
      type: 'string',
      nullable: true,
      description: 'ITIS taxonomic rank (e.g. Species), when known'
    },
    label: {
      type: 'string',
      description: 'Display text: the taxon scientific name'
    }
  }
};

/**
 * Schema for a code-valued property: `{ codeset_key, codeset_label, code_key, code_label, label }`.
 */
export const codePropertyValueSchema: OpenAPIV3.SchemaObject = {
  title: 'CodePropertyValue',
  type: 'object',
  required: ['codeset_key', 'codeset_label', 'code_key', 'code_label', 'label'],
  additionalProperties: false,
  properties: {
    codeset_key: {
      type: 'string',
      description: 'Machine-readable key of the codeset the code belongs to'
    },
    codeset_label: {
      type: 'string',
      description: 'Display label of the codeset'
    },
    code_key: {
      type: 'string',
      description: 'Machine-readable key of the code; with the codeset key, identifies the code a link targets'
    },
    code_label: {
      type: 'string',
      description: 'Display label of the code'
    },
    label: {
      type: 'string',
      description: 'Display text: the code label'
    }
  }
};

/**
 * Schema for the `value` of an indexed submitted property: a string for scalar-typed properties, or
 * one of the structured reference-value objects.
 */
export const submissionFeaturePropertyValueSchema: OpenAPIV3.SchemaObject = {
  oneOf: [{ type: 'string' }, taxonPropertyValueSchema, codePropertyValueSchema]
};
