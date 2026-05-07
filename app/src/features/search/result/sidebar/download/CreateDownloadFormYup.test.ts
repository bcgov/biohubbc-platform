import { describe, expect, it } from 'vitest';
import { CreateDownloadFormYup } from './CreateDownloadFormYup';

const validValues = {
  name: 'Moose download',
  description: 'Moose observations in the Skeena',
  featureTypes: ['dataset']
};

describe('CreateDownloadFormYup', () => {
  it('rejects an empty name', async () => {
    await expect(CreateDownloadFormYup.validate({ ...validValues, name: '' })).rejects.toThrow(/Name is required/);
  });

  it('rejects a name longer than 100 characters', async () => {
    await expect(CreateDownloadFormYup.validate({ ...validValues, name: 'x'.repeat(101) })).rejects.toThrow(
      /100 characters or less/
    );
  });

  it('rejects an empty featureTypes array', async () => {
    await expect(CreateDownloadFormYup.validate({ ...validValues, featureTypes: [] })).rejects.toThrow(
      /at least one feature type/
    );
  });

  it('rejects a description longer than 1000 characters', async () => {
    await expect(CreateDownloadFormYup.validate({ ...validValues, description: 'x'.repeat(1001) })).rejects.toThrow(
      /1000 characters or less/
    );
  });

  it('accepts valid values (with description)', async () => {
    await expect(CreateDownloadFormYup.validate(validValues)).resolves.toEqual(validValues);
  });

  it('accepts valid values (with null description)', async () => {
    const valuesWithNullDescription = { ...validValues, description: null };
    await expect(CreateDownloadFormYup.validate(valuesWithNullDescription)).resolves.toEqual(valuesWithNullDescription);
  });
});
