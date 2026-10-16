import { cleanup, fireEvent } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { vi } from 'vitest';
import { AdminPageLayout } from './AdminPageLayout';

describe('AdminPageLayout', () => {
  afterEach(() => {
    cleanup();
  });

  it('renders the breadcrumbs, title, subtitle, tabs and content', () => {
    const { getByRole, getByText } = render(
      <AdminPageLayout
        breadcrumbs={<span>Administration</span>}
        title="Tickets"
        subtitle="Browse tickets"
        tabs={[
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' }
        ]}
        activeTab="open"
        onTabChange={vi.fn()}>
        <div>Page content</div>
      </AdminPageLayout>
    );

    expect(getByText('Administration')).toBeVisible();
    expect(getByRole('heading', { level: 1, name: 'Tickets' })).toBeVisible();
    expect(getByText('Browse tickets')).toBeVisible();
    expect(getByRole('tab', { name: 'Open' })).toHaveAttribute('aria-selected', 'true');
    expect(getByRole('tab', { name: 'Closed' })).toHaveAttribute('aria-selected', 'false');
    expect(getByText('Page content')).toBeVisible();
  });

  it('reports the tab the user selects', () => {
    const onTabChange = vi.fn();

    const { getByRole } = render(
      <AdminPageLayout
        breadcrumbs={<span>Administration</span>}
        title="Tickets"
        tabs={[
          { value: 'open', label: 'Open' },
          { value: 'closed', label: 'Closed' }
        ]}
        activeTab="open"
        onTabChange={onTabChange}>
        <div>Page content</div>
      </AdminPageLayout>
    );

    fireEvent.click(getByRole('tab', { name: 'Closed' }));

    expect(onTabChange).toHaveBeenCalledWith('closed');
  });
});
