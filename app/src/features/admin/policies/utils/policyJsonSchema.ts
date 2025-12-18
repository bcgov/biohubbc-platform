/**
 * Supported policy condition operators for filtering feature records.
 *
 * Operators are grouped by type:
 * - String: StringEquals, StringNotEquals, StringLike
 * - Numeric: NumericEquals
 * - Boolean: Bool, Exists
 * - Temporal: DateBefore, DateAfter
 * - Spatial: Within, Intersects, Contains
 * - Taxonomy: ParentOf, ChildOf
 */
export const PolicyConditionOperators = [
  'StringEquals',
  'StringNotEquals',
  'StringLike',
  'NumericEquals',
  'Bool',
  'Exists',
  'DateBefore',
  'DateAfter',
  'Within',
  'Intersects',
  'Contains',
  'ParentOf',
  'ChildOf'
] as const;

/**
 * Type representing any valid policy condition operator value.
 */
export type PolicyConditionOperator = (typeof PolicyConditionOperators)[number];

/**
 * JSON Schema (Draft-07) defining the structure of valid policy documents.
 *
 * Policy document structure:
 * - Version: Schema version string (currently "2025-12-01")
 * - Statement: Array of policy statements, each containing:
 *   - Effect: "Allow" or "Deny"
 *   - Resource: URN pattern (urn:<submissionId>:<featureType>:<featureId>)
 *   - Condition: Optional array of condition objects with Operator, Key, Value
 *
 * Used for validation in Monaco editor and provides autocomplete hints.
 */
export const policyJsonSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  type: 'object',
  required: ['Version', 'Statement'],
  properties: {
    Version: {
      type: 'string',
      enum: ['2025-12-01'],
      description: 'Policy version'
    },
    Statement: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['Effect', 'Resource'],
        properties: {
          Effect: {
            type: 'string',
            enum: ['Allow', 'Deny'],
            description: 'Whether to allow or deny access'
          },
          Resource: {
            type: 'string',
            pattern: String.raw`^urn:(\*|[0-9]+):(\*|[a-z_]+):(\*|[0-9]+)$`,
            description: 'URN pattern: urn:<submissionId>:<featureType>:<featureId>'
          },
          Condition: {
            type: 'array',
            description: 'Array of conditions that must all be true for the statement to apply',
            defaultSnippets: [
              {
                label: 'Add Condition',
                bodyText: '[\n  {\n    "Key": "$1",\n    "Operator": "$2",\n    "Value": "$3"\n  }\n]'
              }
            ],
            items: {
              type: 'object',
              required: ['Operator', 'Key', 'Value'],
              properties: {
                Operator: {
                  type: 'string',
                  minLength: 1,
                  description: 'The comparison operator to use'
                },
                Key: {
                  type: 'string',
                  minLength: 1,
                  description: 'The feature property key to evaluate'
                },
                Value: {
                  description: 'The value to compare against (type depends on operator)'
                }
              },
              additionalProperties: false
            }
          }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
};

/**
 * Metadata for policy condition operators, used for autocomplete suggestions and validation hints.
 *
 * Each operator entry includes:
 * - description: Human-readable explanation of operator behavior
 * - valueType: Expected type(s) for the condition Value field
 * - examples: Example values shown in autocomplete suggestions
 */
export const operatorMetadata: Record<
  PolicyConditionOperator,
  {
    description: string;
    valueType: string;
    examples: string[];
  }
> = {
  StringEquals: {
    description: 'Exact string match',
    valueType: 'string or string[]',
    examples: ['"value"', '["value1", "value2"]']
  },
  StringNotEquals: {
    description: 'String does not match',
    valueType: 'string or string[]',
    examples: ['"excluded_value"']
  },
  StringLike: {
    description: 'Pattern matching with wildcards (* and ?)',
    valueType: 'string or string[]',
    examples: ['"prefix*"', '"*suffix"', '"*contains*"']
  },
  NumericEquals: {
    description: 'Exact numeric match',
    valueType: 'number or number[]',
    examples: ['42', '[1, 2, 3]']
  },
  Bool: {
    description: 'Boolean comparison',
    valueType: 'boolean',
    examples: ['true', 'false']
  },
  Exists: {
    description: 'Check if property exists',
    valueType: 'boolean',
    examples: ['true', 'false']
  },
  DateBefore: {
    description: 'Date is before the specified value',
    valueType: 'ISO date string or string[]',
    examples: ['"2024-12-31"', '"2024-01-01T00:00:00Z"']
  },
  DateAfter: {
    description: 'Date is after the specified value',
    valueType: 'ISO date string or string[]',
    examples: ['"2024-01-01"', '"2024-06-15T12:00:00Z"']
  },
  Within: {
    description: 'Geometry is within the specified GeoJSON',
    valueType: 'GeoJSON object',
    examples: ['{"type": "Polygon", "coordinates": [...]}']
  },
  Intersects: {
    description: 'Geometry intersects the specified GeoJSON',
    valueType: 'GeoJSON object',
    examples: ['{"type": "Polygon", "coordinates": [...]}']
  },
  Contains: {
    description: 'Geometry contains the specified GeoJSON',
    valueType: 'GeoJSON object',
    examples: ['{"type": "Point", "coordinates": [...]}']
  },
  ParentOf: {
    description: 'Is a parent of the specified taxonomy value',
    valueType: 'string or string[]',
    examples: ['"Mammalia"', '["Carnivora", "Ursidae"]']
  },
  ChildOf: {
    description: 'Is a child of the specified taxonomy value',
    valueType: 'string or string[]',
    examples: ['"Animalia"', '["Chordata"]']
  }
};
