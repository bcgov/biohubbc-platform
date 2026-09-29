import { submissionUploadQueryKeys } from 'features/admin/reviews/submission-upload-query-keys';
import { TypedURLSearchParams } from 'hooks/useSearchQuery';
import { PropsWithChildren } from 'react';
import { MemoryRouter } from 'react-router';
import { createTestQueryClient, spyOnInvalidatedQueryKeys } from 'test-helpers/query-client';
import { act, render, screen } from 'test-helpers/test-utils';
import { SelectedFeatureRulesContainer } from '../../selected-rules/SelectedFeatureRulesContainer';
import { SecurityReviewFeatureTable } from '../../features/SecurityReviewFeatureTable';
import { SecurityFeaturePropertiesPanel } from '../../properties/SecurityFeaturePropertiesPanel';
import { SecurityReviewFeaturesTab } from './SecurityReviewFeaturesTab';
import { useSubmissionUploadFeatureSearch } from './useSubmissionUploadFeatureSearch';

const mocks = vi.hoisted(() => ({
  setSearchParams: vi.fn(),
  setSnackbar: vi.fn()
}));

vi.mock('hooks/useContext', () => ({
  useDialogContext: () => ({ setSnackbar: mocks.setSnackbar })
}));

vi.mock('./useSubmissionUploadFeatureSearch');

vi.mock('../../features/SecurityReviewFeatureTable', () => ({
  SecurityReviewFeatureTable: vi.fn(() => null)
}));

vi.mock('../../properties/SecurityFeaturePropertiesPanel', () => ({
  SecurityFeaturePropertiesPanel: vi.fn(() => <div data-testid="focused-feature-properties" />)
}));

vi.mock('../../selected-rules/SelectedFeatureRulesContainer', () => ({
  SelectedFeatureRulesContainer: vi.fn(() => null)
}));

vi.mock('../../feature-security-dialog/FeatureSecurityDialog', () => ({
  FeatureSecurityDialog: vi.fn(() => null)
}));

const props = { submissionId: 15, submissionUploadId: 'upload-id', submissionUploadReviewId: 'review-id' };
const expression = {
  type: 'expression' as const,
  operator: 'AND' as const,
  clauses: [
    {
      type: 'predicate' as const,
      feature_property_id: 4,
      blueprint_feature_type_property_id: null,
      operator: 'Contains' as const,
      value: 'moose'
    }
  ]
};
const feature = {
  submission_feature_id: 42,
  feature_type_id: 1,
  feature_type_name: 'survey',
  parent_submission_feature_id: null,
  create_date: '2026-01-01',
  provenance: null
};

/**
 * Returns the props of the latest feature table render.
 *
 * @returns The feature table props.
 */
const table = () => vi.mocked(SecurityReviewFeatureTable).mock.lastCall![0];

/**
 * Wraps the tab in a router at the root URL.
 *
 * @param {PropsWithChildren} props The tab.
 * @returns {JSX.Element} The router.
 */
const RootRouter = ({ children }: PropsWithChildren) => <MemoryRouter>{children}</MemoryRouter>;

describe('SecurityReviewFeaturesTab', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSubmissionUploadFeatureSearch).mockReturnValue({
      rows: [],
      response: undefined,
      isLoading: true,
      totalCount: 0,
      cursor: { limit: 10, sort: 'relevancy_score', order: 'desc', next: null, previous: null },
      searchParams: new TypedURLSearchParams(),
      setSearchParams: mocks.setSearchParams
    });
  });

  it('loads cursor-paginated expression results for the upload', () => {
    render(<SecurityReviewFeaturesTab {...props} />, { wrapper: RootRouter });

    expect(useSubmissionUploadFeatureSearch).toHaveBeenCalledWith(15, 'upload-id', null);
  });

  it('clears the selection and searches again when the applied expression is re-applied', () => {
    const queryClient = createTestQueryClient();
    const invalidatedKeys = spyOnInvalidatedQueryKeys(queryClient);
    render(<SecurityReviewFeaturesTab {...props} />, { wrapper: RootRouter, queryClient });
    act(() => table().onSelectionChange([42]));

    act(() => table().onExpressionApply(null));

    expect(invalidatedKeys()).toEqual([submissionUploadQueryKeys.featureSearch(props)]);
    expect(table().selectedFeatureIds).toEqual([]);
    expect(vi.mocked(SelectedFeatureRulesContainer).mock.lastCall![0].selectedFeatureIds).toEqual([]);
  });

  it('clears the selection through the URL, without invalidating, when a new expression is applied', () => {
    const queryClient = createTestQueryClient();
    const invalidatedKeys = spyOnInvalidatedQueryKeys(queryClient);
    render(<SecurityReviewFeaturesTab {...props} />, { wrapper: RootRouter, queryClient });
    act(() => table().onSelectionChange([42]));

    act(() => table().onExpressionApply(expression));

    expect(invalidatedKeys()).toEqual([]);
    expect(useSubmissionUploadFeatureSearch).toHaveBeenLastCalledWith(15, 'upload-id', expression);
    expect(table().selectedFeatureIds).toEqual([]);
    expect(vi.mocked(SelectedFeatureRulesContainer).mock.lastCall![0].expression).toEqual(expression);
  });

  it('keeps the property panel mounted from page load while switching features and visibility', () => {
    const { unmount } = render(<SecurityReviewFeaturesTab {...props} />, { wrapper: RootRouter });
    const panel = screen.getByTestId('focused-feature-properties');
    expect(panel).not.toBeVisible();
    expect(vi.mocked(SecurityFeaturePropertiesPanel).mock.lastCall![0].feature).toBeNull();
    act(() => table().onSelectionChange([42]));
    expect(panel).not.toBeVisible();
    act(() => table().onOpenProperties(feature));
    expect(panel).toBeVisible();
    act(() => table().onSelectionChange([43]));
    expect(panel).not.toBeVisible();
    act(() => table().onOpenProperties({ ...feature, submission_feature_id: 43 }));
    expect(panel).toBeVisible();
    expect(screen.getByTestId('focused-feature-properties')).toBe(panel);
    expect(vi.mocked(SecurityFeaturePropertiesPanel).mock.lastCall![0].feature?.submission_feature_id).toBe(43);
    act(() => vi.mocked(SecurityFeaturePropertiesPanel).mock.lastCall![0].onClose());
    expect(panel).not.toBeVisible();
    expect(panel).toBeInTheDocument();
    unmount();
    expect(panel).not.toBeInTheDocument();
  });

  it('keeps selection, focused properties, and grid callbacks across a rerender', () => {
    const { rerender } = render(<SecurityReviewFeaturesTab {...props} />, { wrapper: RootRouter });
    act(() => table().onSelectionChange([42]));
    act(() => table().onOpenProperties(feature));
    const openProperties = table().onOpenProperties;
    const openSecurity = table().onOpenSecurity;

    rerender(<SecurityReviewFeaturesTab {...props} />);

    expect(table().selectedFeatureIds).toEqual([42]);
    expect(table().onOpenProperties).toBe(openProperties);
    expect(table().onOpenSecurity).toBe(openSecurity);
    expect(vi.mocked(SecurityFeaturePropertiesPanel).mock.lastCall![0].feature).toBe(feature);
    expect(screen.getByTestId('focused-feature-properties')).toBeVisible();
    expect(mocks.setSearchParams).not.toHaveBeenCalled();
  });
});
