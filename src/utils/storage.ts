import type {
  BibleTranslation,
  CustomFont,
  DisplaySettings,
  PresentationState,
  Song,
  ThemeSettings,
  UserPreferences,
} from '../types/models';
import {
  DEFAULT_THEME_SETTINGS,
  DEFAULT_USER_PREFERENCES,
  INITIAL_PRESENTATION_STATE,
  normalizeDisplaySettings,
} from '../data/seedData';
import { sanitizeBibleTranslation, sortTranslationsNltFirstNivSecond } from './bibleEngine';
import { sortSongsAlphabetically } from './songEngine';

const DB_NAME = 'ETBSP_DB';
const DB_VERSION = 1;
const STORE_KV = 'kv';
const STORE_COLLECTIONS = 'collections';

export const LS_KEYS = {
  PRESENTATION: 'etbsp:presentation_state',
  DISPLAY_SETTINGS: 'etbsp:display_settings',
  THEME_SETTINGS: 'etbsp:theme_settings',
  PREFERENCES: 'etbsp:user_preferences',
  CUSTOM_FONTS: 'etbsp:custom_fonts',
};

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
      if (!db.objectStoreNames.contains(STORE_COLLECTIONS)) {
        db.createObjectStore(STORE_COLLECTIONS);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Failed to open IndexedDB'));
  });
}

async function idbGet<T>(store: string, key: string): Promise<T | undefined> {
  try {
    const db = await openDB();
    return await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const os = tx.objectStore(store);
      const req = os.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return undefined;
  }
}

async function idbSet<T>(store: string, key: string, value: T): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const os = tx.objectStore(store);
      const req = os.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // Fallback to localStorage below if needed
  }
}

function lsGet<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

function lsSet<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch {
    // Ignore quota errors
  }
}

export interface PersistedWorkspaceData {
  translations: BibleTranslation[];
  songs: Song[];
  customFonts: CustomFont[];
  displaySettings: DisplaySettings;
  themeSettings: ThemeSettings;
  preferences: UserPreferences;
  presentationState: PresentationState;
}

async function fetchServerWorkspace(): Promise<{
  exists: boolean;
  data: Partial<PersistedWorkspaceData> | null;
} | null> {
  if (typeof fetch === 'undefined' || typeof window === 'undefined') return null;
  try {
    const res = await fetch('/api/workspace', { cache: 'no-store' });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      exists: Boolean(json?.exists && json?.data),
      data: json?.data || null,
    };
  } catch {
    return null;
  }
}

async function pushServerWorkspacePatch(patch: Partial<PersistedWorkspaceData>): Promise<void> {
  if (typeof fetch === 'undefined' || typeof window === 'undefined') return;
  try {
    await fetch('/api/workspace', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
      keepalive: true,
    });
  } catch {
    // Ignore network unavailability in offline unit tests
  }
}

export async function loadWorkspaceData(): Promise<PersistedWorkspaceData> {
  const [
    serverResult,
    storedTranslations,
    storedSongs,
    storedFonts,
    storedDisplay,
    storedTheme,
    storedPrefs,
    storedPres,
  ] = await Promise.all([
    fetchServerWorkspace(),
    idbGet<BibleTranslation[]>(STORE_COLLECTIONS, 'translations'),
    idbGet<Song[]>(STORE_COLLECTIONS, 'songs'),
    idbGet<CustomFont[]>(STORE_COLLECTIONS, 'customFonts'),
    idbGet<DisplaySettings>(STORE_KV, 'displaySettings'),
    idbGet<ThemeSettings>(STORE_KV, 'themeSettings'),
    idbGet<UserPreferences>(STORE_KV, 'preferences'),
    idbGet<PresentationState>(STORE_KV, 'presentationState'),
  ]);

  const serverData = serverResult?.exists ? serverResult.data : null;

  const rawTranslations =
    (Array.isArray(serverData?.translations) ? serverData.translations : undefined) ||
    storedTranslations ||
    lsGet<BibleTranslation[]>('etbsp:translations') ||
    [];
  const translations = sortTranslationsNltFirstNivSecond(
    rawTranslations.map(sanitizeBibleTranslation)
  );

  const rawSongs =
    (Array.isArray(serverData?.songs) ? serverData.songs : undefined) ||
    storedSongs ||
    lsGet<Song[]>('etbsp:songs') ||
    [];
  const songs = sortSongsAlphabetically(rawSongs);

  const customFonts =
    (Array.isArray(serverData?.customFonts) ? serverData.customFonts : undefined) ||
    storedFonts ||
    lsGet<CustomFont[]>(LS_KEYS.CUSTOM_FONTS) ||
    [];

  const displaySettings: DisplaySettings = normalizeDisplaySettings(
    serverData?.displaySettings ||
      storedDisplay ||
      lsGet<DisplaySettings>(LS_KEYS.DISPLAY_SETTINGS)
  );

  const themeSettings: ThemeSettings = {
    ...DEFAULT_THEME_SETTINGS,
    ...(serverData?.themeSettings ||
      storedTheme ||
      lsGet<ThemeSettings>(LS_KEYS.THEME_SETTINGS) ||
      {}),
  };

  const rawPrefs =
    serverData?.preferences ||
    storedPrefs ||
    lsGet<UserPreferences>(LS_KEYS.PREFERENCES);

  const preferences: UserPreferences = {
    ...DEFAULT_USER_PREFERENCES,
    ...(rawPrefs || {}),
    shortcuts: {
      ...DEFAULT_USER_PREFERENCES.shortcuts,
      ...(rawPrefs?.shortcuts || {}),
    },
  };

  const presentationState: PresentationState = {
    ...INITIAL_PRESENTATION_STATE,
    ...(serverData?.presentationState ||
      lsGet<PresentationState>(LS_KEYS.PRESENTATION) ||
      storedPres ||
      {}),
  };

  const bundle: PersistedWorkspaceData = {
    translations,
    songs,
    customFonts,
    displaySettings,
    themeSettings,
    preferences,
    presentationState,
  };

  // Auto-migrate existing browser/IndexedDB data to disk store on first launch after update
  if (serverResult && !serverResult.exists) {
    const hasLocalData =
      translations.length > 0 ||
      songs.length > 0 ||
      customFonts.length > 0 ||
      Boolean(storedDisplay || lsGet(LS_KEYS.DISPLAY_SETTINGS));
    if (hasLocalData) {
      pushServerWorkspacePatch(bundle);
    }
  } else if (serverData) {
    // Mirror server disk store back into browser caches for offline resilience
    await Promise.all([
      idbSet(STORE_COLLECTIONS, 'translations', translations),
      idbSet(STORE_COLLECTIONS, 'songs', songs),
      idbSet(STORE_COLLECTIONS, 'customFonts', customFonts),
      idbSet(STORE_KV, 'displaySettings', displaySettings),
      idbSet(STORE_KV, 'themeSettings', themeSettings),
      idbSet(STORE_KV, 'preferences', preferences),
      idbSet(STORE_KV, 'presentationState', presentationState),
    ]);
    lsSet(LS_KEYS.DISPLAY_SETTINGS, displaySettings);
    lsSet(LS_KEYS.CUSTOM_FONTS, customFonts);
    lsSet(LS_KEYS.PRESENTATION, presentationState);
  }

  return bundle;
}

