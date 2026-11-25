export type MainTab = 'bible' | 'songs';

export type BibleDisplayMode = 'fullscreen' | 'lower-third';

export type LowerThirdPosition = 'top' | 'bottom';

export type BackgroundType = 'solid' | 'gradient' | 'image' | 'video' | 'transparent';

export type TransitionType = 'fade' | 'zoom' | 'cut' | 'slide';

export type TextAlignMode = 'left' | 'center' | 'right';

export type SongSectionType =
  | 'verse'
  | 'chorus'
  | 'pre-chorus'
  | 'bridge'
  | 'intro'
  | 'outro'
  | 'tag'
  | 'ending'
  | 'other';

export interface BibleVerse {
  number: number;
  text: string;
}

export interface BibleChapter {
  number: number;
  verses: BibleVerse[];
}

export interface BibleBook {
  name: string;
  order?: number;
  chapters: BibleChapter[];
}

export interface BibleTranslation {
  id: string;
  name: string;
  abbreviation: string;
  language: string;
  isUserImported?: boolean;
  importedAt?: string;
  description?: string;
  books: BibleBook[];
}

export interface SongSection {
  id: string;
  type: SongSectionType;
  title: string;
  lyrics: string[];
  timestamps?: Array<number | undefined>;
}

export interface SongSlide {
  id: string;
  songId: string;
  sectionId: string;
  sectionTitle: string;
  sectionType: SongSectionType;
  lines: string[]; // Strictly 1 or 2 lines (never > 2 lines)
  slideIndex: number;
  totalSlides: number;
  timestamp?: number;
}

export interface Song {
  id: string;
  title: string;
  artist?: string;
  author?: string;
  language?: string;
  copyright?: string;
  rawText?: string;
  sections: SongSection[];
  songbookDocId?: string;
  lastSyncedHash?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EtOAuthUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  token?: string;
  [key: string]: unknown;
}

export interface SongbookDocument {
  id: string;
  title: string;
  artists: string;
  lyrics: string;
  classification?: string;
}

export interface SongMergeConflict {
  key: string;
  title: string;
  localSong: Song;
  remoteDoc: SongbookDocument;
}

export interface CustomFont {
  id: string;
  name: string;
  dataUrl: string;
  format?: string;
  createdAt?: string;
}

export interface BibleSlidePayload {
  translationId: string;
  translationAbbr: string;
  translationName: string;
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface SongSlidePayload {
  songId: string;
  songTitle: string;
  songArtist?: string;
  sectionId: string;
  sectionTitle: string;
  sectionType: SongSectionType;
  lines: string[]; // Strictly max 2 lyric lines
  slideIndex: number;
  totalSlides: number;
  timestamp?: number;
}

export interface PresentationState {
  isLive: boolean;
  activeType: 'none' | 'bible' | 'song';
  bibleDisplayMode: BibleDisplayMode;
  bible?: BibleSlidePayload;
  song?: SongSlidePayload;
  updatedAt: number;
  revision: number;
}

export interface DisplaySettings {
  outputResolution: '1920x1080' | '1280x720' | '3840x2160';
  transparentBackground: boolean;
  backgroundType: BackgroundType;
  solidColor: string;
  gradientFrom: string;
  gradientTo: string;
  gradientAngle: number;
  backgroundImageUrl: string;
  backgroundVideoUrl: string;
  backgroundOpacity: number; // 0 to 1
  transition: TransitionType;
  transitionDurationMs: number;
  fontFamily: string;
  fullscreenFontSizePx: number; // Fixed px font size for Full-Screen (Bible & Song)
  lowerThirdFontSizePx: number; // Fixed px font size for Lower-Third (Bible & Song)
  fontSizeScale?: number; // Deprecated legacy scale retained for backward compatibility
  wordSpacingPx: number; // -4 to 24
  lineHeight: number; // 0.95 to 2.2
  songLineGapPx: number; // 0 to 64
  textPaddingLeftPx: number; // 0 to 400
  textPaddingRightPx: number; // 0 to 400
  textAlign: TextAlignMode;
  textColor: string;
  textShadow: boolean;
  safeMarginPercent: number; // 0 to 15
  bibleReferenceBgColor: string;
  bibleReferenceTextColor: string;
  bibleReferenceRounded: boolean;
  showBibleReferenceLabel: boolean;
  lowerThirdPosition: LowerThirdPosition;
  lowerThirdHeightPercent: number; // 1 to 50
  lowerThirdShowBackground: boolean;
  lowerThirdBgColor: string;
  lowerThirdOpacity: number; // 0 to 1
  lowerThirdBlur: boolean;
  defaultBibleBackgroundColor: string;
  defaultSongBackgroundColor: string;
}

export interface ThemeSettings {
  id: string;
  name: string;
  accentColor: 'blue' | 'emerald' | 'amber';
  density: 'compact' | 'comfortable';
  preset: 'sanctuary-blue' | 'warm-obsidian' | 'broadcast-lower-third' | 'transparent-obs' | 'high-contrast';
}

export interface KeyboardShortcutMap {
  prevSlide: string;
  nextSlide: string;
  projectLive: string;
  clearOutput: string;
  openBible: string;
  openSongs: string;
  openSettings: string;
  toggleLowerThird: string;
  toggleFullscreen: string;
  toggleQuickActions: string;
  focusSearch: string;
}

export interface UserPreferences {
  language: 'en' | 'es' | 'fr' | 'pt';
  sidebarWidth: number;
  uiFontSizePx: number;
  uiRowHeightPx: number;
  quickActionsOpen: boolean;
  defaultTranslationId: string;
  updateRepoUrl: string;
  songbookAutoMerge: boolean;
  shortcuts: KeyboardShortcutMap;
}

export interface BackupFile {
  app: 'ET BSP' | 'Bible Song Pro';
  schemaVersion: number;
  exportedAt: string;
  songs: Song[];
  bibleTranslations: BibleTranslation[];
  customFonts?: CustomFont[];
  setlists?: unknown[];
  settings?: DisplaySettings;
  themes?: ThemeSettings;
  preferences?: UserPreferences;
}

export interface SyncConnectionState {
  wsStatus: 'connected' | 'reconnecting' | 'disconnected';
  broadcastChannelAvailable: boolean;
  connectedDisplays: number;
  lastSyncedAt: number | null;
}

export interface ToastMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  description?: string;
}
