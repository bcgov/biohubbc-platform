import { cleanup } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { CartFeatureCard } from './CartFeatureCard';

describe('CartFeatureCard', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders lock icon when secured is true', () => {
    const { getByTestId } = render(<CartFeatureCard label="Observation" secured={true} />);

    expect(getByTestId('secured-icon')).toBeVisible();
  });

  it('does not render lock icon when secured is false', () => {
    const { queryByTestId } = render(<CartFeatureCard label="Observation" secured={false} />);

    expect(queryByTestId('secured-icon')).not.toBeInTheDocument();
  });

  it('does not render lock icon when secured is undefined', () => {
    const { queryByTestId } = render(<CartFeatureCard label="Observation" />);

    expect(queryByTestId('secured-icon')).not.toBeInTheDocument();
  });
});