export async function saveTranslations(translations: BibleTranslation[]): Promise<void> {
  const ordered = sortTranslationsNltFirstNivSecond(translations.map(sanitizeBibleTranslation));
  await idbSet(STORE_COLLECTIONS, 'translations', ordered);
  lsSet('etbsp:translations', ordered);
  await pushServerWorkspacePatch({ translations: ordered });
}

export async function saveSongs(songs: Song[]): Promise<void> {
  const sorted = sortSongsAlphabetically(songs);
  await idbSet(STORE_COLLECTIONS, 'songs', sorted);
  lsSet('etbsp:songs', sorted);
  await pushServerWorkspacePatch({ songs: sorted });
}

export async function saveCustomFonts(fonts: CustomFont[]): Promise<void> {
  await idbSet(STORE_COLLECTIONS, 'customFonts', fonts);
  lsSet(LS_KEYS.CUSTOM_FONTS, fonts);
  await pushServerWorkspacePatch({ customFonts: fonts });
}

export async function saveDisplaySettings(settings: DisplaySettings): Promise<void> {
  lsSet(LS_KEYS.DISPLAY_SETTINGS, settings);
  await idbSet(STORE_KV, 'displaySettings', settings);
  await pushServerWorkspacePatch({ displaySettings: settings });
}

export async function saveThemeSettings(themes: ThemeSettings): Promise<void> {
  lsSet(LS_KEYS.THEME_SETTINGS, themes);
  await idbSet(STORE_KV, 'themeSettings', themes);
  await pushServerWorkspacePatch({ themeSettings: themes });
}

export async function saveUserPreferences(prefs: UserPreferences): Promise<void> {
  lsSet(LS_KEYS.PREFERENCES, prefs);
  await idbSet(STORE_KV, 'preferences', prefs);
  await pushServerWorkspacePatch({ preferences: prefs });
}

export async function savePresentationState(state: PresentationState): Promise<void> {
  lsSet(LS_KEYS.PRESENTATION, state);
  await idbSet(STORE_KV, 'presentationState', state);
  await pushServerWorkspacePatch({ presentationState: state });
}

export async function clearAllWorkspaceStorage(): Promise<void> {
  try {
    localStorage.removeItem('etbsp:translations');
    localStorage.removeItem('etbsp:songs');
    localStorage.removeItem(LS_KEYS.CUSTOM_FONTS);
    localStorage.removeItem(LS_KEYS.DISPLAY_SETTINGS);
    localStorage.removeItem(LS_KEYS.THEME_SETTINGS);
    localStorage.removeItem(LS_KEYS.PREFERENCES);
    localStorage.removeItem(LS_KEYS.PRESENTATION);
    if (typeof indexedDB !== 'undefined') {
      indexedDB.deleteDatabase(DB_NAME);
    }
    if (typeof fetch !== 'undefined') {
      await fetch('/api/workspace', { method: 'DELETE' });
    }
  } catch {
    // Ignore
  }
}
