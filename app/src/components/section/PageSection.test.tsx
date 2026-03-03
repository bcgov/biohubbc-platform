import { fireEvent } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { PageSection } from './PageSection';

describe('PageSection', () => {
  it('renders label and children', () => {
    const { getByText } = render(
      <PageSection id="policies" label="Policies" onAdd={vi.fn()}>
        <div>Section Content</div>
      </PageSection>
    );

    expect(getByText('Policies')).toBeVisible();
    expect(getByText('Section Content')).toBeVisible();
  });

  it('uses generated add button test id and calls onAdd', () => {
    const onAdd = vi.fn();
    const { getByTestId } = render(
      <PageSection id="assignments" label="Assignments" onAdd={onAdd}>
        <div>Content</div>
      </PageSection>
    );

    fireEvent.click(getByTestId('assignments-add-button'));

    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('always enables add button', () => {
    const { getByTestId } = render(
      <PageSection id="teams" label="Teams" onAdd={vi.fn()}>
        <div>Content</div>
      </PageSection>
    );

    expect(getByTestId('teams-add-button')).toBeEnabled();
  });

  it('renders headerContent beside add button', () => {
    const { getByPlaceholderText } = render(
      <PageSection id="teams" label="Teams" onAdd={vi.fn()} headerContent={<input placeholder="Search by team name" />}>
        <div>Content</div>
      </PageSection>
    );

    expect(getByPlaceholderText('Search by team name')).toBeVisible();
  });

  it('does not render add button when onAdd is not provided', () => {
    const { queryByTestId } = render(
      <PageSection id="teams" label="Teams">
        <div>Content</div>
      </PageSection>
    );

    expect(queryByTestId('teams-add-button')).toBeNull();
  });
});
