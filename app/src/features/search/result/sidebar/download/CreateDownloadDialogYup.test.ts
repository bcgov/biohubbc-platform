import { describe, expect, it } from 'vitest';
import { CreateDownloadDialogYup } from './CreateDownloadDialogYup';

const validValues = {
  name: 'Moose download',
  description: 'Moose observations in the Skeena',
  featureTypes: ['survey']
};

describe('CreateDownloadDialogYup', () => {
  it('rejects an empty name', async () => {
    await expect(CreateDownloadDialogYup.validate({ ...validValues, name: '' })).rejects.toThrow(/Name is required/);
  });

  it('rejects a name longer than 100 characters', async () => {
    await expect(CreateDownloadDialogYup.validate({ ...validValues, name: 'x'.repeat(101) })).rejects.toThrow(
      /100 characters or less/
    );
  });

  it('rejects an empty featureTypes array', async () => {
    await expect(CreateDownloadDialogYup.validate({ ...validValues, featureTypes: [] })).rejects.toThrow(
      /at least one feature type/
    );
  });

  it('rejects a description longer than 1000 characters', async () => {
    await expect(CreateDownloadDialogYup.validate({ ...validValues, description: 'x'.repeat(1001) })).rejects.toThrow(
      /1000 characters or less/
    );
  });

  it('accepts valid values (with description)', async () => {
    await expect(CreateDownloadDialogYup.validate(validValues)).resolves.toEqual(validValues);
  });

  it('accepts valid values (with null description)', async () => {
    const valuesWithNullDescription = { ...validValues, description: null };
    await expect(CreateDownloadDialogYup.validate(valuesWithNullDescription)).resolves.toEqual(
      valuesWithNullDescription
    );
  });
});
