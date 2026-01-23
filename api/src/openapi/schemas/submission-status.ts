import { OpenAPIV3 } from 'openapi-types';

export const SubmissionStatusResponseSchema: OpenAPIV3.SchemaObject = {
  type: 'object',
  required: ['submission_id', 'upload', 'artifacts', 'scans', 'scan_files'],
  properties: {
    submission_id: {
      type: 'integer',
      minimum: 1
    },
    upload: {
      type: 'object',
      required: ['upload_id', 'upload_status'],
      properties: {
        upload_id: {
          type: 'string',
          format: 'uuid'
        },
        upload_status: {
          type: 'string',
          enum: ['pending', 'completed', 'aborted', 'expired', 'failed']
        }
      },
      additionalProperties: false
    },
    upload_archives: {
      type: 'array',
      items: {
        type: 'object',
        nullable: true,
        required: ['upload_archive_id', 'archive_status'],
        properties: {
          upload_archive_id: {
            type: 'string',
            format: 'uuid'
          },
          archive_status: {
            type: 'string',
            enum: ['draft', 'blocked', 'pending', 'completed', 'failed']
          },
          byte_size: {
            type: 'integer',
            nullable: true,
            description: 'Size of the archive artifact in bytes'
          },
          security: {
            type: 'string',
            enum: ['pending', 'clean', 'infected', 'error', 'skipped'],
            nullable: true
          }
        },
        additionalProperties: false
      }
    },
    artifacts: {
      type: 'object',
      description: 'Artifact counts and total byte sizes grouped by role',
      properties: {
        feature: {
          type: 'object',
          required: ['count', 'byte_size'],
          properties: {
            count: { type: 'integer', minimum: 0 },
            byte_size: { type: 'integer', minimum: 0 }
          },
          additionalProperties: false
        },
        attachment: {
          type: 'object',
          required: ['count', 'byte_size'],
          properties: {
            count: { type: 'integer', minimum: 0 },
            byte_size: { type: 'integer', minimum: 0 }
          },
          additionalProperties: false
        }
      },
      additionalProperties: false
    },
    scans: {
      type: 'array',
      description: 'List of artifact security scans',
      items: {
        type: 'object',
        required: ['artifact_security_scan_id', 'scan_status', 'scanner_version', 'scanned_at', 'results'],
        properties: {
          artifact_security_scan_id: {
            type: 'string',
            format: 'uuid'
          },
          scan_status: {
            type: 'string',
            enum: ['draft', 'blocked', 'pending', 'completed', 'failed']
          },
          scanner_version: {
            type: 'string',
            nullable: true
          },
          scanned_at: {
            type: 'string',
            nullable: true,
            description: 'ISO 8601 timestamp or PostgreSQL format'
          },
          results: {
            type: 'object',
            additionalProperties: true,
            description: 'Raw malware scan results'
          }
        },
        additionalProperties: false
      }
    },
    scan_files: {
      type: 'array',
      description: 'Per-file security scan results',
      items: {
        type: 'object',
        required: ['artifact_security_scan_file_id', 'file_path', 'result'],
        properties: {
          artifact_security_scan_file_id: {
            type: 'string',
            format: 'uuid'
          },
          file_path: {
            type: 'string'
          },
          result: {
            type: 'string',
            enum: ['pending', 'clean', 'infected', 'error', 'skipped']
          }
        },
        additionalProperties: false
      }
    }
  },
  additionalProperties: false
};
