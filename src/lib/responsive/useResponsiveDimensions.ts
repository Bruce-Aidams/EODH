import { Dimensions, useWindowDimensions } from 'react-native';

/**
 * Standard mobile screen breakpoints (width in points).
 * Based on common device sizes:
 * - Small: iPhone SE (320pt), small Android phones
 * - Medium: iPhone 12/13/14 (390pt), most Android phones
 * - Large: iPhone Plus/Pro Max (428pt), large Android phones
 * - XL: Tablets and foldables (600pt+)
 */
export const BREAKPOINTS = {
  small: 360,
  medium: 390,
  large: 428,
  xl: 600,
} as const;

/**
 * Get the current screen width.
 */
export function getScreenWidth() {
  return Dimensions.get('window').width;
}

/**
 * Get the current screen height.
 */
export function getScreenHeight() {
  return Dimensions.get('window').height;
}

/**
 * Determine the screen size category based on current width.
 */
export function getScreenSize(): 'small' | 'medium' | 'large' | 'xl' {
  const width = getScreenWidth();
  if (width >= BREAKPOINTS.xl) return 'xl';
  if (width >= BREAKPOINTS.large) return 'large';
  if (width >= BREAKPOINTS.medium) return 'medium';
  return 'small';
}

/**
 * Check if the current screen is a tablet (width >= 600pt).
 */
export function isTablet() {
  return getScreenWidth() >= BREAKPOINTS.xl;
}

/**
 * Responsive scaling factor based on a reference width (default: 390pt — standard phone).
 * Values scale proportionally so layouts look consistent across screen sizes.
 */
export function scale(value: number, referenceWidth = 390) {
  const screenWidth = getScreenWidth();
  return value * (screenWidth / referenceWidth);
}

/**
 * Responsive font size that scales within a reasonable range.
 * Prevents fonts from becoming too small on small screens or too large on large screens.
 */
export function scaleFont(fontSize: number, referenceWidth = 390) {
  const screenWidth = getScreenWidth();
  const scaled = fontSize * (screenWidth / referenceWidth);
  // Clamp between 90% and 130% of original size
  const min = fontSize * 0.9;
  const max = fontSize * 1.3;
  return Math.round(Math.min(Math.max(scaled, min), max));
}

/**
 * Hook that returns responsive layout dimensions that update on screen rotation.
 * Provides pre-calculated values for common UI elements:
 * - bookCardWidth: width for book cards in horizontal scroll
 * - bookCardCompactWidth: width for compact book cards in grids
 * - bookCoverHeight: height for book covers (1.4 aspect ratio)
 * - bookCoverCompactHeight: height for compact book covers
 * - gridColumns: number of columns for grid layouts
 * - listItemCoverWidth: width for list item covers
 * - listItemCoverHeight: height for list item covers
 */
export function useResponsiveDimensions() {
  const { width } = useWindowDimensions();
  const padding = 16; // SPACING.md — total horizontal padding

  const usableWidth = width - padding * 2;

  // Horizontal scroll card widths — adapt to screen size
  const bookCardWidth = width < 360 ? 130 : width < 428 ? 150 : 160;
  const bookCardCompactWidth = width < 360 ? 120 : width < 428 ? 130 : 140;

  // Cover heights maintain 1.4 aspect ratio
  const bookCoverHeight = bookCardWidth * 1.4;
  const bookCoverCompactHeight = bookCardCompactWidth * 1.4;

  // Grid columns — how many compact cards fit in a row
  const gridColumns = width < 340 ? 2 : width < 428 ? 2 : 3;

  // List item cover sizes
  const listItemCoverWidth = width < 360 ? 50 : 60;
  const listItemCoverHeight = listItemCoverWidth * (80 / 60);

  // Library list cover (smaller, for list items)
  const listCoverWidth = width < 360 ? 50 : 60;
  const listCoverHeight = listCoverWidth * (80 / 60);

  return {
    width,
    usableWidth,
    bookCardWidth,
    bookCardCompactWidth,
    bookCoverHeight,
    bookCoverCompactHeight,
    gridColumns,
    listItemCoverWidth,
    listItemCoverHeight,
    listCoverWidth,
    listCoverHeight,
    isSmall: width < BREAKPOINTS.medium,
    isLarge: width >= BREAKPOINTS.large,
    isTablet: width >= BREAKPOINTS.xl,
  };
}
