import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { PROJECT_ROLE } from '../../constants/roles';
import { getDBConnection } from '../../database/db';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
// import { SubmissionService } from '../../services/submission-service';
import { DarwinCoreService } from '../../services/dwc-service';
import { getFileFromS3 } from '../../utils/file-utils';
import { getLogger } from '../../utils/logger';
import { DWCArchive } from '../../utils/media/dwc/dwc-archive-file';

const defaultLog = getLogger('paths/dwc/scrape-occurrences');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validSystemRoles: [PROJECT_ROLE.PROJECT_LEAD, PROJECT_ROLE.PROJECT_EDITOR],
          discriminator: 'SystemUser'
        }
      ]
    };
  }),
  scrapeAndUploadOccurrences()
];

POST.apiDoc = {
  description: 'Scrape information from file into occurrence table.',
  tags: ['scrape', 'occurrence'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    description: 'Request body',
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['submission_id'],
          properties: {
            submission_id: {
              description: 'A submission ID',
              type: 'number',
              example: 1
            }
          }
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Successfully scraped and uploaded occurrence information.'
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

export function scrapeAndUploadOccurrences(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'scrapeAndUploadOccurrences', message: 'params', files: req.body });

    const submissionId = req.body.submission_id;

    console.log('submissionId:', submissionId);

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      // const submissionService = new SubmissionService(connection);

      // const data = {
      //   source: 'string',
      //   uuid: 'string',
      //   input_key: 'string',
      //   input_file_name: 'string',
      //   eml_source: ''
      // };

      // await submissionService.insertSubmission(data);

      const darwinCoreService = new DarwinCoreService(connection);

      const s3Key = await darwinCoreService.getS3Key(submissionId);

      console.log('s3Key:', s3Key);

      const s3File = await getFileFromS3(s3Key);

      console.log('s3File:', s3File);

      const dwcArchive: DWCArchive = await darwinCoreService.prepDWCArchive(s3File);

      console.log('dwcArchive:', dwcArchive);

      await darwinCoreService.scrapeAndUploadOccurrences(submissionId, dwcArchive);

      console.log('ASDDDDDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');

      await connection.commit();

      res.status(200).send();
    } catch (error) {
      defaultLog.error({ label: 'scrapeAndUploadOccurrences', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
