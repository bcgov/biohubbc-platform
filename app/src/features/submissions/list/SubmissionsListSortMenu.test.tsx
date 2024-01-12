import { ThemeProvider } from '@mui/styles';
import { createTheme } from '@mui/system';
import { fireEvent, render } from '@testing-library/react';
import React from 'react';
import SubmissionsListSortMenu from './SubmissionsListSortMenu';

const mockHandleSubmissions = jest.fn();

const menuItems = { name: 'NAME', source_system: 'TEST' };

const first = { name: 'AAA', source_system: 'ZZZ' };
const second = { name: 'BBB', source_system: 'QQQ' };

const mockSubmissions: any[] = [first, second];

const renderMenu = () =>
  render(
    <ThemeProvider theme={createTheme()}>
      <SubmissionsListSortMenu
        submissions={mockSubmissions}
        handleSubmissions={mockHandleSubmissions}
        sortMenuItems={menuItems}
        apiSortSync={{ key: 'name', sort: 'asc' }}
      />
    </ThemeProvider>
  );

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
    const menuItemB = actions.getByText('TEST');

    expect(menuItemA).toBeVisible();
    expect(menuItemB).toBeVisible();
  });

  it('clicking menu item calls handler function', async () => {
    const actions = renderMenu();
    const menuBtn = actions.getByRole('button', { name: 'Sort By' });

    fireEvent.click(menuBtn);

    const menuItemA = actions.getByText('NAME');
    const menuItemB = actions.getByText('TEST');

    fireEvent.click(menuItemA);
    fireEvent.click(menuItemB);

    expect(mockHandleSubmissions).toHaveBeenCalledTimes(2);
  });

  it('clicking menu item will sort submissions', async () => {
    const actions = renderMenu();
    const menuBtn = actions.getByRole('button', { name: 'Sort By' });

    fireEvent.click(menuBtn);

    const menuItemA = actions.getByText('NAME');

    fireEvent.click(menuItemA);
    expect(mockHandleSubmissions.mock.calls[0][0]).toStrictEqual([second, first]);

    fireEvent.click(menuItemA);
    expect(mockHandleSubmissions.mock.calls[1][0]).toStrictEqual([first, second]);
  });
});
