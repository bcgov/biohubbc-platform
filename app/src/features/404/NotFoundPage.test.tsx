import { MemoryRouter } from 'react-router-dom';
import { fireEvent, render } from 'test-helpers/test-utils';
import { vi } from 'vitest';
import NotFoundPage from './NotFoundPage';

const mockedUsedNavigate = vi.fn();

beforeEach(() => {
  vi.mock('react-router', () => ({
    ...vi.importActual('react-router'),
    useNavigate: () => mockedUsedNavigate
  }));
});

describe('NotFoundPage', () => {
  it('renders correctly', () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/']}>
        <NotFoundPage />
      </MemoryRouter>
    );

    // Check if the "Page Not Found" text is rendered
    expect(getByText('Page Not Found')).toBeVisible();
  });

  it('takes the user home when they click the return home button', () => {
    const { getByText } = render(
      <MemoryRouter initialEntries={['/']}>
        <NotFoundPage />
      </MemoryRouter>
    );

    // Simulate clicking the "Return Home" button
    fireEvent.click(getByText('Return Home'));

    // Expect the navigate function to have been called with '/'
    expect(mockedUsedNavigate).toHaveBeenCalledWith('/');
  });
});
