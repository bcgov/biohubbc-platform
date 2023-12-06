export const BioHubDataSubmission = {
  title: 'BioHub Data Submission',
  type: 'object',
  required: ['id', 'type', 'properties', 'features'],
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
        $ref: '#/components/schemas/SubmissionFeature'
      }
    }
  },
  additionalProperties: false
};
