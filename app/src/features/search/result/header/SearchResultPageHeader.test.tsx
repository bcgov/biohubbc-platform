import { tabsClasses } from '@mui/material/Tabs';
import { fireEvent, within } from '@testing-library/react';
import { render } from 'test-helpers/test-utils';
import { SearchResultPageHeader } from './SearchResultPageHeader';

vi.mock('./SearchResultSearch', () => ({
  SearchResultSearch: () => <div data-testid="search-result-search" />
}));

const featureTypeLinks = [
  { value: 'species_observation', label: 'Observations', to: '/search/species_observation' },
  { value: 'wetland_plot', label: 'Wetland Plot', to: '/search/wetland_plot' },
  { value: 'camera_deployment', label: 'Camera Deployment', to: '/search/camera_deployment' }
];

/**
 * Renders the result page header for the observation results.
 *
 * @param {React.ReactNode} [tabsEndContent] - Optional content at the end of the tab row.
 * @returns The rendered header and the feature-type change callback.
 */
const renderHeader = (tabsEndContent?: React.ReactNode) => {
  const onFeatureTypeChange = vi.fn();
  const view = render(
    <SearchResultPageHeader
      activeFeatureType="species_observation"
      featureTypeLinks={featureTypeLinks}
      searchTerm=""
      expressionTree={null}
      onExpressionApply={vi.fn()}
      onFeatureTypeChange={onFeatureTypeChange}
      tabsEndContent={tabsEndContent}
    />
  );

  return { ...view, onFeatureTypeChange };
};

/**
 * Finds the MUI scroller that holds the feature-type tabs and carries the fade.
 *
 * @param {HTMLElement} tabsContainer - Element that wraps the feature-type tabs.
 * @returns {HTMLElement} The tab scroller element.
 */
const getFeatureTypeTabsScroller = (tabsContainer: HTMLElement) =>
  tabsContainer.querySelector<HTMLElement>(`.${tabsClasses.scroller}`)!;

/**
 * Lays out the feature-type tab scroller, then scrolls it so the header re-measures the fades.
 *
 * @param {HTMLElement} tabsContainer - Element that wraps the feature-type tabs.
 * @param {object} layout - Scroller offset and widths, in pixels.
 * @returns {string} The scroller's mask image after the scroll.
 */
const scrollFeatureTypeTabs = (
  tabsContainer: HTMLElement,
  layout: {
    scrollLeft: number;
    clientWidth: number;
    scrollWidth: number;
  }
) => {
  const scroller = getFeatureTypeTabsScroller(tabsContainer);

  Object.defineProperty(scroller, 'clientWidth', { configurable: true, value: layout.clientWidth });
  Object.defineProperty(scroller, 'scrollWidth', { configurable: true, value: layout.scrollWidth });
  scroller.scrollLeft = layout.scrollLeft;

  fireEvent.scroll(scroller);

  return getComputedStyle(scroller).maskImage;
};

describe('SearchResultPageHeader', () => {
  it('shows a scrollable tab for every feature type and opens the one selected', () => {
    const { getByRole, onFeatureTypeChange } = renderHeader();

    const tablist = getByRole('tablist', { name: 'Search feature types' });
    expect(
      within(tablist)
        .getAllByRole('tab')
        .map((tab) => tab.textContent)
    ).toEqual(['Observations', 'Wetland Plot', 'Camera Deployment']);
    expect(getByRole('tab', { name: 'Observations' })).toHaveAttribute('aria-selected', 'true');
    expect(tablist.closest('.MuiTabs-scroller')).toHaveClass('MuiTabs-scrollableX');

    fireEvent.click(getByRole('tab', { name: 'Camera Deployment' }));

    expect(onFeatureTypeChange).toHaveBeenCalledWith('camera_deployment');
  });

  it('sets end content apart from the feature-type tabs with a vertical divider', () => {
    const { getByRole, getByText } = renderHeader(<span>End content</span>);

    expect(getByText('End content')).toBeVisible();
    expect(getByRole('separator')).toHaveAttribute('aria-orientation', 'vertical');
  });

  it('shows no divider without end content', () => {
    const { queryByRole } = renderHeader();

    expect(queryByRole('separator')).not.toBeInTheDocument();
  });

  describe('selected feature-type tab', () => {
    /**
     * Opens a feature type whose tab sits at the given bounds of a 500px-wide scroller scrolled 100px in.
     *
     * @param {number} selectedTabLeft - Left edge of the newly selected tab, in pixels.
     * @param {number} selectedTabRight - Right edge of the newly selected tab, in pixels.
     * @returns {HTMLElement} The tab scroller element.
     */
    const selectFeatureTypeAt = (selectedTabLeft: number, selectedTabRight: number) => {
      const { getByRole, getByTestId, rerender } = renderHeader();
      const scroller = getFeatureTypeTabsScroller(getByTestId('search-feature-type-tabs'));

      scroller.scrollLeft = 100;
      vi.spyOn(scroller, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 500, 48));
      vi.spyOn(getByRole('tab', { name: 'Wetland Plot' }), 'getBoundingClientRect').mockReturnValue(
        new DOMRect(selectedTabLeft, 0, selectedTabRight - selectedTabLeft, 48)
      );

      rerender(
        <SearchResultPageHeader
          activeFeatureType="wetland_plot"
          featureTypeLinks={featureTypeLinks}
          searchTerm=""
          expressionTree={null}
          onExpressionApply={vi.fn()}
          onFeatureTypeChange={vi.fn()}
        />
      );

      return scroller;
    };

    it.each([
      {
        description: 'clear of the right fade and arrow',
        selectedTabLeft: 380,
        selectedTabRight: 500,
        scrollLeft: 196
      },
      { description: 'clear of the left fade and arrow', selectedTabLeft: 0, selectedTabRight: 120, scrollLeft: 4 },
      { description: 'in place while clear of both ends', selectedTabLeft: 200, selectedTabRight: 320, scrollLeft: 100 }
    ])('scrolls the selected tab $description', ({ selectedTabLeft, selectedTabRight, scrollLeft }) => {
      expect(selectFeatureTypeAt(selectedTabLeft, selectedTabRight).scrollLeft).toBe(scrollLeft);
    });
  });

  describe('feature-type tab fades', () => {
    it.each([
      {
        description: 'only the right edge at the start of the row',
        scrollLeft: 0,
        scrollWidth: 900,
        maskImage: 'linear-gradient(to right, #000, #000 calc(100% - 96px), transparent)'
      },
      {
        description: 'both edges in the middle of the row',
        scrollLeft: 200,
        scrollWidth: 900,
        maskImage: 'linear-gradient(to right, transparent, #000 96px, #000 calc(100% - 96px), transparent)'
      },
      {
        description: 'only the left edge at the end of the row',
        scrollLeft: 400,
        scrollWidth: 900,
        maskImage: 'linear-gradient(to right, transparent, #000 96px, #000)'
      },
      { description: 'neither edge while every tab fits', scrollLeft: 0, scrollWidth: 500, maskImage: '' }
    ])('fades $description', ({ scrollLeft, scrollWidth, maskImage }) => {
      const { getByTestId } = renderHeader();

      expect(
        scrollFeatureTypeTabs(getByTestId('search-feature-type-tabs'), { scrollLeft, clientWidth: 500, scrollWidth })
      ).toBe(maskImage);
    });
  });
});
