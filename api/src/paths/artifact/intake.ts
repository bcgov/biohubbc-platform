import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { SOURCE_SYSTEM } from '../../constants/database';
import { getServiceAccountDBConnection } from '../../database/db';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { IArtifactMetadata } from '../../repositories/artifact-repository';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { ArtifactService } from '../../services/artifact-service';
import { SubmissionService } from '../../services/submission-service';
import { generateS3FileKey, scanFileForVirus, uploadFileToS3 } from '../../utils/file-utils';
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
            metadata: {
              type: 'array',
              items: {
                type: 'string',
                description: 'JSON containing the metadata for each file'
              }
            },
            data_package_id: {
              type: 'string',
              format: 'uuid',
              description:
                'The unique identifier for this artifact collection.'
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
            
          }
        }
      }
    },
    ...defaultErrorResponses
  }
};

export function intakeArtifacts(): RequestHandler {
  return async (req, res) => {
    if (!req?.files?.length) {
      throw new HTTP400('Missing required `media`');
    }

    const files: Express.Multer.File[] = Object.values(req.files);
    if (req.body.metadata?.length !== files.length) {
      throw new HTTP400('File count and metadata record count do not agree');
    }

    const dataPackageId = req.body?.data_package_id;
    if (!dataPackageId) {
      throw new HTTP400('Data package ID is required');
    }

    // Scan all files for viruses
    const virusScanResults = await Promise.all(files.map(async (file) => scanFileForVirus(file)));
    if (virusScanResults.some((result: boolean) => !result)) {
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

      const submissionService = new SubmissionService(connection);
      const artifactService = new ArtifactService(connection);

      // Fetch the source transform record for this submission based on the source system user id
      const sourceTransformRecord = await submissionService.getSourceTransformRecordBySystemUserId(
        connection.systemUserId()
      );

      if (!sourceTransformRecord) {
        throw new HTTP400('Failed to get source transform record for system user');
      }

      const metadataRecords: string[] = req.body.metadata;
      const { source_transform_id } = sourceTransformRecord;

      // Create a new submission for the artifact collection
      const { submission_id } = await submissionService.getOrInsertSubmissionRecord({
        source_transform_id: sourceTransformRecord.source_transform_id,
        uuid: dataPackageId
      });
      
      // Retrieve the ID that will be assigned to the artifact once it's inserted
      const insertArtifactId = await artifactService.getNextArtifactId();

      const artifactPersistPromises = files.map(async (file: Express.Multer.File, fileIndex: number) => {
        const artifactMetadata: IArtifactMetadata = JSON.parse(metadataRecords[fileIndex]);
        const artifactId = insertArtifactId + fileIndex;

        // Generate the S3 key for the artifact, using the preemptive artifact ID + the package UUID
        const s3Key = generateS3FileKey({
          artifactId,
          uuid: dataPackageId,
          fileName: file.originalname
        });

        // Upload the artifact to S3
        const fileUploadResponse = await uploadFileToS3(file, s3Key, { filename: file.originalname });

        // If the file was successfully uploaded, we persist the artifact in the database
        const artifactInsertResponse = await artifactService.insertArtifactMetadata({
          ...artifactMetadata,
          artifact_id: artifactId,
          submission_id,
          uuid: dataPackageId,
          file_name: file.originalname,
          file_type: 'Miscellaneous' // TODO
        })

        return {
          artifact_id: artifactInsertResponse.artifact_id,
          s3Key: fileUploadResponse.Key,
          source_transform_id,
          submission_id
        };
      });

      const response = await Promise.all(artifactPersistPromises);

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
