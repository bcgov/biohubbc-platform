import { expect } from 'chai';
import { describe } from 'mocha';
import { Models } from '../../models';
import { postOccurrenceSQL } from './occurrence-create-queries';

describe('postOccurrenceSQL', () => {
  it('returns a SQL statement when valid surveyId and occurrence provided', () => {
    const response = postOccurrenceSQL(1, new Models.occurrence.create.PostOccurrence());

    expect(response).to.not.be.null;
  });

  it('returns a SQL statement when occurrence has verbatimCoordinates', () => {
    const response = postOccurrenceSQL(
      1,
      new Models.occurrence.create.PostOccurrence({ verbatimCoordinates: '9N 300457 5884632' })
    );

    expect(response).to.not.be.null;
  });
});
