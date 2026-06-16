import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import {
  CreateDownloadScheduleRequestSchema,
  DownloadScheduleResponseSchema
} from '../../../../openapi/schemas/download-schedule';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import {
  CreateDownloadScheduleRequest,
  DownloadScheduleService
} from '../../../../services/download/download-schedule-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/download/{downloadId}/schedule');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  upsertDownloadSchedule()
];

export const GET: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  getDownloadSchedule()
];

export const DELETE: Operation = [
  authorizeRequestHandler(() => ({
    and: [{ validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }]
  })),
  disableDownloadSchedule()
];

POST.apiDoc = {
  description: 'Create or update the single active recurring rebuild schedule for a download.',
  tags: ['download'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'downloadId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Download UUID.'
    }
  ],
  requestBody: {
    content: {
      'application/json': {
        schema: CreateDownloadScheduleRequestSchema
      }
    }
  },
  responses: {
    200: {
      description: 'The created or updated download schedule',
      content: {
        'application/json': {
          schema: DownloadScheduleResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

GET.apiDoc = {
  description: 'Get the active recurring rebuild schedule for a download.',
  tags: ['download'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'downloadId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Download UUID.'
    }
  ],
  responses: {
    200: {
      description: 'The active download schedule',
      content: {
        'application/json': {
          schema: DownloadScheduleResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

DELETE.apiDoc = {
  description: 'Disable the active recurring rebuild schedule for a download.',
  tags: ['download'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      in: 'path',
      name: 'downloadId',
      required: true,
      schema: { type: 'string', format: 'uuid' },
      description: 'Download UUID.'
    }
  ],
  responses: {
    204: {
      description: 'Download schedule disabled successfully.'
    },
    ...defaultErrorResponses
  }
};

/**
 * Create or update the single active recurring rebuild schedule for a download.
 *
 * POST upserts because at most one active schedule exists per download — the service updates the
 * existing active row or creates one. Authorization (System Administrator role) is enforced at the
 * route; cron/timezone validation lives in the service.
 *
 * @return {RequestHandler}
 */
export function upsertDownloadSchedule(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const downloadId = req.params.downloadId;
      const body: CreateDownloadScheduleRequest = req.body;

      const scheduleService = new DownloadScheduleService(connection);
      const schedule = await scheduleService.upsertSchedule(downloadId, body);

      await connection.commit();

      return res.status(200).json(schedule);
    } catch (error) {
      defaultLog.error({ label: 'upsertDownloadSchedule', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Get the active recurring rebuild schedule for a download.
 *
 * Returns the single active schedule; the service surfaces a missing schedule as a 404.
 * Authorization (System Administrator role) is enforced at the route.
 *
 * @return {RequestHandler}
 */
export function getDownloadSchedule(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const downloadId = req.params.downloadId;

      const scheduleService = new DownloadScheduleService(connection);
      const schedule = await scheduleService.getActiveSchedule(downloadId);

      await connection.commit();

      return res.status(200).json(schedule);
    } catch (error) {
      defaultLog.error({ label: 'getDownloadSchedule', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}

/**
 * Disable the active recurring rebuild schedule for a download.
 *
 * Turning off a recurrence soft-deletes the single active schedule row; the service surfaces a
 * missing schedule as a 404. Authorization (System Administrator role) is enforced at the route.
 *
 * @return {RequestHandler}
 */
export function disableDownloadSchedule(): RequestHandler {
  return async (req, res) => {
    const connection = getDBConnection(req.keycloak_token);

    try {
      await connection.open();

      const downloadId = req.params.downloadId;

      const scheduleService = new DownloadScheduleService(connection);
      await scheduleService.disableSchedule(downloadId);

      await connection.commit();

      return res.status(204).send();
    } catch (error) {
      defaultLog.error({ label: 'disableDownloadSchedule', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
