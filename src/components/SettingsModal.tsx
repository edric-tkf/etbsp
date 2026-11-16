import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Monitor,
  Palette,
  RefreshCw,
  Settings as SettingsIcon,
  Trash2,
  Type,
  Upload,
  X,
} from 'lucide-react';
import type {
  BackupFile,
  BibleTranslation,
  CustomFont,
  DisplaySettings,
  Song,
  ThemeSettings,
  UserPreferences,
} from '../types/models';
import { APP_NAME, APP_VERSION, THEME_PRESETS } from '../data/seedData';
import {
  createBackupFile,
  downloadJsonFile,
  validateBackupFile,
  type BackupValidationResult,
} from '../utils/backupEngine';
import { BUILTIN_FONTS, normalizeFontFamilyName, readFontFileAsCustomFont } from '../utils/fontEngine';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  displaySettings: DisplaySettings;
  onUpdateDisplaySettings: (patch: Partial<DisplaySettings>) => void;
  themeSettings: ThemeSettings;
  onUpdateThemeSettings: (next: ThemeSettings) => void;
  preferences: UserPreferences;
  onUpdatePreferences: (patch: Partial<UserPreferences>) => void;
  translations: BibleTranslation[];
  songs: Song[];
  customFonts: CustomFont[];
  onAddCustomFont: (font: CustomFont) => void;
  onDeleteCustomFont: (fontId: string) => void;
  onApplyBackup: (backup: BackupFile, mode: 'merge' | 'replace') => void;
  onRequestResetAllData: () => void;
  onCopyUrl: (url: string, label: string) => void;
}

