import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import {
  CreateSubmissionUploadResponseSchema,
  SubmissionUploadRequestSchema
} from '../../../../openapi/schemas/upload';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { UserService } from '../../../../services/user-service';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/{submissionUuid}/upload');

export const POST: Operation = [
  authorizeRequestHandler((req) => ({
    or: [
      {
        discriminator: 'Team',
        entity: 'submission',
        submissionUuid: req.params.submissionUuid
      },
      { validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }
    ]
  })),
  createSubmissionUpload()
];

POST.apiDoc = {
  description:
    'Initialize a new archive upload for an existing submission. The authenticated user must belong to the submission team and is granted access to the new upload. Optional submitters are added to the submission and upload teams.',
  tags: ['submission'],
  security: [{ Bearer: [] }],
  parameters: [
    {
      description: 'Submission UUID.',
      in: 'path',
      name: 'submissionUuid',
      schema: {
        type: 'string',
        format: 'uuid'
      },
      required: true
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: SubmissionUploadRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Multipart upload initialized successfully with presigned URLs.',
      content: {
        'application/json': {
          schema: CreateSubmissionUploadResponseSchema
        }
      }
    },
    ...defaultErrorResponses
  }
};

/**
 * Appends a new upload to an existing submission.
 *
 * @returns {RequestHandler}
 */
export function createSubmissionUpload(): RequestHandler {
  return async (req, res) => {
    const token = req.keycloak_token!;

    const connection = getDBConnection(token);

    try {
      await connection.open();

      // The authenticated user is always added to both teams. Resolve every additional submitter
      // and add all of them as well.
      const submitterSystemUserIds: number[] = [];
      const userService = new UserService(connection);
      const resolvedSubmitterGuids = new Set<string>();
      for (const { guid, identifier, identitySource } of req.body.submitters ?? []) {
        const normalizedGuid = guid.toLowerCase();
        if (resolvedSubmitterGuids.has(normalizedGuid)) {
          continue;
        }
        resolvedSubmitterGuids.add(normalizedGuid);

        const submitter = await userService.ensureSystemUser(guid, identifier, identitySource);
        submitterSystemUserIds.push(submitter.system_user_id);
      }

      const submissionUuid = req.params.submissionUuid;
      const { bytes, blueprint_id } = req.body;

      const uploadIngestionService = new UploadIngestionService(connection);
      const result = await uploadIngestionService.startArchiveUploadForExistingSubmissionByUuid(
        bytes,
        submissionUuid,
        submitterSystemUserIds,
        blueprint_id
      );

      await connection.commit();

      return res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'createSubmissionUpload', message: 'error initializing submission upload', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
