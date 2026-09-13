let activeBannerColorOverride: string | null = null;
let currentAppliedThemeColor: string = '';

const DEFAULT_LIGHT_THEME_COLOR = '#F9F6F2';
const DEFAULT_DARK_THEME_COLOR = '#000000';

/**
 * Converts rgb/rgba string or hex string to normalized uppercase hex string (#RRGGBB).
 */
function normalizeColor(colorStr: string): string {
  if (!colorStr) return '';
  const trimmed = colorStr.trim();
  if (trimmed.startsWith('#')) {
    return trimmed.length === 4
      ? `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toUpperCase()
      : trimmed.toUpperCase();
  }
  const match = trimmed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (match) {
    const r = parseInt(match[1], 10).toString(16).padStart(2, '0');
    const g = parseInt(match[2], 10).toString(16).padStart(2, '0');
    const b = parseInt(match[3], 10).toString(16).padStart(2, '0');
    return `#${r}${g}${b}`.toUpperCase();
  }
  return trimmed;
}

/**
 * Updates the single <meta name="theme-color"> tag in document.head.
 * Reuses the existing meta tag if present, updates only the `content` attribute,
 * and avoids duplicate tags or unnecessary DOM writes.
 */
export function updateBrowserThemeColor(overrideColor?: string | null) {
  if (overrideColor !== undefined) {
    activeBannerColorOverride = overrideColor;
  }

  if (typeof document === 'undefined') return;

  const isDark = document.documentElement.classList.contains('dark');
  const defaultBg = isDark ? DEFAULT_DARK_THEME_COLOR : DEFAULT_LIGHT_THEME_COLOR;

  const rawColor = activeBannerColorOverride ? activeBannerColorOverride : defaultBg;
  const targetColor = normalizeColor(rawColor) || defaultBg;

  // Check if an existing single meta tag is already present and matches targetColor exactly
  const existingMetas = Array.from(document.querySelectorAll('meta[name="theme-color"]'));
  const firstMeta = existingMetas[0];

  if (
    currentAppliedThemeColor === targetColor &&
    existingMetas.length === 1 &&
    firstMeta &&
    firstMeta.getAttribute('content') === targetColor &&
    !firstMeta.hasAttribute('media')
  ) {
    return;
  }

  // Remove all existing theme-color meta tags (including stale media-query tags)
  existingMetas.forEach((m) => m.remove());

  // Create a clean new <meta name="theme-color"> and append to document.head.
  // Replacing the DOM node forces Mobile Chromium (Chrome, Edge, Brave), Samsung Internet,
  // and installed PWAs to immediately fire DidChangeThemeColor in the browser compositor.
  const meta = document.createElement('meta');
  meta.name = 'theme-color';
  meta.content = targetColor;
  document.head.appendChild(meta);

  currentAppliedThemeColor = targetColor;
}

/**
 * Sets the active banner color override (or null if no banner active)
 * and refreshes the browser theme color.
 */
export function setBannerThemeColor(color: string | null) {
  updateBrowserThemeColor(color);
}

/**
 * Gets the current effective theme color.
 */
export function getEffectiveThemeColor(): string {
  const isDark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark');
  return activeBannerColorOverride
    ? normalizeColor(activeBannerColorOverride)
    : (isDark ? DEFAULT_DARK_THEME_COLOR : DEFAULT_LIGHT_THEME_COLOR);
}

/**
 * Initializes listeners for dark mode class mutations on <html>
 * so that whenever the theme class changes or navigation occurs,
 * the theme color is kept synchronized.
 */
export function initThemeColorObserver() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};

  updateBrowserThemeColor();

  // MutationObserver to catch any class change on <html class="dark">
  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.attributeName === 'class') {
        updateBrowserThemeColor();
      }
    }
  });

  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class'],
  });

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleMediaChange = () => {
    updateBrowserThemeColor();
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleMediaChange);
  } else if ('addListener' in mediaQuery) {
    (mediaQuery as any).addListener(handleMediaChange);
  }

  return () => {
    observer.disconnect();
    if (mediaQuery.removeEventListener) {
      mediaQuery.removeEventListener('change', handleMediaChange);
    } else if ('removeListener' in mediaQuery) {
      (mediaQuery as any).removeListener(handleMediaChange);
    }
  };
}
