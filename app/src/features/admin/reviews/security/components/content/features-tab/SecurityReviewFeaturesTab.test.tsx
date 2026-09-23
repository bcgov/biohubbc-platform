import { act, render, screen } from '@testing-library/react';
import { TypedURLSearchParams } from 'hooks/useSearchQuery';
import { MemoryRouter } from 'react-router';
import { FeatureSecurityDialog } from '../../feature-security-dialog/FeatureSecurityDialog';
import { SelectedFeatureRulesContainer } from '../../selected-rules/SelectedFeatureRulesContainer';
import { SecurityReviewFeatureTable } from '../../features/SecurityReviewFeatureTable';
import { SecurityFeaturePropertiesPanel } from '../../properties/SecurityFeaturePropertiesPanel';
import { SecurityReviewFeaturesTab } from './SecurityReviewFeaturesTab';
import { useSubmissionUploadFeatureSearch } from './useSubmissionUploadFeatureSearch';

const mocks = vi.hoisted(() => ({
  setSearchParams: vi.fn()
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
    render(
      <MemoryRouter>
        <SecurityReviewFeaturesTab
          submissionId={15}
          submissionUploadId="upload-id"
          submissionUploadReviewId="review-id"
          refreshRevision={0}
          onSecurityChanged={vi.fn()}
        />
      </MemoryRouter>
    );

    expect(useSubmissionUploadFeatureSearch).toHaveBeenCalledWith(15, 'upload-id', null, 0, 0);
  });
  it('refreshes feature locks after a rule toggle without refreshing or clearing the selected rules', () => {
    const onSecurityChanged = vi.fn();
    render(
      <MemoryRouter>
        <SecurityReviewFeaturesTab
          submissionId={15}
          submissionUploadId="upload-id"
          submissionUploadReviewId="review-id"
          refreshRevision={0}
          onSecurityChanged={onSecurityChanged}
        />
      </MemoryRouter>
    );
    act(() => vi.mocked(SecurityReviewFeatureTable).mock.lastCall![0].onSelectionChange([42]));
    act(() => vi.mocked(SelectedFeatureRulesContainer).mock.lastCall![0].onRuleChanged());
    expect(useSubmissionUploadFeatureSearch).toHaveBeenLastCalledWith(15, 'upload-id', null, 0, 1);
    expect(vi.mocked(SelectedFeatureRulesContainer).mock.lastCall![0].refreshRevision).toBe(0);
    expect(vi.mocked(SelectedFeatureRulesContainer).mock.lastCall![0].selectedFeatureIds).toEqual([42]);
    expect(onSecurityChanged).not.toHaveBeenCalled();
    expect(mocks.setSearchParams).not.toHaveBeenCalled();
  });

  it('keeps the property panel mounted from page load while switching features and visibility', () => {
    const { unmount } = render(
      <MemoryRouter>
        <SecurityReviewFeaturesTab
          submissionId={15}
          submissionUploadId="upload-id"
          submissionUploadReviewId="review-id"
          refreshRevision={0}
          onSecurityChanged={vi.fn()}
        />
      </MemoryRouter>
    );
    const panel = screen.getByTestId('focused-feature-properties');
    expect(panel).not.toBeVisible();
    expect(vi.mocked(SecurityFeaturePropertiesPanel).mock.lastCall![0].feature).toBeNull();
    const table = () => vi.mocked(SecurityReviewFeatureTable).mock.lastCall![0];
    const feature = {
      submission_feature_id: 42,
      feature_type_id: 1,
      feature_type_name: 'survey',
      parent_submission_feature_id: null,
      create_date: '2026-01-01',
      provenance: null
    };
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

  it('preserves selection, focused properties, and grid callbacks when security refreshes', () => {
    const props = {
      submissionId: 15,
      submissionUploadId: 'upload-id',
      submissionUploadReviewId: 'review-id',
      refreshRevision: 0,
      onSecurityChanged: vi.fn()
    };
    const { rerender } = render(
      <MemoryRouter>
        <SecurityReviewFeaturesTab {...props} />
      </MemoryRouter>
    );
    const table = () => vi.mocked(SecurityReviewFeatureTable).mock.lastCall![0];
    const feature = {
      submission_feature_id: 42,
      feature_type_id: 1,
      feature_type_name: 'survey',
      parent_submission_feature_id: null,
      create_date: '2026-01-01',
      provenance: null
    };
    act(() => table().onSelectionChange([42]));
    act(() => table().onOpenProperties(feature));
    const openProperties = table().onOpenProperties;
    const openSecurity = table().onOpenSecurity;

    rerender(
      <MemoryRouter>
        <SecurityReviewFeaturesTab {...props} refreshRevision={1} />
      </MemoryRouter>
    );

    expect(vi.mocked(SelectedFeatureRulesContainer).mock.lastCall![0].refreshRevision).toBe(1);
    expect(vi.mocked(SelectedFeatureRulesContainer).mock.lastCall![0].onChanged).toBe(props.onSecurityChanged);
    expect(vi.mocked(FeatureSecurityDialog).mock.lastCall![0].onChanged).toBe(props.onSecurityChanged);
    expect(table().selectedFeatureIds).toEqual([42]);
    expect(table().onOpenProperties).toBe(openProperties);
    expect(table().onOpenSecurity).toBe(openSecurity);
    expect(vi.mocked(SecurityFeaturePropertiesPanel).mock.lastCall![0].feature).toBe(feature);
    expect(screen.getByTestId('focused-feature-properties')).toBeVisible();
    expect(mocks.setSearchParams).not.toHaveBeenCalled();
  });
});