type SettingsSection =
  | 'general'
  | 'bible'
  | 'background'
  | 'typography'
  | 'layout'
  | 'themes'
  | 'shortcuts'
  | 'backup'
  | 'obs-vmix'
  | 'reset';

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  displaySettings,
  onUpdateDisplaySettings,
  themeSettings,
  onUpdateThemeSettings,
  preferences,
  onUpdatePreferences,
  translations,
  songs,
  customFonts,
  onAddCustomFont,
  onDeleteCustomFont,
  onApplyBackup,
  onRequestResetAllData,
  onCopyUrl,
}) => {
  const [section, setSection] = useState<SettingsSection>('general');
  const [singleExportType, setSingleExportType] = useState<'song' | 'translation'>('song');
  const [singleExportId, setSingleExportId] = useState<string>(songs[0]?.id || '');
  const [backupValidation, setBackupValidation] = useState<BackupValidationResult | null>(null);
  const [pendingReplaceConfirm, setPendingReplaceConfirm] = useState(false);
  const [fontError, setFontError] = useState<string | null>(null);
  const [updateCheckState, setUpdateCheckState] = useState<{
    checking: boolean;
    message: string | null;
    latestUrl?: string;
    hasUpdate?: boolean;
  }>({ checking: false, message: null });

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  const displayUrl = `${origin}/display?view=display`;
  const panelUrl = `${origin}/`;

  const handleFullBackupExport = () => {
    const backup = createBackupFile({
      songs,
      bibleTranslations: translations,
      customFonts,
      settings: displaySettings,
      themes: themeSettings,
      preferences,
    });
    downloadJsonFile(
      `et-bsp-backup-${new Date().toISOString().slice(0, 10)}.json`,
      backup
    );
  };

  const handleSingleItemExport = () => {
    if (singleExportType === 'song') {
      const target = songs.find((s) => s.id === singleExportId) || songs[0];
      if (target) {
        downloadJsonFile(`song-${target.title.toLowerCase().replace(/\s+/g, '-')}.json`, target);
      }
    } else {
      const target = translations.find((t) => t.id === singleExportId) || translations[0];
      if (target) {
        downloadJsonFile(`bible-${target.abbreviation.toLowerCase()}.json`, target);
      }
    }
  };

  const handleBackupFileSelected = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const res = validateBackupFile(text);
    setBackupValidation(res);
    setPendingReplaceConfirm(false);
  };

  const handleFontUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setFontError(null);
    try {
      for (const file of Array.from(files)) {
        const font = await readFontFileAsCustomFont(file);
        onAddCustomFont(font);
        onUpdateDisplaySettings({ fontFamily: font.name });
      }
    } catch (err) {
      setFontError(err instanceof Error ? err.message : 'Unable to import font file.');
    }
  };

  const handleCheckForUpdates = async () => {
    setUpdateCheckState({ checking: true, message: 'Checking for updates...' });
    try {
      const serverRes = await fetch('/api/version', { cache: 'no-store' });
      let serverVer = APP_VERSION;
      if (serverRes.ok) {
        const json = await serverRes.json();
        serverVer = String(json.version || APP_VERSION);
      }

      const repoInput = (preferences.updateRepoUrl || '').trim();
      if (repoInput) {
        const cleanedRepo = repoInput
          .replace(/^https?:\/\/github\.com\//i, '')
          .replace(/\/+$/, '');
        const ghRes = await fetch(`https://api.github.com/repos/${cleanedRepo}/releases/latest`);
        if (ghRes.ok) {
          const rel = await ghRes.json();
          const latestTag = String(rel.tag_name || '').replace(/^v/i, '');
          const releaseUrl = String(rel.html_url || `https://github.com/${cleanedRepo}/releases`);
          if (latestTag && latestTag !== APP_VERSION) {
            setUpdateCheckState({
              checking: false,
              hasUpdate: true,
              latestUrl: releaseUrl,
              message: `New release v${latestTag} available (current v${APP_VERSION}).`,
            });
            return;
          }
          setUpdateCheckState({
            checking: false,
            hasUpdate: false,
            latestUrl: releaseUrl,
            message: `You are running the latest version (v${APP_VERSION}).`,
          });
          return;
        }
      }

      if (serverVer !== APP_VERSION) {
        setUpdateCheckState({
          checking: false,
          hasUpdate: true,
          message: `New server build v${serverVer} detected. Click "Reload App" below to update.`,
        });
      } else {
        setUpdateCheckState({
          checking: false,
          hasUpdate: false,
          message: `Running ${APP_NAME} v${APP_VERSION}. Everything is up to date.`,
        });
      }
    } catch {
      setUpdateCheckState({
        checking: false,
        message: `Running ${APP_NAME} v${APP_VERSION}. Unable to reach update server right now.`,
      });
    }
  };

  const navItems: Array<{ id: SettingsSection; label: string }> = [
    { id: 'general', label: 'General & Updates' },
    { id: 'bible', label: 'Bible Options' },
    { id: 'background', label: 'Background' },
    { id: 'typography', label: 'Fonts & Spacing' },
    { id: 'layout', label: 'Layout & Lower-Third' },
    { id: 'themes', label: 'Themes' },
    { id: 'shortcuts', label: 'Keyboard Shortcuts' },
    { id: 'backup', label: 'Backup & Restore' },
    { id: 'obs-vmix', label: 'OBS & vMix' },
    { id: 'reset', label: 'Reset Workspace' },
  ];

  const selectedFontNormalized = normalizeFontFamilyName(displaySettings.fontFamily);
  const allFontOptions = Array.from(
    new Set([
      ...BUILTIN_FONTS,
      ...customFonts.map((f) => f.name),
      selectedFontNormalized,
    ])
  ).filter(Boolean);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-modal-title"
    >
      <div className="w-full max-w-4xl h-[85vh] rounded-xl bg-[#171b22] border border-[#2c323d] shadow-2xl flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2c323d] bg-[#20242c]">
          <div className="flex items-center gap-2">
            <SettingsIcon className="w-4 h-4 text-blue-400" />
            <h2 id="settings-modal-title" className="text-xs font-semibold text-white">
              {APP_NAME} Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#252a33]"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 min-h-0 flex">
          {/* Left Settings Navigation */}
          <nav className="w-48 border-r border-[#2c323d] bg-[#141820] p-2 overflow-y-auto space-y-1 shrink-0">
            {navItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`w-full text-left px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                  section === item.id
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-300 hover:text-white hover:bg-[#20242c]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          {/* Right Settings Content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {section === 'general' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-white">General & App Updates</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Interface Language
                    </label>
                    <select
                      value={preferences.language}
                      onChange={(e) =>
                        onUpdatePreferences({
                          language: e.target.value as UserPreferences['language'],
                        })
                      }
                      className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white"
                    >
                      <option value="en">English (EN)</option>
                      <option value="es">Español (ES)</option>
                      <option value="fr">Français (FR)</option>
                      <option value="pt">Português (PT)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Output Resolution Target
                    </label>
                    <select
                      value={displaySettings.outputResolution}
                      onChange={(e) =>
                        onUpdateDisplaySettings({
                          outputResolution: e.target.value as DisplaySettings['outputResolution'],
                        })
                      }
                      className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] font-mono-tabular text-white"
                    >
                      <option value="1920x1080">1920 × 1080 (Full HD 16:9)</option>
                      <option value="1280x720">1280 × 720 (HD 16:9)</option>
                      <option value="3840x2160">3840 × 2160 (4K UHD 16:9)</option>
                    </select>
                  </div>
                </div>

                {/* Easy App Update Panel */}
                <div className="rounded-lg bg-[#20242c] border border-[#2c323d] p-3.5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-semibold text-white">
                        {APP_NAME} · Version {APP_VERSION}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        Export your data before updating, check for new releases, or reload to apply the latest build.
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      GitHub Release Repo (Optional, e.g. owner/et-bsp)
                    </label>
                    <input
                      type="text"
                      value={preferences.updateRepoUrl || ''}
                      onChange={(e) => onUpdatePreferences({ updateRepoUrl: e.target.value })}
                      placeholder="owner/repo"
                      className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={updateCheckState.checking}
                      onClick={handleCheckForUpdates}
                      className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white flex items-center gap-1.5"
                    >
                      <RefreshCw className={`w-3 h-3 ${updateCheckState.checking ? 'animate-spin' : ''}`} />
                      <span>Check for Updates</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleFullBackupExport}
                      className="px-3 py-1.5 rounded bg-[#252a33] hover:bg-[#2f3642] border border-[#2c323d] text-[11px] font-medium text-slate-200 flex items-center gap-1.5"
                    >
                      <Download className="w-3 h-3 text-blue-400" />
                      <span>Backup Before Update</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => window.location.reload()}
                      className="px-3 py-1.5 rounded bg-[#252a33] hover:bg-[#2f3642] border border-[#2c323d] text-[11px] font-medium text-slate-200"
                    >
                      Reload App
                    </button>

                    {updateCheckState.latestUrl && (
                      <a
                        href={updateCheckState.latestUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-[11px] font-semibold text-white flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Download Release</span>
                      </a>
                    )}
                  </div>

                  {updateCheckState.message && (
                    <div className="text-[11px] text-slate-200 bg-[#11141a] border border-[#2c323d] rounded px-2.5 py-1.5">
                      {updateCheckState.message}
                    </div>
                  )}
                </div>
              </div>
            )}

            {section === 'bible' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white">Bible Presentation Options</h3>
                <p className="text-[11px] text-slate-400">
                  Bible slides render strictly one verse per slide in uppercase for maximum broadcast legibility.
                </p>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Default Translation
                  </label>
                  <select
                    value={preferences.defaultTranslationId}
                    onChange={(e) =>
                      onUpdatePreferences({ defaultTranslationId: e.target.value })
                    }
                    className="w-full max-w-sm rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white"
                  >
                    <option value="">First imported translation</option>
                    {translations.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.abbreviation} — {t.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
                  <label className="flex items-center gap-2 text-[11px] text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displaySettings.showBibleReferenceLabel}
                      onChange={(e) =>
                        onUpdateDisplaySettings({ showBibleReferenceLabel: e.target.checked })
                      }
                      className="accent-blue-500"
                    />
                    Show Reference Label
                  </label>
                  <label className="flex items-center gap-2 text-[11px] text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displaySettings.bibleReferenceRounded}
                      onChange={(e) =>
                        onUpdateDisplaySettings({ bibleReferenceRounded: e.target.checked })
                      }
                      className="accent-blue-500"
                    />
                    Rounded Reference Badge
                  </label>
                  <div className="flex items-center gap-3">
                    <label className="text-[11px] text-slate-300 flex items-center gap-1.5">
                      Badge Bg
                      <input
                        type="color"
                        value={displaySettings.bibleReferenceBgColor}
                        onChange={(e) =>
                          onUpdateDisplaySettings({ bibleReferenceBgColor: e.target.value })
                        }
                      />
                    </label>
                    <label className="text-[11px] text-slate-300 flex items-center gap-1.5">
                      Badge Text
                      <input
                        type="color"
                        value={displaySettings.bibleReferenceTextColor}
                        onChange={(e) =>
                          onUpdateDisplaySettings({ bibleReferenceTextColor: e.target.value })
                        }
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}

            {section === 'background' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white">Canvas Background & Transitions</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Background Type
                    </label>
                    <select
                      value={displaySettings.backgroundType}
                      onChange={(e) =>
                        onUpdateDisplaySettings({
                          backgroundType: e.target.value as DisplaySettings['backgroundType'],
                          transparentBackground: e.target.value === 'transparent',
                        })
                      }
                      className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white"
                    >
                      <option value="solid">Solid Color</option>
                      <option value="gradient">Gradient</option>
                      <option value="transparent">Transparent (OBS Overlay)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Slide Transition
                    </label>
                    <select
                      value={displaySettings.transition}
                      onChange={(e) =>
                        onUpdateDisplaySettings({
                          transition: e.target.value as DisplaySettings['transition'],
                        })
                      }
                      className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white"
                    >
                      <option value="fade">Fade</option>
                      <option value="zoom">Zoom</option>
                      <option value="cut">Cut (Instant)</option>
                      <option value="slide">Slide</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <label className="text-[11px] text-slate-300 space-y-1">
                    <span className="block">Bible Solid Bg</span>
                    <input
                      type="color"
                      value={displaySettings.solidColor}
                      onChange={(e) => onUpdateDisplaySettings({ solidColor: e.target.value })}
                    />
                  </label>
                  <label className="text-[11px] text-slate-300 space-y-1">
                    <span className="block">Song Solid Bg</span>
                    <input
                      type="color"
                      value={displaySettings.defaultSongBackgroundColor}
                      onChange={(e) =>
                        onUpdateDisplaySettings({ defaultSongBackgroundColor: e.target.value })
                      }
                    />
                  </label>
                  <label className="text-[11px] text-slate-300 space-y-1">
                    <span className="block">Gradient Start</span>
                    <input
                      type="color"
                      value={displaySettings.gradientFrom}
                      onChange={(e) => onUpdateDisplaySettings({ gradientFrom: e.target.value })}
                    />
                  </label>
                  <label className="text-[11px] text-slate-300 space-y-1">
                    <span className="block">Gradient End</span>
                    <input
                      type="color"
                      value={displaySettings.gradientTo}
                      onChange={(e) => onUpdateDisplaySettings({ gradientTo: e.target.value })}
                    />
                  </label>
                </div>

                <div>
                  <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                    <span>Animation Speed (Fade / Slide / Zoom)</span>
                    <span className="font-mono-tabular">{displaySettings.transitionDurationMs}ms</span>
                  </div>
                  <input
                    type="range"
                    min={100}
                    max={900}
                    step={20}
                    value={displaySettings.transitionDurationMs}
                    onChange={(e) =>
                      onUpdateDisplaySettings({ transitionDurationMs: Number(e.target.value) })
                    }
                    className="w-full accent-blue-500"
                  />
                </div>
              </div>
            )}

            {section === 'typography' && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Type className="w-3.5 h-3.5 text-blue-400" />
                  Fonts, Word Spacing & Line Distance
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Presentation Font
                    </label>
                    <select
                      value={selectedFontNormalized}
                      onChange={(e) => onUpdateDisplaySettings({ fontFamily: e.target.value })}
                      className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white"
                    >
                      {allFontOptions.map((fontName) => (
                        <option key={fontName} value={fontName}>
                          {fontName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Text Alignment
                    </label>
                    <select
                      value={displaySettings.textAlign}
                      onChange={(e) =>
                        onUpdateDisplaySettings({
                          textAlign: e.target.value as DisplaySettings['textAlign'],
                        })
                      }
                      className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-[11px] text-white"
                    >
                      <option value="center">Center</option>
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-300 mb-1">
                      Text Color & Shadow
                    </label>
                    <div className="flex items-center gap-3 pt-1">
                      <input
                        type="color"
                        value={displaySettings.textColor}
                        onChange={(e) => onUpdateDisplaySettings({ textColor: e.target.value })}
                      />
                      <label className="flex items-center gap-1.5 text-[11px] text-slate-200 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={displaySettings.textShadow}
                          onChange={(e) =>
                            onUpdateDisplaySettings({ textShadow: e.target.checked })
                          }
                          className="accent-blue-500"
                        />
                        Drop Shadow
                      </label>
                    </div>
                  </div>
                </div>

                {/* Custom Font Importer */}
                <div className="rounded-lg bg-[#20242c] border border-[#2c323d] p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[11px] font-semibold text-white">
                        Import Custom Fonts (.ttf, .otf, .woff, .woff2)
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Imported fonts are stored locally and synced live to OBS/Display.
                      </div>
                    </div>
                    <label className="px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white cursor-pointer flex items-center gap-1.5 shrink-0">
                      <Upload className="w-3 h-3" />
                      <span>Import Font</span>
                      <input
                        type="file"
                        accept=".ttf,.otf,.woff,.woff2"
                        multiple
                        className="hidden"
                        onChange={(e) => {
                          handleFontUpload(e.target.files);
                          e.target.value = '';
                        }}
                      />
                    </label>
                  </div>

                  {fontError && (
                    <div className="text-[11px] text-red-300">{fontError}</div>
                  )}

                  {customFonts.length > 0 && (
                    <div className="divide-y divide-[#2c323d] rounded bg-[#11141a] border border-[#2c323d]">
                      {customFonts.map((font) => {
                        const active = selectedFontNormalized === font.name;
                        return (
                          <div
                            key={font.id}
                            className="flex items-center justify-between px-2.5 py-1.5 text-[11px]"
                          >
                            <button
                              type="button"
                              onClick={() => onUpdateDisplaySettings({ fontFamily: font.name })}
                              className="flex-1 text-left flex items-center gap-2 text-slate-200 hover:text-white"
                            >
                              <span style={{ fontFamily: `"${font.name}", sans-serif` }}>
                                {font.name}
                              </span>
                              {active && (
                                <span className="text-[10px] font-semibold text-blue-400">
                                  Active
                                </span>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteCustomFont(font.id)}
                              className="p-1 text-slate-400 hover:text-red-400"
                              aria-label={`Delete font ${font.name}`}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Size, Word Spacing, Line Distance Sliders */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span>Font Size Scale</span>
                      <span className="font-mono-tabular">
                        {Math.round(displaySettings.fontSizeScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.7}
                      max={1.5}
                      step={0.05}
                      value={displaySettings.fontSizeScale}
                      onChange={(e) =>
                        onUpdateDisplaySettings({ fontSizeScale: Number(e.target.value) })
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span>Word Spacing</span>
                      <span className="font-mono-tabular">{displaySettings.wordSpacingPx ?? 0}px</span>
                    </div>
                    <input
                      type="range"
                      min={-4}
                      max={24}
                      step={1}
                      value={displaySettings.wordSpacingPx ?? 0}
                      onChange={(e) =>
                        onUpdateDisplaySettings({ wordSpacingPx: Number(e.target.value) })
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span>Line Height (Wrapped Lines)</span>
                      <span className="font-mono-tabular">
                        {(displaySettings.lineHeight ?? 1.25).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.95}
                      max={2.2}
                      step={0.05}
                      value={displaySettings.lineHeight ?? 1.25}
                      onChange={(e) =>
                        onUpdateDisplaySettings({ lineHeight: Number(e.target.value) })
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span>Distance Between Song Lines</span>
                      <span className="font-mono-tabular">{displaySettings.songLineGapPx ?? 16}px</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={64}
                      step={2}
                      value={displaySettings.songLineGapPx ?? 16}
                      onChange={(e) =>
                        onUpdateDisplaySettings({ songLineGapPx: Number(e.target.value) })
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {section === 'layout' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white">Layout, Full-Screen & Lower-Third</h3>

                <div>
                  <label className="block text-[11px] font-medium text-slate-300 mb-1">
                    Lower-Third Position
                  </label>
                  <div className="inline-flex p-0.5 rounded bg-[#11141a] border border-[#2c323d]">
                    <button
                      type="button"
                      onClick={() => onUpdateDisplaySettings({ lowerThirdPosition: 'top' })}
                      className={`px-3 py-1 rounded text-[11px] font-medium ${
                        displaySettings.lowerThirdPosition === 'top'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Top
                    </button>
                    <button
                      type="button"
                      onClick={() => onUpdateDisplaySettings({ lowerThirdPosition: 'bottom' })}
                      className={`px-3 py-1 rounded text-[11px] font-medium ${
                        displaySettings.lowerThirdPosition === 'bottom'
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Bottom
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span>Broadcast Safe Margin</span>
                      <span className="font-mono-tabular">{displaySettings.safeMarginPercent}%</span>
                    </div>
                    <input
                      type="range"
                      min={2}
                      max={12}
                      step={1}
                      value={displaySettings.safeMarginPercent}
                      onChange={(e) =>
                        onUpdateDisplaySettings({ safeMarginPercent: Number(e.target.value) })
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span>Lower-Third Bar Height</span>
                      <span className="font-mono-tabular">
                        {displaySettings.lowerThirdHeightPercent}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={18}
                      max={42}
                      step={1}
                      value={displaySettings.lowerThirdHeightPercent}
                      onChange={(e) =>
                        onUpdateDisplaySettings({
                          lowerThirdHeightPercent: Number(e.target.value),
                        })
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-4 pt-1">
                    <label className="flex items-center gap-2 text-[11px] text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={displaySettings.lowerThirdShowBackground !== false}
                        onChange={(e) =>
                          onUpdateDisplaySettings({ lowerThirdShowBackground: e.target.checked })
                        }
                        className="accent-blue-500"
                      />
                      Show Lower-Third Background Box
                    </label>

                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300">
                      <span>Box Color</span>
                      <input
                        type="color"
                        value={displaySettings.lowerThirdBgColor || '#0b142a'}
                        onChange={(e) =>
                          onUpdateDisplaySettings({ lowerThirdBgColor: e.target.value })
                        }
                      />
                    </label>
                  </div>

                  <div>
                    <div className="flex justify-between text-[11px] text-slate-300 mb-1">
                      <span>Lower-Third Background Opacity (0% = No Background)</span>
                      <span className="font-mono-tabular">
                        {Math.round(displaySettings.lowerThirdOpacity * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={displaySettings.lowerThirdOpacity}
                      onChange={(e) =>
                        onUpdateDisplaySettings({ lowerThirdOpacity: Number(e.target.value) })
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>

                  <label className="flex items-center gap-2 text-[11px] text-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={displaySettings.lowerThirdBlur}
                      onChange={(e) =>
                        onUpdateDisplaySettings({ lowerThirdBlur: e.target.checked })
                      }
                      className="accent-blue-500"
                    />
                    Enable Backdrop Blur in Lower-Third Mode
                  </label>
                </div>
              </div>
            )}

            {section === 'themes' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Palette className="w-3.5 h-3.5 text-blue-400" />
                  Presentation Output Themes
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {THEME_PRESETS.map((preset) => {
                    const active = themeSettings.preset === preset.preset;
                    return (
                      <button
                        key={preset.preset}
                        type="button"
                        onClick={() => {
                          onUpdateThemeSettings({
                            ...themeSettings,
                            id: `theme-${preset.preset}`,
                            name: preset.name,
                            preset: preset.preset,
                          });
                          onUpdateDisplaySettings(preset.displayPatch);
                        }}
                        className={`text-left rounded-lg border p-3 transition-colors ${
                          active
                            ? 'bg-blue-950/35 border-blue-500'
                            : 'bg-[#20242c] border-[#2c323d] hover:bg-[#252a33]'
                        }`}
                      >
                        <div className="text-[11px] font-bold text-white">{preset.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{preset.description}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {section === 'shortcuts' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white">Keyboard Shortcuts</h3>
                <div className="rounded-lg bg-[#20242c] border border-[#2c323d] divide-y divide-[#2c323d]">
                  {[
                    ['Previous Slide', 'ArrowLeft'],
                    ['Next Slide', 'ArrowRight'],
                    ['Project Live', 'Enter'],
                    ['Clear Output', 'Escape'],
                    ['Open Bible Tab', '1'],
                    ['Open Songs Tab', '2'],
                    ['Toggle Lower-Third', 'L'],
                    ['Toggle Full-Screen Mode', 'F'],
                    ['Toggle Quick Actions', 'Q'],
                    ['Focus Bible Search', '/'],
                    ['Open Settings', 'Ctrl/Cmd + ,'],
                  ].map(([action, key]) => (
                    <div key={action} className="flex items-center justify-between px-3 py-2 text-[11px]">
                      <span className="text-slate-200">{action}</span>
                      <kbd className="px-1.5 py-0.5 rounded bg-[#11141a] border border-[#2c323d] font-mono-tabular text-[10px] text-slate-300">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {section === 'backup' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-bold text-white">Application Backup & Restore</h3>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Import or export songs, Bible translations, custom fonts, and display settings.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-lg bg-[#20242c] border border-[#2c323d] p-3 space-y-2.5">
                    <div className="text-[11px] font-semibold text-white">Full Application Export</div>
                    <div className="text-[10px] text-slate-400 font-mono-tabular">
                      {songs.length} Songs · {translations.length} Bibles · {customFonts.length} Custom Fonts
                    </div>
                    <button
                      type="button"
                      onClick={handleFullBackupExport}
                      className="w-full py-1.5 px-3 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Export Complete Backup (.json)
                    </button>
                  </div>

                  <div className="rounded-lg bg-[#20242c] border border-[#2c323d] p-3 space-y-2">
                    <div className="text-[11px] font-semibold text-white">Export Single Item</div>
                    <div className="flex gap-1.5">
                      <select
                        value={singleExportType}
                        onChange={(e) => {
                          const next = e.target.value as 'song' | 'translation';
                          setSingleExportType(next);
                          setSingleExportId(
                            next === 'song' ? songs[0]?.id || '' : translations[0]?.id || ''
                          );
                        }}
                        className="rounded bg-[#11141a] border border-[#2c323d] px-2 py-1 text-[11px] text-white"
                      >
                        <option value="song">Song</option>
                        <option value="translation">Bible</option>
                      </select>
                      <select
                        value={singleExportId}
                        onChange={(e) => setSingleExportId(e.target.value)}
                        className="flex-1 rounded bg-[#11141a] border border-[#2c323d] px-2 py-1 text-[11px] text-white truncate"
                      >
                        {singleExportType === 'song' &&
                          songs.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.title}
                            </option>
                          ))}
                        {singleExportType === 'translation' &&
                          translations.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.abbreviation} — {t.name}
                            </option>
                          ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      disabled={
                        singleExportType === 'song' ? songs.length === 0 : translations.length === 0
                      }
                      onClick={handleSingleItemExport}
                      className="w-full py-1.5 px-3 rounded bg-[#252a33] hover:bg-[#2f3642] border border-[#2c323d] text-[11px] font-semibold text-slate-200 flex items-center justify-center gap-1.5 disabled:opacity-40"
                    >
                      <Download className="w-3.5 h-3.5 text-blue-400" />
                      Export Selected Item
                    </button>
                  </div>
                </div>

                {/* Import Backup */}
                <div className="rounded-lg bg-[#20242c] border border-[#2c323d] p-3 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-white">Import Backup File</span>
                    <label className="px-2.5 py-1.5 rounded bg-[#252a33] hover:bg-[#2f3642] border border-[#2c323d] text-[11px] font-medium text-white cursor-pointer flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-blue-400" />
                      Choose Backup JSON
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        onChange={(e) => handleBackupFileSelected(e.target.files?.[0])}
                      />
                    </label>
                  </div>

                  {backupValidation && (
                    <div className="rounded bg-[#11141a] border border-[#2c323d] p-3 space-y-2">
                      {!backupValidation.valid ? (
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[11px] font-semibold text-red-400">
                            <AlertCircle className="w-3.5 h-3.5" />
                            Invalid Backup File
                          </div>
                          {backupValidation.errors.map((err, i) => (
                            <div key={i} className="text-[11px] text-red-300">
                              • {err}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="flex items-center gap-1.5 font-semibold text-emerald-400">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Validated Backup (v{backupValidation.preview?.schemaVersion})
                            </span>
                            <span className="text-slate-400 font-mono-tabular">
                              {backupValidation.preview?.exportedAt.slice(0, 10)}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-300 font-mono-tabular">
                            {backupValidation.preview?.songCount} Songs ·{' '}
                            {backupValidation.preview?.translationCount} Bibles ·{' '}
                            {backupValidation.preview?.fontCount} Fonts
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <button
                              type="button"
                              onClick={() => {
                                if (backupValidation.backup) {
                                  onApplyBackup(backupValidation.backup, 'merge');
                                  setBackupValidation(null);
                                }
                              }}
                              className="px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white"
                            >
                              Merge Into Existing Data
                            </button>

                            {!pendingReplaceConfirm ? (
                              <button
                                type="button"
                                onClick={() => setPendingReplaceConfirm(true)}
                                className="px-3 py-1.5 rounded bg-red-950/60 hover:bg-red-900/70 border border-red-800 text-[11px] font-semibold text-red-200"
                              >
                                Replace All Existing Data...
                              </button>
                            ) : (
                              <div className="flex items-center gap-2 bg-red-950/50 border border-red-700 rounded px-2.5 py-1">
                                <span className="text-[11px] text-red-200">Overwrite library?</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (backupValidation.backup) {
                                      onApplyBackup(backupValidation.backup, 'replace');
                                      setBackupValidation(null);
                                      setPendingReplaceConfirm(false);
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded bg-red-600 hover:bg-red-500 text-[11px] font-semibold text-white"
                                >
                                  Confirm
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setPendingReplaceConfirm(false)}
                                  className="text-[11px] text-slate-300 hover:text-white"
                                >
                                  Cancel
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {section === 'obs-vmix' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white flex items-center gap-2">
                  <Monitor className="w-3.5 h-3.5 text-blue-400" />
                  OBS Studio & vMix Integration
                </h3>

                <div className="space-y-2.5">
                  <div className="rounded-lg bg-[#20242c] border border-[#2c323d] p-3 space-y-1.5">
                    <div className="text-[11px] font-semibold text-white">
                      Presentation Display URL (OBS Browser Source / vMix Web Browser)
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={displayUrl}
                        className="flex-1 rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1 text-[11px] font-mono-tabular text-blue-300"
                      />
                      <button
                        type="button"
                        onClick={() => onCopyUrl(displayUrl, 'Display URL')}
                        className="px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                  </div>

                  <div className="rounded-lg bg-[#20242c] border border-[#2c323d] p-3 space-y-1.5">
                    <div className="text-[11px] font-semibold text-white">
                      Control Panel URL (OBS Custom Browser Dock)
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={panelUrl}
                        className="flex-1 rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1 text-[11px] font-mono-tabular text-slate-300"
                      />
                      <button
                        type="button"
                        onClick={() => onCopyUrl(panelUrl, 'Control Panel URL')}
                        className="px-2.5 py-1 rounded bg-[#252a33] hover:bg-[#2f3642] text-[11px] font-semibold text-white flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {section === 'reset' && (
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-white">Reset Workspace</h3>
                <p className="text-[11px] text-slate-400">
                  Clear all imported Bibles, songs, custom fonts, and display settings from local storage.
                </p>
                <button
                  type="button"
                  onClick={onRequestResetAllData}
                  className="px-3.5 py-1.5 rounded bg-red-600 hover:bg-red-500 text-[11px] font-semibold text-white"
                >
                  Reset All Workspace Data
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
