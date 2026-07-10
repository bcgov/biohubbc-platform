import { OpenAPIV3 } from 'openapi-types';

export const UpdateSystemUserRequestSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  additionalProperties: false,
  required: ['record_end_date'],
  properties: {
    record_end_date: {
      type: 'string',
      nullable: true,
      description: 'Record end date. Set to null to activate the user.'
    }
  }
};
