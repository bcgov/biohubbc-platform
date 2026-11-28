import { touchRippleClasses } from '@mui/material/ButtonBase';
import { SxProps, Theme } from '@mui/material/styles';
import { tabClasses } from '@mui/material/Tab';
import { tabScrollButtonClasses } from '@mui/material/TabScrollButton';
import { tabsClasses } from '@mui/material/Tabs';

// Width of each feature-type scroll arrow, which overlays an end of the row.
const FEATURE_TYPE_TABS_SCROLL_BUTTON_WIDTH = 40;

// Size of the rounded hover and press highlight behind each arrow: the small arrow icon plus 8px of padding around it.
const FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SIZE = 36;

// Width of the fade at each end of the row that hints at tabs scrolled out of view. It runs out from under the arrow.
const FEATURE_TYPE_TABS_FADE_WIDTH = 96;

// Centres the arrow's hover highlight and click ripple around its icon.
const FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SX = {
  position: 'absolute',
  top: '50%',
  left: '50%',
  right: 'auto',
  bottom: 'auto',
  width: FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SIZE,
  height: FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SIZE,
  transform: 'translate(-50%, -50%)',
  borderRadius: 1
} as const;

/**
 * Builds the mask that fades out each end of the feature-type row that has tabs scrolled out of view past it.
 *
 * @param {boolean} hasTabsToLeft - Whether tabs are scrolled out of view past the left edge.
 * @param {boolean} hasTabsToRight - Whether tabs are scrolled out of view past the right edge.
 * @returns {string | undefined} The CSS mask image, or `undefined` when every tab is in view.
 */
export const getFeatureTypeTabsMask = (hasTabsToLeft: boolean, hasTabsToRight: boolean): string | undefined => {
  if (!hasTabsToLeft && !hasTabsToRight) {
    return undefined;
  }

  const leftStops = hasTabsToLeft ? `transparent, #000 ${FEATURE_TYPE_TABS_FADE_WIDTH}px` : '#000';
  const rightStops = hasTabsToRight ? `#000 calc(100% - ${FEATURE_TYPE_TABS_FADE_WIDTH}px), transparent` : '#000';

  return `linear-gradient(to right, ${leftStops}, ${rightStops})`;
};

/**
 * Scrolls the selected feature-type tab clear of the fades and scroll arrows at the ends of the row. MUI only scrolls
 * the selected tab flush with the edge of the row, which would leave it under an arrow. The browser clamps the scroll
 * offset, so the first and last tabs still sit at the edges, where there is nothing to fade and their arrow is hidden.
 *
 * @param {HTMLElement} scroller - MUI scroller that holds the feature-type tabs.
 */
export const revealSelectedFeatureTypeTab = (scroller: HTMLElement) => {
  const selectedTabRect = scroller.querySelector('[aria-selected="true"]')?.getBoundingClientRect();

  if (!selectedTabRect) {
    return;
  }

  const scrollerRect = scroller.getBoundingClientRect();
  const clearLeft = scrollerRect.left + FEATURE_TYPE_TABS_FADE_WIDTH;
  const clearRight = scrollerRect.right - FEATURE_TYPE_TABS_FADE_WIDTH;

  if (selectedTabRect.left < clearLeft) {
    scroller.scrollLeft -= clearLeft - selectedTabRect.left;
  } else if (selectedTabRect.right > clearRight) {
    scroller.scrollLeft += selectedTabRect.right - clearRight;
  }
};

/**
 * Builds the styles of the feature-type tab row.
 *
 * The arrows overlay the ends of the row rather than taking space beside it, so the first tab lines up with the content
 * above and the scroller keeps its width as the arrows appear. MUI hides each arrow while its end of the row is reached.
 *
 * @param {string | undefined} mask - Fade mask from `getFeatureTypeTabsMask`, or `undefined` when every tab is in view.
 * @returns {SxProps<Theme>} The tab row's styles.
 */
export const buildFeatureTypeTabsSx = (mask: string | undefined): SxProps<Theme> => ({
  position: 'relative',
  [`& .${tabsClasses.scrollButtons}`]: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    zIndex: 1,
    width: FEATURE_TYPE_TABS_SCROLL_BUTTON_WIDTH,
    // MUI draws the arrows at 80% opacity, which would show the tabs beneath them through the background.
    opacity: 1,
    color: 'text.secondary',
    bgcolor: 'background.paper',
    transition: (theme) => theme.transitions.create(['opacity', 'color']),
    // The highlight is a rounded shape around the icon, while the arrow's opaque background still covers the tabs.
    '&::before': {
      ...FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SX,
      content: '""',
      transition: (theme) => theme.transitions.create('background-color')
    },
    '&:hover': { color: 'text.primary' },
    '&:hover::before': { bgcolor: 'grey.100' },
    '&:active::before': { bgcolor: 'grey.200' },
    // Positioned after the highlight, so the icon paints above it.
    '& svg': { position: 'relative' },
    [`& .${touchRippleClasses.root}`]: FEATURE_TYPE_TABS_SCROLL_BUTTON_HIGHLIGHT_SX,
    [`&.${tabScrollButtonClasses.disabled}`]: { opacity: 0 }
  },
  [`& .${tabsClasses.scrollButtons}:first-child`]: { left: 0 },
  [`& .${tabsClasses.scrollButtons}:last-child`]: { right: 0 },
  // The fade masks only the scrolling tabs, so the scroll arrows over them stay fully visible.
  [`& .${tabsClasses.scroller}`]: { maskImage: mask, WebkitMaskImage: mask },
  // MUI gives every tab a 90px minimum width; these tabs size to their labels instead.
  [`& .${tabClasses.root}`]: { minWidth: 0 }
});
