import Ajv from 'ajv';
import { expect } from 'chai';
import { CreateSubmissionUploadRequestSchema, SubmissionUploadRequestSchema } from './upload';

describe('submission archive format validation', () => {
  for (const [operation, schema] of Object.entries({
    create: CreateSubmissionUploadRequestSchema,
    append: SubmissionUploadRequestSchema
  })) {
    const validate = new Ajv({ strict: false }).compile(schema);
    for (const archiveFormat of [undefined, 'tar', 'tar.gz', 'zip', 'gzip', '', null]) {
      it(`${operation} validates archive format ${archiveFormat}`, () => {
        const body = { bytes: 100, name: 'Test', description: 'Test', comment: 'Test', archiveFormat };
        expect(validate(body)).to.equal(
          archiveFormat === undefined || archiveFormat === 'tar' || archiveFormat === 'tar.gz'
        );
      });
    }
  }
});
