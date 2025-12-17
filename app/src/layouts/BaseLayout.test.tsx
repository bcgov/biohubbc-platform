import { AuthStateContext } from 'contexts/authStateContext';
import { MemoryRouter } from 'react-router';
import { getMockAuthState, SystemAdminAuthState } from 'test-helpers/auth-helpers';
import { render } from 'test-helpers/test-utils';
import BaseLayout from './BaseLayout';

describe.skip('BaseLayout', () => {
  it('renders correctly', () => {
    const authState = getMockAuthState({ base: SystemAdminAuthState });

    const { getByText } = render(
      <AuthStateContext.Provider value={authState}>
        <MemoryRouter initialEntries={['/']}>
          <BaseLayout>
            <div>
              <p>The public layout content</p>
            </div>
          </BaseLayout>
        </MemoryRouter>
      </AuthStateContext.Provider>
    );

    expect(
      getByText('This is an unsupported browser. Some functionality may not work as expected.')
    ).toBeInTheDocument();
    expect(getByText('The public layout content')).toBeInTheDocument();
  });
});
