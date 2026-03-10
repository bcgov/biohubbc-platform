import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { v4 } from 'uuid';
import { SYSTEM_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { HTTP400 } from '../../../../errors/http-error';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import {
  CreateSubmissionUploadRequestSchema,
  CreateSubmissionUploadResponseSchema
} from '../../../../openapi/schemas/upload';
import { ICreateSubmission } from '../../../../repositories/submission-repository';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { ContributorService } from '../../../../services/contributor-service';
import { UploadIngestionService } from '../../../../services/upload/upload-ingestion-service';
import { getServiceClientSystemUser } from '../../../../utils/keycloak-utils';
import { getLogger } from '../../../../utils/logger';

const defaultLog = getLogger('paths/submission/upload/archive');

export const POST: Operation = [
  authorizeRequestHandler(() => ({
    or: [
      { discriminator: 'ServiceClient' },
      { validSystemRoles: [SYSTEM_ROLE.SYSTEM_ADMIN], discriminator: 'SystemRole' }
    ]
  })),
  startUpload()
];

POST.apiDoc = {
  description: 'Initialize a new archive upload for a submission and get presigned URLs.',
  tags: ['submission'],
  security: [{ Bearer: [] }],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: CreateSubmissionUploadRequestSchema
      }
    }
  },
  responses: {
    201: {
      description: 'Multipart upload initialized successfully with presigned URLs',
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
 * Returns presigned upload URL resources for a new submission archive
 *
 * @returns {RequestHandler}
 */
export function startUpload(): RequestHandler {
  return async (req, res) => {
    const token = req.keycloak_token!;

    const connection = getDBConnection(token);

    try {
      await connection.open();

      const { system_user_id } = req.system_user;
      const contributorService = new ContributorService(connection);

      const serviceClientSystemUser = getServiceClientSystemUser(token);
      const contributorClientId = token.clientId;

      if (!contributorClientId) {
        throw new HTTP400('Failed to identify known submission source system', [
          'token did not contain a service client id'
        ]);
      }

      let contributorId: number;

      if (serviceClientSystemUser) {
        contributorId = await contributorService.ensureContributorForSystemUser(
          contributorClientId,
          serviceClientSystemUser.system_user_id
        );
      } else {
        contributorId = await contributorService.ensureContributor(contributorClientId);
      }

      const { bytes, ...rest } = req.body;
      const submission = { ...rest, uuid: v4(), system_user_id, contributor_id: contributorId } as ICreateSubmission;
      const uploadIngestionService = new UploadIngestionService(connection);

      const result = await uploadIngestionService.startArchiveUpload(bytes, submission);

      await connection.commit();

      res.status(201).json(result);
    } catch (error) {
      defaultLog.error({ label: 'startUpload', message: 'error initializing archive upload', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
