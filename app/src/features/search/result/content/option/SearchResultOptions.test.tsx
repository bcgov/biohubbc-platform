import { SEARCH_RESULT_VIEW } from 'constants/search';
import { render, screen } from 'test-helpers/test-utils';
import { SearchResultOptions } from './SearchResultOptions';

describe('SearchResultOptions', () => {
  it('gives table loading and empty fallbacks the full result width', () => {
    render(
      <SearchResultOptions
        rows={[]}
        featureTypeProperties={[]}
        isLoading
        view={SEARCH_RESULT_VIEW.TABLE}
        onClick={vi.fn()}
      />
    );

    expect(screen.getByTestId('search-result-options-content')).toHaveStyle({ width: '100%' });
  });
});
