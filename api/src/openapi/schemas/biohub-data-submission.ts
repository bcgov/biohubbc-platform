export const BioHubDataSubmission = {
  title: 'BioHub Data Submission',
  type: 'object',
  required: ['id', 'type', 'features'],
  properties: {
    id: {
      title: 'Unique id of the submission',
      type: 'string'
    },
    type: {
      type: 'string',
      enum: ['dataset']
    },
    properties: {
      title: 'Feature properties',
      type: 'object',
      properties: {}
    },
    features: {
      type: 'array',
      items: {
        $ref: '#/$defs/Feature'
      }
    }
  },
  $defs: {
    Feature: {
      title: 'BioHub Data Submission Feature',
      type: 'object',
      required: ['id', 'type', 'properties', 'features'],
      properties: {
        id: {
          title: 'Unique id of the feature',
          type: 'string'
        },
        type: {
          title: 'Feature type',
          type: 'string',
          enum: ['observation']
        },
        properties: {
          title: 'Feature properties',
          type: 'object',
          properties: {}
        },
        features: {
          title: 'Feature child features',
          type: 'array',
          items: {
            $ref: '#/$defs/Feature'
          }
        }
      },
      additionalProperties: false
    },
    additionalProperties: false
  },
  additionalProperties: false
};
