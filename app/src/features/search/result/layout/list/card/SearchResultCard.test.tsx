import { cleanup } from '@testing-library/react';
import { createMockSearchFeature } from 'test-helpers/cart-helpers';
import { render } from 'test-helpers/test-utils';
import { SearchResultCard } from './SearchResultCard';

describe('SearchResultCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders lock icon when result is secured', () => {
    const securedResult = createMockSearchFeature(1, 'Dataset', true);

    const { getByTestId } = render(<SearchResultCard result={securedResult} isInCart={false} onClick={vi.fn()} />);

    expect(getByTestId('secured-icon')).toBeVisible();
  });

  it('does not render lock icon when result is not secured', () => {
    const unsecuredResult = createMockSearchFeature(2, 'Dataset', false);

    const { queryByTestId } = render(<SearchResultCard result={unsecuredResult} isInCart={false} onClick={vi.fn()} />);

    expect(queryByTestId('secured-icon')).not.toBeInTheDocument();
  });

  it('renders lock icon alongside cart buttons without conflict', () => {
    const securedResult = createMockSearchFeature(3, 'Observation', true);

    const { getByTestId, getByTitle } = render(
      <SearchResultCard result={securedResult} isInCart={false} onClick={vi.fn()} onAddToCart={vi.fn()} />
    );

    expect(getByTestId('secured-icon')).toBeVisible();
    expect(getByTitle('Add to Cart')).toBeVisible();
  });
});
