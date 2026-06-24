import { cleanup } from '@testing-library/react';
import { createMockSearchFeature } from 'test-helpers/search-result-helpers';
import { render } from 'test-helpers/test-utils';
import { SearchResultCard } from './SearchResultCard';

describe('SearchResultCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders lock icon when result is secured', () => {
    const securedResult = createMockSearchFeature(1, 'Dataset', true);

    const { getByTestId } = render(<SearchResultCard result={securedResult} onClick={vi.fn()} />);

    expect(getByTestId('secured-icon')).toBeVisible();
  });

  it('does not render lock icon when result is not secured', () => {
    const unsecuredResult = createMockSearchFeature(2, 'Dataset', false);

    const { queryByTestId } = render(<SearchResultCard result={unsecuredResult} onClick={vi.fn()} />);

    expect(queryByTestId('secured-icon')).not.toBeInTheDocument();
  });

  it('opens the result when clicked', () => {
    const securedResult = createMockSearchFeature(3, 'Observation', true);
    const onClick = vi.fn();

    const { getByRole } = render(<SearchResultCard result={securedResult} onClick={onClick} />);

    getByRole('button').click();

    expect(onClick).toHaveBeenCalledWith(securedResult);
  });
});
