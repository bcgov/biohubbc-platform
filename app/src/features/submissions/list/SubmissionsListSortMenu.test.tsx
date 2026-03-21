import { ThemeProvider } from '@mui/material/styles';
import { fireEvent, waitFor } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import appTheme from 'themes/appTheme';
import SubmissionsListSortMenu from './SubmissionsListSortMenu';

const mockHandleSubmissions = vi.fn();

const menuItems = { name: 'NAME', contributor_id: 'CONTRIBUTOR' };

const first = { name: 'AAA', contributor_id: 2 };
const second = { name: 'BBB', contributor_id: 1 };

const mockSubmissions: any[] = [first, second];

const renderMenu = () =>
  render(
    <ThemeProvider theme={appTheme}>
      <SubmissionsListSortMenu
        submissions={mockSubmissions}
        handleSubmissions={mockHandleSubmissions}
        sortMenuItems={menuItems}
        apiSortSync={{ key: 'name', sort: 'asc' }}
      />
    </ThemeProvider>
  );

// Clear mock calls before each test to avoid call count pollution across tests
beforeEach(() => {
  mockHandleSubmissions.mockClear();
});

describe('SubmissionsListSortMenu', () => {
  it('renders the menu button correctly', async () => {
    const actions = renderMenu();
    const menuBtn = actions.getByRole('button', { name: 'Sort By' });

    expect(menuBtn).toBeVisible();
  });

  it('renders the menu items correctly', async () => {
    const actions = renderMenu();
    const menuBtn = actions.getByRole('button', { name: 'Sort By' });

    fireEvent.click(menuBtn);

    const menuItemA = actions.getByText('NAME');
    const menuItemB = actions.getByText('CONTRIBUTOR');

    expect(menuItemA).toBeVisible();
    expect(menuItemB).toBeVisible();
  });

  it('clicking menu item calls handler function', async () => {
    const actions = renderMenu();
    const menuBtn = actions.getByRole('button', { name: 'Sort By' });

    fireEvent.click(menuBtn);

    const menuItemA = actions.getByText('NAME');
    const menuItemB = actions.getByText('CONTRIBUTOR');

    fireEvent.click(menuItemA);
    fireEvent.click(menuItemB);

    expect(mockHandleSubmissions).toHaveBeenCalledTimes(2);
  });

  it('clicking menu item will sort submissions', async () => {
    const actions = renderMenu();
    const menuBtn = actions.getByRole('button', { name: 'Sort By' });

    fireEvent.click(menuBtn);

    // Use findByText to wait for item to be available
    const menuItemA = await actions.findByText('NAME');

    fireEvent.click(menuItemA);

    await waitFor(() => {
      expect(mockHandleSubmissions).toHaveBeenCalledTimes(1);
      expect(mockHandleSubmissions.mock.calls[0][0]).toStrictEqual([second, first]);
    });

    // Click again to toggle sort order back
    fireEvent.click(menuBtn);
    const menuItemA2 = await actions.findByText('NAME');
    fireEvent.click(menuItemA2);

    await waitFor(() => {
      expect(mockHandleSubmissions).toHaveBeenCalledTimes(2);
      expect(mockHandleSubmissions.mock.calls[1][0]).toStrictEqual([first, second]);
    });
  });
});
