export const rootAPIDoc = {
  openapi: '3.0.0',
  info: {
    version: '0.0.0',
    title: 'biohub-api',
    description: 'API for BioHub',
    license: {
      name: 'Apache 2.0',
      url: 'https://www.apache.org/licenses/LICENSE-2.0.html'
    }
  },
  servers: [
    {
      url: 'http://localhost:6100/api',
      description: 'local api via docker'
    },
    {
      url: 'https://api-dev-biohubbc-platform.apps.silver.devops.gov.bc.ca',
      description: 'deployed api in dev environment'
    },
    {
      url: 'https://api-test-biohubbc-platform.apps.silver.devops.gov.bc.ca',
      description: 'deployed api in test environment'
    },
    {
      url: 'https://api-biohubbc-platform.apps.silver.devops.gov.bc.ca',
      description: 'deployed api in prod environment'
    }
  ],
  tags: [],
  externalDocs: {
    description: 'Visit GitHub to find out more about this API',
    url: 'https://github.com/bcgov/biohubbc-platform.git'
  },
  paths: {},
  components: {
    securitySchemes: {
      Bearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          "To access the authenticated api routes, a valid JWT token must be present in the 'Authorization' header. The 'Authorization' header value must be of the form: `Bearer xxxxxx.yyyyyyy.zzzzzz`. This security scheme should be used on endpoints that require a request to be authenticated."
      },
      OptionalBearer: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description:
          "To access optionally authenticated api routes, a valid JWT token may optionally be provided in the 'Authorization' header. The 'Authorization' header value must be of the form: `Bearer xxxxxx.yyyyyyy.zzzzzz`. This security scheme should be used on endpoints that do not require a request to be authenticated, but which do return different values based on whether or not the request is authenticated."
      }
    },
    responses: {
      '400': {
        description: 'Bad Request',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      '401': {
        description: 'Unauthorized',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      '403': {
        description: 'Forbidden',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      '409': {
        description: 'Conflict',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      '500': {
        description: 'Internal Server Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      },
      default: {
        description: 'Unknown Error',
        content: {
          'application/json': {
            schema: {
              $ref: '#/components/schemas/Error'
            }
          }
        }
      }
    },
    schemas: {
      Error: {
        description: 'Error response object',
        required: ['name', 'status', 'message'],
        properties: {
          name: {
            type: 'string'
          },
          status: {
            type: 'number'
          },
          message: {
            type: 'string'
          },
          errors: {
            type: 'array',
            items: {
              anyOf: [
                {
                  type: 'string'
                },
                {
                  type: 'object'
                }
              ]
            }
          }
        }
      },
      SubmissionFeature: {
        title: 'BioHub Data Submission Feature',
        description:
          'The submission feature object is a self-referencing recursive structure designed to support different classes of biotic data, in a hierarchical structure.',
        type: 'object',
        required: ['type', 'properties', 'child_features'],
        properties: {
          id: {
            title: 'Unique identifer.',
            description:
              'The unique identifier for the submission feature as supplied by the source system. May not be unique globally or within BioHub.',
            type: 'string',
            maxLength: 200
          },
          type: {
            title: 'Feature type.',
            description: 'The type of the feature. Must match a supported feature type.',
            type: 'string'
          },
          properties: {
            title: 'Feature properties.',
            description: 'The properties of the feature, which are specific to the feature type.',
            type: 'object',
            properties: {}
          },
          child_features: {
            title: 'Child features.',
            description: 'Child features of the current feature.',
            type: 'array',
            items: {
              $ref: '#/components/schemas/SubmissionFeature'
            }
          }
        },
        additionalProperties: false
      }
    }
  }
};
