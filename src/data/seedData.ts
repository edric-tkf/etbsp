import type {
  BibleTranslation,
  DisplaySettings,
  PresentationState,
  Song,
  ThemeSettings,
  UserPreferences,
} from '../types/models';

export const APP_NAME = 'ET BSP';
export const APP_VERSION = '1.1.0';

export const DEFAULT_DISPLAY_SETTINGS: DisplaySettings = {
  outputResolution: '1920x1080',
  transparentBackground: false,
  backgroundType: 'solid',
  solidColor: '#0b245b',
  gradientFrom: '#0b245b',
  gradientTo: '#060c1f',
  gradientAngle: 155,
  backgroundImageUrl: '',
  backgroundVideoUrl: '',
  backgroundOpacity: 1,
  transition: 'fade',
  transitionDurationMs: 320,
  fontFamily: 'Plus Jakarta Sans',
  fullscreenFontSizePx: 64,
  lowerThirdFontSizePx: 42,
  fontSizeScale: 1,
  wordSpacingPx: 0,
  lineHeight: 1.25,
  songLineGapPx: 16,
  textAlign: 'center',
  textColor: '#ffffff',
  textShadow: true,
  safeMarginPercent: 6,
  bibleReferenceBgColor: '#facc15',
  bibleReferenceTextColor: '#11141a',
  bibleReferenceRounded: true,
  showBibleReferenceLabel: true,
  lowerThirdPosition: 'bottom',
  lowerThirdHeightPercent: 28,
  lowerThirdShowBackground: true,
  lowerThirdBgColor: '#0b142a',
  lowerThirdOpacity: 0.9,
  lowerThirdBlur: true,
  defaultBibleBackgroundColor: '#0b245b',
  defaultSongBackgroundColor: '#0d1017',
};

export function normalizeDisplaySettings(
  raw?: Partial<DisplaySettings> | null
): DisplaySettings {
  const merged: DisplaySettings = {
    ...DEFAULT_DISPLAY_SETTINGS,
    ...(raw || {}),
  };
  const legacyScale =
    typeof raw?.fontSizeScale === 'number' &&
    Number.isFinite(raw.fontSizeScale) &&
    raw.fontSizeScale > 0
      ? raw.fontSizeScale
      : 1;

  if (
    typeof raw?.fullscreenFontSizePx !== 'number' ||
    !Number.isFinite(raw.fullscreenFontSizePx) ||
    raw.fullscreenFontSizePx <= 0
  ) {
    merged.fullscreenFontSizePx = Math.round(
      DEFAULT_DISPLAY_SETTINGS.fullscreenFontSizePx * legacyScale
    );
  }
  if (
    typeof raw?.lowerThirdFontSizePx !== 'number' ||
    !Number.isFinite(raw.lowerThirdFontSizePx) ||
    raw.lowerThirdFontSizePx <= 0
  ) {
    merged.lowerThirdFontSizePx = Math.round(
      DEFAULT_DISPLAY_SETTINGS.lowerThirdFontSizePx * legacyScale
    );
  }
  return merged;
}

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  id: 'theme-sanctuary-blue',
  name: 'Classic Sanctuary Blue',
  accentColor: 'blue',
  density: 'compact',
  preset: 'sanctuary-blue',
};

export const THEME_PRESETS: Array<{
  preset: ThemeSettings['preset'];
  name: string;
  description: string;
  displayPatch: Partial<DisplaySettings>;
}> = [
  {
    preset: 'sanctuary-blue',
    name: 'Classic Sanctuary Blue',
    description: 'Deep blue canvas with bold yellow reference label and crisp white type.',
    displayPatch: {
      backgroundType: 'solid',
      solidColor: '#0b245b',
      defaultBibleBackgroundColor: '#0b245b',
      defaultSongBackgroundColor: '#0d1017',
      bibleReferenceBgColor: '#facc15',
      bibleReferenceTextColor: '#11141a',
      textColor: '#ffffff',
      transparentBackground: false,
    },
  },
  {
    preset: 'warm-obsidian',
    name: 'Warm Obsidian Stage',
    description: 'Atmospheric dark gradient suited for worship lyric projection.',
    displayPatch: {
      backgroundType: 'gradient',
      gradientFrom: '#161b26',
      gradientTo: '#090b10',
      gradientAngle: 160,
      defaultBibleBackgroundColor: '#102145',
      defaultSongBackgroundColor: '#0b0d12',
      bibleReferenceBgColor: '#f59e0b',
      bibleReferenceTextColor: '#11141a',
      textColor: '#f8fafc',
      transparentBackground: false,
    },
  },
  {
    preset: 'broadcast-lower-third',
    name: 'Broadcast Lower-Third',
    description: 'High-legibility slate overlay tailored for live stream camera feeds.',
    displayPatch: {
      lowerThirdHeightPercent: 26,
      lowerThirdOpacity: 0.92,
      lowerThirdBlur: true,
      bibleReferenceBgColor: '#facc15',
      bibleReferenceTextColor: '#11141a',
      textColor: '#ffffff',
    },
  },
  {
    preset: 'transparent-obs',
    name: 'Transparent OBS Overlay',
    description: 'Alpha-channel transparent canvas for direct OBS Browser Source compositing.',
    displayPatch: {
      transparentBackground: true,
      backgroundType: 'transparent',
      textShadow: true,
      textColor: '#ffffff',
      bibleReferenceBgColor: '#facc15',
      bibleReferenceTextColor: '#11141a',
    },
  },
  {
    preset: 'high-contrast',
    name: 'High Contrast Accessibility',
    description: 'Pure black backdrop with amplified typography scale and strong shadows.',
    displayPatch: {
      backgroundType: 'solid',
      solidColor: '#000000',
      defaultBibleBackgroundColor: '#000000',
      defaultSongBackgroundColor: '#000000',
      textColor: '#ffffff',
      fullscreenFontSizePx: 74,
      lowerThirdFontSizePx: 48,
      textShadow: true,
      transparentBackground: false,
    },
  },
];

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  language: 'en',
  sidebarWidth: 250,
  quickActionsOpen: true,
  defaultTranslationId: '',
  updateRepoUrl: '',
  shortcuts: {
    prevSlide: 'ArrowLeft',
    nextSlide: 'ArrowRight',
    projectLive: 'Enter',
    clearOutput: 'Escape',
    openBible: '1',
    openSongs: '2',
    openSettings: 'Comma',
    toggleLowerThird: 'l',
    toggleFullscreen: 'f',
    toggleQuickActions: 'q',
    focusSearch: '/',
  },
};

export const INITIAL_PRESENTATION_STATE: PresentationState = {
  isLive: false,
  activeType: 'none',
  bibleDisplayMode: 'fullscreen',
  updatedAt: Date.now(),
  revision: 0,
};

// No placeholder Bible translations or songs
export const SEED_BIBLE_TRANSLATIONS: BibleTranslation[] = [];
export const SEED_SONGS: Song[] = [];
