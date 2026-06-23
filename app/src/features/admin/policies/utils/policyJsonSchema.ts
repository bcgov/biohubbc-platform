/**
 * JSON Schema (Draft-07) defining the structure of valid policy documents.
 *
 * Policy document structure:
 * - Version: Schema version string (currently "2025-12-01")
 * - Statement: Array of policy statements, each containing:
 *   - Effect: "Allow" or "Deny"
 *   - Resource: URN pattern (urn:<submissionId>:<featureType>:<featureId>)
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
          }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
};
