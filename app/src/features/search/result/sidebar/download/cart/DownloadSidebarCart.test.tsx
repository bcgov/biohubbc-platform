import { cleanup } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { CartSubmissionFeature } from 'interfaces/useCartApi.interface';
import { SearchFeatureResultWithRelevancy } from 'interfaces/useSearchApi.interface';
import { DownloadSidebarCart } from './DownloadSidebarCart';

vi.mock('hooks/useContext', () => ({
  useCartContext: vi.fn().mockReturnValue({
    clearCart: vi.fn(),
    removeFromCart: vi.fn()
  })
}));

describe('DownloadSidebarCart', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows lock icon for CartSubmissionFeature with secured: true', () => {
    const features: CartSubmissionFeature[] = [
      {
        cart_submission_feature_id: 'uuid-1',
        submission_feature_id: 1,
        submission_id: 1,
        feature_type_id: 1,
        feature_type_name: 'Observation',
        secured: true
      }
    ];

    const { getByTestId } = render(<DownloadSidebarCart features={features} itemCount={1} />);

    expect(getByTestId('secured-icon')).toBeVisible();
  });

  it('does not show lock icon for CartSubmissionFeature with secured: false', () => {
    const features: CartSubmissionFeature[] = [
      {
        cart_submission_feature_id: 'uuid-1',
        submission_feature_id: 1,
        submission_id: 1,
        feature_type_id: 1,
        feature_type_name: 'Observation',
        secured: false
      }
    ];

    const { queryByTestId } = render(<DownloadSidebarCart features={features} itemCount={1} />);

    expect(queryByTestId('secured-icon')).not.toBeInTheDocument();
  });

  it('shows lock icon for secured SearchFeatureResultWithRelevancy optimistic cart items', () => {
    const features: SearchFeatureResultWithRelevancy[] = [
      {
        submission_feature_id: 1,
        submission_id: 1,
        uuid: 'uuid-1',
        feature_type_id: 1,
        feature_type_name: 'Observation',
        feature_name: 'Test',
        feature_description: null,
        submission_name: 'Submission',
        is_secured: true,
        relevancy_score: 0.9,
        create_date: '2026-01-01T00:00:00Z'
      }
    ];

    const { getByTestId } = render(<DownloadSidebarCart features={features} itemCount={1} />);

    expect(getByTestId('secured-icon')).toBeVisible();
  });
});
