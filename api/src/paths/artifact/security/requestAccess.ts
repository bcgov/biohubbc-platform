import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { getAPIUserDBConnection, getDBConnection } from '../../../database/db';
import { GCNotifyService } from '../../../services/gcnotify-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('/api/artifact/security/requestAccess');

export const POST: Operation = [requestAccess()];

POST.apiDoc = {
  description: 'Request access to secure artifacts in Biohub.',
  tags: ['documents', 'security', 'biohub'],
  security: [
    {
      OptionalBearer: []
    }
  ],
  requestBody: {
    description: 'request body to request access to secure artifacts',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: [
            'fullName',
            'emailAddress',
            'phoneNumber',
            'reasonDescription',
            'hasSignedAgreement',
            'artifactIds',
            'pathToParent'
          ],
          properties: {
            fullName: {
              type: 'string',
              description: "Requester's full name"
            },
            emailAddress: {
              type: 'string',
              description: "Requester's contact email address"
            },
            phoneNumber: {
              type: 'string',
              description: "Requester's contact phone number"
            },
            reasonDescription: {
              type: 'string',
              description: 'Detailed reason for the access request'
            },
            hasSignedAgreement: {
              type: 'boolean',
              description:
                'Requester affirms that they have a signed and current Confidentiality and Non-Reproduction Agreement'
            },
            pathToParent: {
              type: 'string',
              description: 'URL path of the parent dataset belonging to the request artifacts'
            },
            artifactIds: {
              type: 'array',
              minItems: 1,
              description: 'The primary keys belonging to the requested artifacts',
              items: {
                type: 'integer',
                minimum: 1
              }
            },
            companyInformation: {
              type: 'object',
              required: ['companyName', 'jobTitle', 'streetAddress', 'city', 'postalCode'],
              properties: {
                companyName: {
                  type: 'string'
                },
                jobTitle: {
                  type: 'string'
                },
                streetAddress: {
                  type: 'string'
                },
                city: {
                  type: 'string'
                },
                postalCode: {
                  type: 'string'
                }
              }
            },
            professionalOrganization: {
              type: 'object',
              properties: {
                organizationName: {
                  type: 'string'
                },
                memberNumber: {
                  type: 'string'
                }
              }
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Request sent',
      content: {
        'application/json': {
          schema: {
            title: 'email sent response',
            type: 'boolean'
          }
        }
      }
    },
    400: {
      $ref: '#/components/responses/400'
    },
    401: {
      $ref: '#/components/responses/401'
    },
    403: {
      $ref: '#/components/responses/401'
    },
    500: {
      $ref: '#/components/responses/500'
    },
    default: {
      $ref: '#/components/responses/default'
    }
  }
};

/**
 * Publish project data to Biohub.
 *
 * @return {*}  {RequestHandler}
 */
export function requestAccess(): RequestHandler {
  return async (req, res) => {
    const connection = req['keycloak_token'] ? getDBConnection(req['keycloak_token']) : getAPIUserDBConnection();

    const resubmitData = req.body;

    try {
      await connection.open();

      const gcNotifyService = new GCNotifyService(connection);

      const response = await gcNotifyService.sendNotificationForArtifactRequestAccess(resubmitData);

      await connection.commit();

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'resubmitAttachment', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
