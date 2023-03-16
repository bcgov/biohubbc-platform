import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { validate as validateUuid } from 'uuid';
import { SOURCE_SYSTEM } from '../../constants/database';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { ArtifactService } from '../../services/artifact-service';
import { scanFileForVirus } from '../../utils/file-utils';
import { getKeycloakSource } from '../../utils/keycloak-utils';
import { getLogger } from '../../utils/logger';

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
  description: 'Submit an artifact to BioHub.',
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
              required: ['file_name', 'file_size', 'file_type'],
              properties: {
                title: {
                  description: 'The title of the artifact.',
                  type: 'string'
                },
                description: {
                  description: 'The description of the record.',
                  type: 'string',
                  maxLength: 250
                },
                file_name: {
                  description: 'The original name of the artifact.',
                  type: 'string'
                },
                file_type: {
                  description: 'The artifact type. Artifact type examples include video, audio and field data.',
                  type: 'string'
                },
                file_size: {
                  description: 'The size of the artifact, in bytes.',
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
            type: 'object',
            required: ['artifact_id'],
            properties: {
              artifact_id: {
                type: 'integer',
                minimum: 1
              }
            }
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function intakeArtifacts(): RequestHandler {
  return async (req, res) => {
    defaultLog.debug({ label: 'intakeArtifacts', body: req.body });
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
    const metadata = req.body.metadata;
    if (!metadata) {
      throw new HTTP400('Metadata is required');
    }

    const file_size = Number(metadata.file_size);
    if (isNaN(file_size) || file_size < 0) {
      throw new HTTP400('Metadata file_size must be a non-negative integer');
    }

    const fileParts = file.originalname.split('.');
    if (fileParts.length < 2 || fileParts[fileParts.length - 1].toLocaleLowerCase() !== 'zip') {
      throw new HTTP400('File must be a .zip archive');
    }

    const fileUuid = fileParts[0];
    if (!validateUuid(fileUuid)) {
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
        { ...metadata, file_size },
        fileUuid,
        file
      );

      res.status(200).json(response);

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
