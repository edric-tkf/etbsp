import type {
  BackupFile,
  BibleTranslation,
  CustomFont,
  DisplaySettings,
  Song,
  ThemeSettings,
  UserPreferences,
} from '../types/models';
import {
  parseLegacyBackupBible,
  sanitizeBibleTranslation,
  sortTranslationsNltFirstNivSecond,
} from './bibleEngine';
import { parseLegacyBackupSong, sortSongsAlphabetically } from './songEngine';
import { normalizeFontFamilyName } from './fontEngine';
import { normalizeDisplaySettings } from '../data/seedData';

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  preview?: {
    exportedAt: string;
    schemaVersion: number;
    songCount: number;
    translationCount: number;
    fontCount: number;
    hasSettings: boolean;
    hasThemes: boolean;
  };
  backup?: BackupFile;
}

export function createBackupFile(params: {
  songs: Song[];
  bibleTranslations: BibleTranslation[];
  customFonts?: CustomFont[];
  settings: DisplaySettings;
  themes: ThemeSettings;
  preferences?: UserPreferences;
}): BackupFile {
  return {
    app: 'ET BSP',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    songs: sortSongsAlphabetically(params.songs),
    bibleTranslations: params.bibleTranslations.map(sanitizeBibleTranslation),
    customFonts: params.customFonts || [],
    settings: params.settings,
    themes: params.themes,
    preferences: params.preferences,
  };
}

