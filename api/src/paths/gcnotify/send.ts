import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../constants/roles';
import { getDBConnection } from '../../database/db';
import { IgcNotifyPostReturn } from '../../interfaces/gcnotify.interface';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { GCNotifyService } from '../../services/gcnotify-service';
import { getLogger } from '../../utils/logger';

const defaultLog = getLogger('paths/gcnotify/send');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  sendNotification()
];

POST.apiDoc = {
  description: 'Send notification to defined recipient',
  tags: ['user'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Send notification to given recipient',
    content: {
      'application/json': {
        schema: {
          title: 'User Response Object',
          type: 'object',
          required: ['recipient', 'message'],
          properties: {
            recipient: {
              type: 'object',
              oneOf: [
                {
                  required: ['emailAddress']
                },
                {
                  required: ['phoneNumber']
                },
                {
                  required: ['userId']
                }
              ],
              properties: {
                emailAddress: {
                  type: 'string'
                },
                phoneNumber: {
                  type: 'string'
                },
                userId: {
                  type: 'number'
                }
              }
            },
            message: {
              type: 'object',
              required: ['subject', 'header', 'body1', 'body2', 'footer'],
              properties: {
                subject: {
                  type: 'string'
                },
                header: {
                  type: 'string'
                },
                body1: {
                  type: 'string'
                },
                body2: {
                  type: 'string'
                },
                footer: {
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
      description: 'GC Notify Response',
      content: {
        'application/json': {
          schema: {
            title: 'User Response Object',
            type: 'object',
            properties: {
              content: {
                type: 'object'
              },
              id: {
                type: 'string'
              },
              reference: {
                type: 'string'
              },
              scheduled_for: {
                type: 'string'
              },
              template: {
                type: 'object'
              },
              uri: {
                type: 'string'
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Send Notification to a recipient.
 *
 * @returns {RequestHandler}
 */
export function sendNotification(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req['keycloak_token']);
    const gcnotifyService = new GCNotifyService(connection);

    const recipient = req.body?.recipient;
    const message = req.body?.message;

    try {
      let response = {} as IgcNotifyPostReturn;

      if (recipient.emailAddress) {
        response = await gcnotifyService.sendEmailGCNotification(recipient.emailAddress, message);
      }

      if (recipient.phoneNumber) {
        response = await gcnotifyService.sendPhoneNumberGCNotification(recipient.phoneNumber, message);
      }

      if (recipient.userId) {
        defaultLog.error({ label: 'send gcnotify', message: 'email and sms from Id not implemented yet' });
      }

      return res.status(200).json(response);
    } catch (error) {
      defaultLog.error({ label: 'send gcnotify', message: 'error', error });
      throw error;
    }
  };
}
