import { MemoryRouter, Routes } from 'react-router-dom';
import { render } from 'test-helpers/test-utils';
import RouteWithMeta from './RouteWithMeta';

describe('RouteWithMeta component', () => {
  it('should update the document title and meta description when the title and description props are provided', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <>
            <RouteWithMeta path="/" title="Test Title" description="Test Description" element={<div>Test</div>} />
          </>
        </Routes>
      </MemoryRouter>
    );

    // Assert that the document title was set correctly
    expect(document.title).toBe('Test Title');

    // Assert that the meta description was set correctly
    const metaDescription = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(metaDescription?.content).toBe('Test Description');
  });

  it('should update the document title and meta description when navigating to a new route', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <>
            <RouteWithMeta path="/" title="Home Page" description="Home Page Description" element={<div>Home</div>} />
            <RouteWithMeta
              path="/about"
              title="About Page"
              description="About Page Description"
              element={<div>About</div>}
            />
          </>
        </Routes>
      </MemoryRouter>
    );

    // Assert that the document title and meta description are set for the home route
    expect(document.title).toBe('Home Page');
    const metaDescriptionHome = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(metaDescriptionHome?.content).toBe('Home Page Description');

    // Simulate navigation to the "about" route
    window.history.pushState({}, '', '/about');

    // Assert that the document title and meta description are updated for the "about" route
    expect(document.title).toBe('About Page');
    const metaDescriptionAbout = document.querySelector('meta[name="description"]') as HTMLMetaElement;
    expect(metaDescriptionAbout?.content).toBe('About Page Description');
  });
});
