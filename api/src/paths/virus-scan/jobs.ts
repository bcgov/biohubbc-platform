import { RequestHandler } from 'express';
import { Operation } from 'express-openapi';
import { HTTP400 } from '../../errors/http-error';
import { defaultErrorResponses } from '../../openapi/schemas/http-responses';
import { authorizeRequestHandler } from '../../request-handlers/security/authorization';
import { IVirusScanJob, VirusScanQueueService } from '../../services/virus-scan-queue-service';
import { getLogger } from '../../utils/logger';

// just a simple example of enqueuing a job, actual work will be done later

const defaultLog = getLogger('paths/virus-scan/jobs');

export const POST: Operation = [
  authorizeRequestHandler(() => {
    return {
      and: [
        {
          discriminator: 'ServiceClient'
        }
      ]
    };
  }),
  enqueueVirusScanJob()
];

POST.apiDoc = {
  description: 'Add a virus scan job to the queue.',
  tags: ['virus-scan'],
  security: [
    {
      Bearer: []
    }
  ],
  requestBody: {
    required: true,
    content: {
      'application/json': {
        schema: {
          type: 'object',
          required: ['fileKey'],
          properties: {
            fileKey: {
              type: 'string',
              description: 'Object store key or path to scan.'
            },
            bucket: {
              type: 'string',
              nullable: true,
              description: 'Optional bucket to read the file from.'
            },
            fileName: {
              type: 'string',
              nullable: true,
              description: 'Original file name.'
            },
            metadata: {
              type: 'object',
              nullable: true,
              additionalProperties: true,
              description: 'Optional metadata to include with the job.'
            }
          },
          additionalProperties: false
        }
      }
    }
  },
  responses: {
    200: {
      description: 'Job queued',
      content: {
        'application/json': {
          schema: {
            type: 'object',
            required: ['job_id', 'queue'],
            properties: {
              job_id: {
                type: 'string'
              },
              queue: {
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

export function enqueueVirusScanJob(): RequestHandler {
  return async (req, res) => {
    if (!req.body?.fileKey) {
      throw new HTTP400('Missing required `fileKey`');
    }

    const payload: IVirusScanJob = {
      fileKey: req.body.fileKey,
      bucket: req.body.bucket,
      fileName: req.body.fileName,
      metadata: req.body.metadata
    };

    const queueService = new VirusScanQueueService();
    const job = await queueService.enqueue(payload);

    defaultLog.info({
      label: 'enqueueVirusScanJob',
      message: 'queued virus scan job',
      jobId: job.jobId,
      queue: job.queue
    });

    res.status(200).json({ job_id: job.jobId, queue: job.queue });
  };
}
