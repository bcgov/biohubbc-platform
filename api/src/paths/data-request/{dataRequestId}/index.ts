import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../constants/roles';
import { getDBConnection } from '../../../database/db';
import { DataRequestResponseSchema, UpdateDataRequestSchema } from '../../../openapi/schemas/data-request';
import { defaultErrorResponses } from '../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../request-handlers/security/authorization';
import { DataRequestService } from '../../../services/data-request-service';
import { getLogger } from '../../../utils/logger';

const defaultLog = getLogger('paths/data-request/{dataRequestId}');

export const GET: Operation = [
  authorizeRequestHandler(() => {
    return {
      or: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  getDataRequestById()
];

export const PUT: Operation = [
  authorizeRequestHandler(() => {
    return {
      or: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  updateDataRequest()
];
export const DELETE: Operation = [
  authorizeRequestHandler(() => {
    return {
      or: [
        {
          validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN],
          discriminator: 'SystemRole'
        }
      ]
    };
  }),
  deleteDataRequest()
];

GET.apiDoc = {
  description: 'Get a data request by dataRequestId',
  tags: ['data-request'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'dataRequestId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      }
    }
  ],
  responses: {
    200: {
      description: 'Data request retrieved successfully',
      content: {
        'application/json': {
          schema: DataRequestResponseSchema
        }
      }
    },
    404: {
      description: 'Data request not found'
    },
    ...defaultErrorResponses
  }
};

PUT.apiDoc = {
  description: 'Update a data request',
  tags: ['data-request'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'dataRequestId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      }
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: UpdateDataRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'Data request updated successfully',
      content: {
        'application/json': {
          schema: DataRequestResponseSchema
        }
      }
    },
    404: {
      description: 'Data request not found'
    },
    ...defaultErrorResponses
  }
};

DELETE.apiDoc = {
  description: 'Soft delete a data request',
  tags: ['data-request'],
  security: [
    {
      Bearer: []
    }
  ],
  parameters: [
    {
      in: 'path',
      name: 'dataRequestId',
      required: true,
      schema: {
        type: 'string',
        format: 'uuid'
      }
    }
  ],
  responses: {
    200: {
      description: 'Data request deleted successfully'
    },
    404: {
      description: 'Data request not found'
    },
    ...defaultErrorResponses
  }
};

/**
 * Get a data request by ID.
 *
 * @returns {RequestHandler}
 */
export function getDataRequestById(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const dataRequestId = req.params.dataRequestId;
      const dataRequestService = new DataRequestService(connection);

      const dataRequest = await dataRequestService.getDataRequestById(dataRequestId);

      await connection.commit();

      return res.status(200).json(dataRequest);
    } catch (error) {
      defaultLog.error({ label: 'getDataRequestById', message: 'Error fetching data request', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Update a data request.
 *
 * @returns {RequestHandler}
 */
export function updateDataRequest(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const dataRequestId = req.params.dataRequestId;
      const dataRequestService = new DataRequestService(connection);

      const dataRequest = await dataRequestService.updateDataRequest(dataRequestId, req.body);

      await connection.commit();

      return res.status(200).json(dataRequest);
    } catch (error) {
      defaultLog.error({ label: 'updateDataRequest', message: 'Error updating data request', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Soft delete a data request.
 *
 * @returns {RequestHandler}
 */
export function deleteDataRequest(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const dataRequestId = req.params.dataRequestId;
      const dataRequestService = new DataRequestService(connection);

      await dataRequestService.deleteDataRequest(dataRequestId);

      await connection.commit();

      return res.sendStatus(200);
    } catch (error) {
      defaultLog.error({ label: 'deleteDataRequest', message: 'Error deleting data request', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