export function validateBackupFile(rawJson: string): BackupValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    return {
      valid: false,
      errors: [`Invalid JSON file: ${err instanceof Error ? err.message : 'Syntax error'}`],
      warnings,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['Backup root must be a JSON object.'], warnings };
  }

  const appName = String(parsed.app || '').trim();
  if (appName && appName !== 'ET BSP' && appName !== 'Bible Song Pro') {
    errors.push(
      `Unrecognized backup application identifier: "${appName}". Expected "ET BSP" or "Bible Song Pro".`
    );
  }

  // Support both schemaVersion and legacy backupVersion
  const rawVersion =
    typeof parsed.schemaVersion === 'number'
      ? parsed.schemaVersion
      : typeof parsed.backupVersion === 'number'
      ? parsed.backupVersion
      : null;

  if (rawVersion === null || rawVersion < 1) {
    errors.push('Missing or invalid "schemaVersion" / "backupVersion" number.');
  } else if (rawVersion > BACKUP_SCHEMA_VERSION) {
    warnings.push(
      `Backup version (${rawVersion}) is newer than current version (${BACKUP_SCHEMA_VERSION}).`
    );
  }

  // Support both top-level fields and nested `data` wrapper (legacy Bible Song Pro format)
  const payloadRoot = parsed.data && typeof parsed.data === 'object' ? parsed.data : parsed;

  const rawSongs = Array.isArray(payloadRoot.songs) ? payloadRoot.songs : null;
  const rawBibles = Array.isArray(payloadRoot.bibleTranslations)
    ? payloadRoot.bibleTranslations
    : Array.isArray(payloadRoot.bibles)
    ? payloadRoot.bibles
    : null;

  if (!rawSongs && !rawBibles) {
    errors.push('Backup must contain a valid "songs" or "bibleTranslations"/"bibles" array.');
  }

  if (errors.length > 0) {
    return { valid: false, errors, warnings };
  }

  const parsedSongs: Song[] = [];
  if (rawSongs) {
    for (const item of rawSongs) {
      const converted = parseLegacyBackupSong(item);
      if (converted) {
        parsedSongs.push(converted);
      } else {
        warnings.push(`Skipped song "${String(item?.title || item?.id || 'unknown')}" (no lyrics).`);
      }
    }
  }

  const parsedBibles: BibleTranslation[] = [];
  if (rawBibles) {
    for (const item of rawBibles) {
      const converted = parseLegacyBackupBible(item);
      if (converted) {
        parsedBibles.push(converted);
      } else {
        warnings.push(
          `Skipped Bible "${String(item?.name || item?.id || 'unknown')}" (no readable chapters/verses).`
        );
      }
    }
  }

  const rawFonts = Array.isArray(payloadRoot.customFonts)
    ? payloadRoot.customFonts
    : Array.isArray(parsed.customFonts)
    ? parsed.customFonts
    : [];

  const parsedFonts: CustomFont[] = rawFonts
    .filter((f: any) => f && typeof f.name === 'string' && typeof f.dataUrl === 'string')
    .map((f: any) => ({
      id: String(f.id || `font_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
      name: String(f.name).trim(),
      dataUrl: String(f.dataUrl),
      format: typeof f.format === 'string' ? f.format : undefined,
      createdAt: typeof f.createdAt === 'string' ? f.createdAt : new Date().toISOString(),
    }));

  // Map compatible settings (both current ET BSP format and legacy settings format)
  const rawSettings = payloadRoot.settings && typeof payloadRoot.settings === 'object'
    ? payloadRoot.settings
    : undefined;

  let mappedSettings: Partial<DisplaySettings> | undefined;
  if (rawSettings) {
    if (
      'outputResolution' in rawSettings ||
      'fullscreenFontSizePx' in rawSettings ||
      'lowerThirdFontSizePx' in rawSettings ||
      'fontSizeScale' in rawSettings
    ) {
      mappedSettings = { ...(rawSettings as DisplaySettings) };
    } else {
      mappedSettings = {};
      if (typeof rawSettings.fontFamily === 'string') {
        mappedSettings.fontFamily = normalizeFontFamilyName(rawSettings.fontFamily);
      }
      if (typeof rawSettings.textColor === 'string') {
        mappedSettings.textColor = rawSettings.textColor;
      }
      if (typeof rawSettings.refBgColor === 'string') {
        mappedSettings.bibleReferenceBgColor = rawSettings.refBgColor;
      }
      if (typeof rawSettings.refColor === 'string') {
        mappedSettings.bibleReferenceTextColor = rawSettings.refColor;
      }
      if (rawSettings.ltAnchorMode === 'top' || rawSettings.ltAnchorMode === 'bottom') {
        mappedSettings.lowerThirdPosition = rawSettings.ltAnchorMode;
      }
      if (typeof rawSettings.bgColor === 'string' && rawSettings.bgColor.startsWith('#')) {
        mappedSettings.solidColor = rawSettings.bgColor;
      }
    }
  }

  const backup: BackupFile = {
    app: appName === 'Bible Song Pro' ? 'Bible Song Pro' : 'ET BSP',
    schemaVersion: rawVersion || 1,
    exportedAt: String(parsed.exportedAt || new Date().toISOString()),
    songs: sortSongsAlphabetically(parsedSongs),
    bibleTranslations: sortTranslationsNltFirstNivSecond(parsedBibles),
    customFonts: parsedFonts,
    settings: mappedSettings as DisplaySettings | undefined,
    themes: payloadRoot.themes || parsed.themes || undefined,
    preferences: payloadRoot.preferences || parsed.preferences || undefined,
  };

  return {
    valid: true,
    errors: [],
    warnings,
    preview: {
      exportedAt: backup.exportedAt,
      schemaVersion: backup.schemaVersion,
      songCount: backup.songs.length,
      translationCount: backup.bibleTranslations.length,
      fontCount: backup.customFonts?.length || 0,
      hasSettings: Boolean(mappedSettings),
      hasThemes: Boolean(backup.themes && typeof backup.themes === 'object'),
    },
    backup,
  };
}

export interface AppDataBundle {
  songs: Song[];
  bibleTranslations: BibleTranslation[];
  customFonts: CustomFont[];
  settings: DisplaySettings;
  themes: ThemeSettings;
  preferences: UserPreferences;
}

export function mergeBackupData(existing: AppDataBundle, incoming: BackupFile): AppDataBundle {
  const songMap = new Map<string, Song>();
  for (const s of existing.songs) songMap.set(s.id, s);
  for (const s of incoming.songs) songMap.set(s.id, s);

  const transMap = new Map<string, BibleTranslation>();
  for (const t of existing.bibleTranslations) transMap.set(t.id, sanitizeBibleTranslation(t));
  for (const t of incoming.bibleTranslations) transMap.set(t.id, sanitizeBibleTranslation(t));

  const fontMap = new Map<string, CustomFont>();
  for (const f of existing.customFonts) fontMap.set(f.name.toLowerCase(), f);
  for (const f of incoming.customFonts || []) fontMap.set(f.name.toLowerCase(), f);

  return {
    songs: sortSongsAlphabetically(Array.from(songMap.values())),
    bibleTranslations: sortTranslationsNltFirstNivSecond(Array.from(transMap.values())),
    customFonts: Array.from(fontMap.values()),
    settings: incoming.settings
      ? normalizeDisplaySettings({ ...existing.settings, ...incoming.settings })
      : existing.settings,
    themes: incoming.themes ? { ...existing.themes, ...incoming.themes } : existing.themes,
    preferences: incoming.preferences
      ? { ...existing.preferences, ...incoming.preferences }
      : existing.preferences,
  };
}

export function replaceBackupData(existing: AppDataBundle, incoming: BackupFile): AppDataBundle {
  return {
    songs: sortSongsAlphabetically(incoming.songs),
    bibleTranslations: sortTranslationsNltFirstNivSecond(
      incoming.bibleTranslations.map(sanitizeBibleTranslation)
    ),
    customFonts: incoming.customFonts || existing.customFonts,
    settings: incoming.settings
      ? normalizeDisplaySettings({ ...existing.settings, ...incoming.settings })
      : existing.settings,
    themes: incoming.themes ? { ...existing.themes, ...incoming.themes } : existing.themes,
    preferences: incoming.preferences
      ? { ...existing.preferences, ...incoming.preferences }
      : existing.preferences,
  };
}

export function downloadJsonFile(filename: string, data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
