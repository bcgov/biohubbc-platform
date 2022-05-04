import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { PROJECT_ROLE } from '../../../../constants/roles';
import { getDBConnection } from '../../../../database/db';
import { defaultErrorResponses } from '../../../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../../../request-handlers/security/authorization';
import { DarwinCoreService } from '../../../../services/dwc-service';
import { SubmissionService } from '../../../../services/submission-service';
import { getFileFromS3 } from '../../../../utils/file-utils';
import { getLogger } from '../../../../utils/logger';
import { DWCArchive } from '../../../../utils/media/dwc/dwc-archive-file';

const defaultLog = getLogger('paths/dwc/dataset/{submissionId}/scrape-occurrences');

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
  parameters: [
    {
      in: 'path',
      name: 'submissionId',
      schema: {
        type: 'number'
      },
      required: true
    }
  ],
  responses: {
    200: {
      description: 'Successfully scraped and uploaded occurrence information.'
    },
    ...defaultErrorResponses
  }
};

export function scrapeAndUploadOccurrences(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'scrapeAndUploadOccurrences', message: 'params', files: req.body });

    const submissionId = Number(req.params.submissionId);

    const connection = getDBConnection(req['keycloak_token']);

    try {
      await connection.open();

      const darwinCoreService = new DarwinCoreService(connection);
      const submissionService = new SubmissionService(connection);

      const submissionRecord = await submissionService.getSubmissionRecordBySubmissionId(submissionId);

      const s3File = await getFileFromS3(submissionRecord.input_key);

      const dwcArchive: DWCArchive = await darwinCoreService.prepDWCArchive(s3File);

      await darwinCoreService.scrapeAndUploadOccurrences(submissionId, dwcArchive);

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
