import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../constants/database';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { ArtifactService } from '../../services/artifact-service';
import { scanFileForVirus } from '../../utils/file-utils';
import { getKeycloakSource } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';
import uuid from 'uuid'

const defaultLog = getLogger('paths/artifact/intake');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          validServiceClientIDs: [SOURCE_SYSTEM['SIMS-SVC-4464']],
          discriminator: 'ServiceClient'
        }
      ]
    };
  }),
  intakeArtifacts()
];

POST.apiDoc = {
  description: 'Submit an array of artifacts to BioHub.',
  tags: ['artifact'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    content: {
      'multipart/form-data': {
        schema: {
          type: 'object',
          required: ['media', 'metadata', 'data_package_id'],
          properties: {
            media: {
              type: 'string',
              format: 'binary',
              description: 'An artifact to be uploaded to BioHub'
            },
            data_package_id: {
              type: 'string',
              format: 'uuid',
              description: 'The unique identifier for this artifact collection.'
            },
            metadata: {
              type: 'object',
              properties: {
                title: {
                  description: 'The metadata title',
                  type: 'string'
                },
                description: {
                  description: 'The metadata description',
                  type: 'string'
                },
                foi_reason_description: {
                  description: 'The metadata foi_reason_description',
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
      description: 'Submission OK.',
      content: {
        'application/json': {
          schema: {
            type: 'object'
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function intakeArtifacts(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'intakeArtifacts', metadata: req.body.metadata, media: req.body.media });
    if (!req.files?.length) {
      throw new HTTP400('Missing required `media`');
    }

    if (req.files?.length !== 1) {
      // no media objects included
      throw new HTTP400('Too many files uploaded, expected 1');
    }

    const dataPackageId = req.body?.data_package_id;
    if (!dataPackageId) {
      throw new HTTP400('Data package ID is required');
    }

    const file: Express.Multer.File = Object.values(req.files)[0];
    const metadata = req.body.metadata
    if (!metadata) {
      throw new HTTP400('Metadata is required');
    }

    const fileParts = file.originalname.split('.');
    if (fileParts[fileParts.length - 1].toLocaleLowerCase() !== 'zip') {
      throw new HTTP400('File must be a .zip archive');
    }

    const fileUuid = fileParts[0];
    if (!uuid.validate(fileUuid)) {
      throw new HTTP400('File name must reflect a valid UUID');
    }

    // Scan all files for viruses
    const passesVirusCheck = await scanFileForVirus(file);
    if (!passesVirusCheck) {
      throw new HTTP400('Malicious content detected, upload cancelled');
    }

    const sourceSystem = getKeycloakSource(req['keycloak_token']);
    if (!sourceSystem) {
      throw new HTTP400('Failed to identify known submission source system', [
        'token did not contain a clientId/azp or clientId/azp value is unknown'
      ]);
    }

    const connection = getServiceAccountDBConnection(sourceSystem);

    try {
      await connection.open();

      const artifactService = new ArtifactService(connection);

      const response = await artifactService.uploadAndPersistArtifact(
        dataPackageId,
        metadata,
        fileUuid,
        file
      );

      res.status(200).json({ artifacts: response });

      await connection.commit();
    } catch (error) {
      defaultLog.error({ label: 'intakeArtifacts', message: 'error', error });
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };
}
