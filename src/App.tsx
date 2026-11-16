import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  Keyboard,
  Monitor,
  Music2,
  PanelRightClose,
  PanelRightOpen,
  Play,
  Radio,
  Search,
  Settings as SettingsIcon,
  Square,
  Wifi,
  WifiOff,
  X,
} from 'lucide-react';
import type {
  BackupFile,
  BibleDisplayMode,
  BibleTranslation,
  CustomFont,
  DisplaySettings,
  LowerThirdPosition,
  MainTab,
  PresentationState,
  Song,
  SyncConnectionState,
  ThemeSettings,
  ToastMessage,
  UserPreferences,
} from './types/models';
import {
  APP_NAME,
  DEFAULT_DISPLAY_SETTINGS,
  DEFAULT_THEME_SETTINGS,
  DEFAULT_USER_PREFERENCES,
  INITIAL_PRESENTATION_STATE,
  SEED_BIBLE_TRANSLATIONS,
  SEED_SONGS,
} from './data/seedData';
import {
  buildSingleVerseSlidePayload,
  sortTranslationsNltFirstNivSecond,
} from './utils/bibleEngine';
import { computeSongSlides, sortSongsAlphabetically } from './utils/songEngine';
import { mergeBackupData, replaceBackupData } from './utils/backupEngine';
import { loadCustomFontsIntoDocument } from './utils/fontEngine';
import {
  clearAllWorkspaceStorage,
  loadWorkspaceData,
  saveCustomFonts,
  saveDisplaySettings,
  savePresentationState,
  saveSongs,
  saveThemeSettings,
  saveTranslations,
  saveUserPreferences,
} from './utils/storage';
import { PresentationSyncClient } from './utils/syncEngine';
import { PresentationCanvas } from './components/PresentationCanvas';
import { DisplayPage } from './components/DisplayPage';
import { BibleWorkspace } from './components/BibleWorkspace';
import { SongsWorkspace } from './components/SongsWorkspace';
import { BibleImportModal } from './components/BibleImportModal';
import { SettingsModal } from './components/SettingsModal';
import { ConfirmDialog } from './components/ConfirmDialog';

function isDisplayRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  const params = new URLSearchParams(window.location.search);
  return (
    path.includes('display') ||
    path.endsWith('bsp_display.html') ||
    params.get('view') === 'display' ||
    params.get('mode') === 'display'
  );
}

export default function App() {
  if (isDisplayRoute()) {
    return <DisplayPage />;
  }
  return <ControlPanel />;
}

function ControlPanel() {
  const [hydrated, setHydrated] = useState(false);
  const [activeTab, setActiveTab] = useState<MainTab>('bible');

  // Core persisted data
  const [translations, setTranslations] = useState<BibleTranslation[]>(SEED_BIBLE_TRANSLATIONS);
  const [songs, setSongs] = useState<Song[]>(SEED_SONGS);
  const [customFonts, setCustomFonts] = useState<CustomFont[]>([]);
  const [displaySettings, setDisplaySettings] = useState<DisplaySettings>(DEFAULT_DISPLAY_SETTINGS);
  const [themeSettings, setThemeSettings] = useState<ThemeSettings>(DEFAULT_THEME_SETTINGS);
  const [preferences, setPreferences] = useState<UserPreferences>(DEFAULT_USER_PREFERENCES);
  const [presentation, setPresentation] = useState<PresentationState>(INITIAL_PRESENTATION_STATE);

  // Active workspace selection state
  const [selectedTranslationId, setSelectedTranslationId] = useState<string>('');
  const [selectedBook, setSelectedBook] = useState<string>('Genesis');
  const [selectedChapter, setSelectedChapter] = useState<number>(1);
  const [selectedVerse, setSelectedVerse] = useState<number>(1);

  const [songSidebarSearch, setSongSidebarSearch] = useState('');
  const [selectedSongId, setSelectedSongId] = useState<string>('');
  const [selectedSongSlideIdx, setSelectedSongSlideIdx] = useState<number>(0);

  // Modals & UI panels
  const [bibleImportOpen, setBibleImportOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    open: boolean;
    title: string;
    message: string;
    confirmLabel: string;
    onConfirm: () => void;
  } | null>(null);

  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [syncStatus, setSyncStatus] = useState<SyncConnectionState>({
    wsStatus: 'disconnected',
    broadcastChannelAvailable: typeof BroadcastChannel !== 'undefined',
    connectedDisplays: 0,
    lastSyncedAt: null,
  });

  const syncRef = useRef<PresentationSyncClient | null>(null);
  const presentationRef = useRef(presentation);
  const displaySettingsRef = useRef(displaySettings);
  const customFontsRef = useRef(customFonts);
  const bibleSearchRef = useRef<HTMLInputElement | null>(null);
  const isResizingSidebar = useRef(false);

  presentationRef.current = presentation;
  displaySettingsRef.current = displaySettings;
  customFontsRef.current = customFonts;

  const pushToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [...prev.slice(-3), { id, type, title, description }]);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 3600);
    },
    []
  );

  // Inject custom fonts into main panel document so preview matches OBS Display
  useEffect(() => {
    loadCustomFontsIntoDocument(customFonts);
  }, [customFonts]);

  // Hydrate persisted workspace from IndexedDB / localStorage
  useEffect(() => {
    let mounted = true;
    loadWorkspaceData().then((data) => {
      if (!mounted) return;
      const sortedTranslations = sortTranslationsNltFirstNivSecond(data.translations);
      const sortedSongs = sortSongsAlphabetically(data.songs);

      setTranslations(sortedTranslations);
      setSongs(sortedSongs);
      setCustomFonts(data.customFonts);
      setDisplaySettings(data.displaySettings);
      setThemeSettings(data.themeSettings);
      setPreferences(data.preferences);
      setPresentation(data.presentationState);

      if (
        sortedTranslations.some((t) => t.id === data.preferences.defaultTranslationId)
      ) {
        setSelectedTranslationId(data.preferences.defaultTranslationId);
      } else if (sortedTranslations[0]) {
        setSelectedTranslationId(sortedTranslations[0].id);
        const firstBook = sortedTranslations[0].books[0];
        if (firstBook) {
          setSelectedBook(firstBook.name);
          setSelectedChapter(firstBook.chapters[0]?.number || 1);
          setSelectedVerse(firstBook.chapters[0]?.verses[0]?.number || 1);
        }
      }

      if (sortedSongs[0]) {
        setSelectedSongId(sortedSongs[0].id);
      }

      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Initialize multi-layer sync client
  useEffect(() => {
    const client = new PresentationSyncClient('panel', {
      onStatusChange: (status) => setSyncStatus(status),
      onSyncRequested: () => {
        client.publishPresentation(presentationRef.current);
        client.publishSettings(displaySettingsRef.current);
        client.publishFonts(customFontsRef.current);
      },
    });
    syncRef.current = client;
    return () => {
      client.dispose();
      syncRef.current = null;
    };
  }, []);

  const commitPresentation = useCallback((next: PresentationState) => {
    presentationRef.current = next;
    setPresentation(next);
    savePresentationState(next);
    syncRef.current?.publishPresentation(next);
  }, []);

  const updateDisplaySettings = useCallback((patch: Partial<DisplaySettings>) => {
    setDisplaySettings((prev) => {
      const next = { ...prev, ...patch };
      displaySettingsRef.current = next;
      saveDisplaySettings(next);
      syncRef.current?.publishSettings(next);
      return next;
    });
  }, []);

  const updatePreferences = useCallback((patch: Partial<UserPreferences>) => {
    setPreferences((prev) => {
      const next = { ...prev, ...patch };
      saveUserPreferences(next);
      return next;
    });
  }, []);

  // Sidebar resize drag handlers
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isResizingSidebar.current) return;
      const clamped = Math.max(200, Math.min(380, e.clientX));
      setPreferences((prev) => ({ ...prev, sidebarWidth: clamped }));
    };
    const onMouseUp = () => {
      if (isResizingSidebar.current) {
        isResizingSidebar.current = false;
        setPreferences((prev) => {
          saveUserPreferences(prev);
          return prev;
        });
      }
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const activeTranslation = useMemo(
    () => translations.find((t) => t.id === selectedTranslationId) || translations[0],
    [translations, selectedTranslationId]
  );

  const activeSong = useMemo(
    () => songs.find((s) => s.id === selectedSongId) || songs[0] || null,
    [songs, selectedSongId]
  );
  const activeSongSlides = useMemo(
    () => (activeSong ? computeSongSlides(activeSong) : []),
    [activeSong]
  );

  // Project a single Bible verse (strictly 1 verse per slide)
  const projectBibleVerse = useCallback(
    (book: string, chapter: number, verse: number, overrideTranslationId?: string) => {
      const primary =
        translations.find((t) => t.id === (overrideTranslationId || selectedTranslationId)) ||
        translations[0];
      if (!primary) return;

      const payload = buildSingleVerseSlidePayload(primary, book, chapter, verse);
      if (!payload) {
        pushToast(
          'warning',
          'Verse Not Found',
          `${book} ${chapter}:${verse} is not in ${primary.abbreviation}.`
        );
        return;
      }

      setSelectedBook(payload.book);
      setSelectedChapter(payload.chapter);
      setSelectedVerse(payload.verse);

      const latest = presentationRef.current;
      commitPresentation({
        isLive: true,
        activeType: 'bible',
        bibleDisplayMode: latest.bibleDisplayMode,
        bible: payload,
        updatedAt: Date.now(),
        revision: latest.revision + 1,
      });
    },
    [translations, selectedTranslationId, commitPresentation, pushToast]
  );

  // Project a single 2-line song slide
  const projectSongSlide = useCallback(
    (song: Song, slideIndex: number) => {
      const slides = computeSongSlides(song);
      if (slides.length === 0) {
        pushToast('warning', 'No Lyrics', 'This song has no lyric slides to project.');
        return;
      }
      const clampedIdx = Math.max(0, Math.min(slides.length - 1, slideIndex));
      const slide = slides[clampedIdx];
      setSelectedSongId(song.id);
      setSelectedSongSlideIdx(clampedIdx);

      const latest = presentationRef.current;
      commitPresentation({
        isLive: true,
        activeType: 'song',
        bibleDisplayMode: latest.bibleDisplayMode,
        song: {
          songId: song.id,
          songTitle: song.title,
          songArtist: song.artist,
          sectionId: slide.sectionId,
          sectionTitle: slide.sectionTitle,
          sectionType: slide.sectionType,
          lines: slide.lines.slice(0, 2),
          slideIndex: slide.slideIndex,
          totalSlides: slide.totalSlides,
          timestamp: slide.timestamp,
        },
        updatedAt: Date.now(),
        revision: latest.revision + 1,
      });
    },
    [commitPresentation, pushToast]
  );

  const clearOutput = useCallback(() => {
    const latest = presentationRef.current;
    commitPresentation({
      ...latest,
      isLive: false,
      activeType: 'none',
      updatedAt: Date.now(),
      revision: latest.revision + 1,
    });
  }, [commitPresentation]);

  // Step Previous / Next slide across active tab or active live item
  const stepSlide = useCallback(
    (delta: -1 | 1) => {
      const latest = presentationRef.current;
      if (activeTab === 'bible' || (latest.isLive && latest.activeType === 'bible' && activeTab !== 'songs')) {
        if (!activeTranslation) return;
        const bookObj = activeTranslation.books.find(
          (b) => b.name.toLowerCase() === selectedBook.toLowerCase()
        );
        const chapObj = bookObj?.chapters.find((c) => c.number === selectedChapter);
        if (!bookObj || !chapObj) return;
        const curIdx = chapObj.verses.findIndex((v) => v.number === selectedVerse);
        const nextIdx = curIdx + delta;
        if (nextIdx >= 0 && nextIdx < chapObj.verses.length) {
          const nextV = chapObj.verses[nextIdx].number;
          setSelectedVerse(nextV);
          if (latest.isLive && latest.activeType === 'bible') {
            projectBibleVerse(bookObj.name, chapObj.number, nextV);
          }
        }
        return;
      }

      if (activeTab === 'songs' || (latest.isLive && latest.activeType === 'song')) {
        if (!activeSong || activeSongSlides.length === 0) return;
        const nextIdx = Math.max(
          0,
          Math.min(activeSongSlides.length - 1, selectedSongSlideIdx + delta)
        );
        setSelectedSongSlideIdx(nextIdx);
        if (latest.isLive && latest.activeType === 'song') {
          projectSongSlide(activeSong, nextIdx);
        }
      }
    },
    [
      activeTab,
      activeTranslation,
      selectedBook,
      selectedChapter,
      selectedVerse,
      projectBibleVerse,
      activeSong,
      activeSongSlides.length,
      selectedSongSlideIdx,
      projectSongSlide,
    ]
  );

  const handleProjectCurrentSelection = useCallback(() => {
    if (activeTab === 'bible') {
      projectBibleVerse(selectedBook, selectedChapter, selectedVerse);
    } else if (activeTab === 'songs' && activeSong) {
      projectSongSlide(activeSong, selectedSongSlideIdx);
    }
  }, [
    activeTab,
    projectBibleVerse,
    selectedBook,
    selectedChapter,
    selectedVerse,
    activeSong,
    projectSongSlide,
    selectedSongSlideIdx,
  ]);

  const toggleBibleDisplayMode = useCallback(
    (mode?: BibleDisplayMode) => {
      const latest = presentationRef.current;
      const nextMode: BibleDisplayMode =
        mode || (latest.bibleDisplayMode === 'fullscreen' ? 'lower-third' : 'fullscreen');
      commitPresentation({
        ...latest,
        bibleDisplayMode: nextMode,
        updatedAt: Date.now(),
        revision: latest.revision + 1,
      });
    },
    [commitPresentation]
  );

  const handleChangeLowerThirdPosition = useCallback(
    (pos: LowerThirdPosition) => {
      updateDisplaySettings({ lowerThirdPosition: pos });
    },
    [updateDisplaySettings]
  );

  const openStandaloneDisplay = useCallback(() => {
    const desktopApi = (window as any).bibleSongProDesktop;
    if (desktopApi?.isElectron) {
      desktopApi.openDisplayWindow(false);
      pushToast('info', 'Display Window Opened', 'Presentation window launched on desktop.');
      return;
    }
    const url = `${window.location.origin}/display?view=display`;
    const popup = window.open(url, 'ETBSPDisplay', 'width=1280,height=720,menubar=no,toolbar=no');
    if (popup) {
      pushToast('info', 'Display Window Opened', 'Synchronized over BroadcastChannel and WebSocket.');
    } else {
      pushToast('info', 'Display URL Ready', url);
    }
  }, [pushToast]);

  const copyText = useCallback(
    async (text: string, label: string) => {
      try {
        await navigator.clipboard.writeText(text);
        pushToast('success', `${label} Copied`, text);
      } catch {
        pushToast('info', label, text);
      }
    },
    [pushToast]
  );

  // Global Keyboard Shortcuts
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditingText =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key === ',') {
        e.preventDefault();
        setSettingsOpen((prev) => !prev);
        return;
      }

      if (e.key === 'Escape') {
        if (settingsOpen) setSettingsOpen(false);
        else if (bibleImportOpen) setBibleImportOpen(false);
        else clearOutput();
        return;
      }

      if (isEditingText) return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        stepSlide(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        stepSlide(1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        handleProjectCurrentSelection();
      } else if (e.key === '1') {
        setActiveTab('bible');
      } else if (e.key === '2') {
        setActiveTab('songs');
      } else if (e.key === 'l' || e.key === 'L') {
        toggleBibleDisplayMode('lower-third');
      } else if (e.key === 'f' || e.key === 'F') {
        toggleBibleDisplayMode('fullscreen');
      } else if (e.key === 'q' || e.key === 'Q') {
        updatePreferences({ quickActionsOpen: !preferences.quickActionsOpen });
      } else if (e.key === '/') {
        e.preventDefault();
        setActiveTab('bible');
        window.setTimeout(() => bibleSearchRef.current?.focus(), 40);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [
    settingsOpen,
    bibleImportOpen,
    clearOutput,
    stepSlide,
    handleProjectCurrentSelection,
    toggleBibleDisplayMode,
    updatePreferences,
    preferences.quickActionsOpen,
  ]);

  // CRUD Handlers
  const handleImportBibleTranslation = (imported: BibleTranslation) => {
    setTranslations((prev) => {
      const existsIdx = prev.findIndex((t) => t.id === imported.id);
      const next =
        existsIdx >= 0
          ? prev.map((t, idx) => (idx === existsIdx ? imported : t))
          : [...prev, imported];
      const sorted = sortTranslationsNltFirstNivSecond(next);
      saveTranslations(sorted);
      return sorted;
    });
    setSelectedTranslationId(imported.id);
    if (imported.books[0]) {
      setSelectedBook(imported.books[0].name);
      setSelectedChapter(imported.books[0].chapters[0]?.number || 1);
      setSelectedVerse(imported.books[0].chapters[0]?.verses[0]?.number || 1);
    }
    pushToast(
      'success',
      `Imported ${imported.abbreviation}`,
      `${imported.name} extracted into app storage.`
    );
  };

  const handleCreateSong = (song: Song) => {
    setSongs((prev) => {
      const next = sortSongsAlphabetically([song, ...prev]);
      saveSongs(next);
      return next;
    });
    setSelectedSongId(song.id);
    setSelectedSongSlideIdx(0);
    setActiveTab('songs');
    pushToast('success', 'Song Saved', `"${song.title}" added to Songs.`);
  };

  const handleUpdateSong = (updated: Song) => {
    setSongs((prev) => {
      const next = sortSongsAlphabetically(prev.map((s) => (s.id === updated.id ? updated : s)));
      saveSongs(next);
      return next;
    });
    pushToast('success', 'Song Updated', `"${updated.title}" saved.`);
  };

  const handleDeleteSong = (songId: string) => {
    const target = songs.find((s) => s.id === songId);
    if (!target) return;
    setConfirmState({
      open: true,
      title: 'Delete Song',
      message: `Are you sure you want to delete "${target.title}"? This action cannot be undone.`,
      confirmLabel: 'Delete Song',
      onConfirm: () => {
        setSongs((prev) => {
          const next = sortSongsAlphabetically(prev.filter((s) => s.id !== songId));
          saveSongs(next);
          if (selectedSongId === songId) {
            setSelectedSongId(next[0]?.id || '');
            setSelectedSongSlideIdx(0);
          }
          return next;
        });
        setConfirmState(null);
        pushToast('info', 'Song Deleted', `"${target.title}" removed.`);
      },
    });
  };

  const handleAddCustomFont = (font: CustomFont) => {
    setCustomFonts((prev) => {
      const withoutSameName = prev.filter(
        (f) => f.name.toLowerCase() !== font.name.toLowerCase()
      );
      const next = [...withoutSameName, font];
      customFontsRef.current = next;
      saveCustomFonts(next);
      syncRef.current?.publishFonts(next);
      return next;
    });
    pushToast('success', 'Font Imported', `"${font.name}" is ready for presentation.`);
  };

  const handleDeleteCustomFont = (fontId: string) => {
    setCustomFonts((prev) => {
      const next = prev.filter((f) => f.id !== fontId);
      customFontsRef.current = next;
      saveCustomFonts(next);
      syncRef.current?.publishFonts(next);
      return next;
    });
  };

  const handleApplyBackup = (backup: BackupFile, mode: 'merge' | 'replace') => {
    const currentBundle = {
      songs,
      bibleTranslations: translations,
      customFonts,
      settings: displaySettings,
      themes: themeSettings,
      preferences,
    };
    const nextBundle =
      mode === 'merge'
        ? mergeBackupData(currentBundle, backup)
        : replaceBackupData(currentBundle, backup);

    setSongs(nextBundle.songs);
    setTranslations(nextBundle.bibleTranslations);
    setCustomFonts(nextBundle.customFonts);
    setDisplaySettings(nextBundle.settings);
    setThemeSettings(nextBundle.themes);
    setPreferences(nextBundle.preferences);

    displaySettingsRef.current = nextBundle.settings;
    customFontsRef.current = nextBundle.customFonts;

    saveSongs(nextBundle.songs);
    saveTranslations(nextBundle.bibleTranslations);
    saveCustomFonts(nextBundle.customFonts);
    saveDisplaySettings(nextBundle.settings);
    saveThemeSettings(nextBundle.themes);
    saveUserPreferences(nextBundle.preferences);
    syncRef.current?.publishSettings(nextBundle.settings);
    syncRef.current?.publishFonts(nextBundle.customFonts);

    if (nextBundle.bibleTranslations[0]) {
      const firstT = nextBundle.bibleTranslations[0];
      setSelectedTranslationId(firstT.id);
      if (firstT.books[0]) {
        setSelectedBook(firstT.books[0].name);
        setSelectedChapter(firstT.books[0].chapters[0]?.number || 1);
        setSelectedVerse(firstT.books[0].chapters[0]?.verses[0]?.number || 1);
      }
    }
    if (nextBundle.songs[0]) {
      setSelectedSongId(nextBundle.songs[0].id);
      setSelectedSongSlideIdx(0);
    }

    pushToast(
      'success',
      mode === 'merge' ? 'Backup Merged' : 'Backup Restored',
      `Loaded ${nextBundle.songs.length} songs, ${nextBundle.bibleTranslations.length} Bibles, ${nextBundle.customFonts.length} fonts.`
    );
  };

  const handleResetAllData = () => {
    setConfirmState({
      open: true,
      title: 'Reset All Workspace Data',
      message:
        'This will delete all imported Bibles, songs, custom fonts, and settings from local storage.',
      confirmLabel: 'Reset Workspace',
      onConfirm: async () => {
        await clearAllWorkspaceStorage();
        setTranslations(SEED_BIBLE_TRANSLATIONS);
        setSongs(SEED_SONGS);
        setCustomFonts([]);
        setDisplaySettings(DEFAULT_DISPLAY_SETTINGS);
        setThemeSettings(DEFAULT_THEME_SETTINGS);
        setPreferences(DEFAULT_USER_PREFERENCES);
        setPresentation(INITIAL_PRESENTATION_STATE);
        setSelectedTranslationId('');
        setSelectedSongId('');
        setConfirmState(null);
        setSettingsOpen(false);
        syncRef.current?.publishPresentation(INITIAL_PRESENTATION_STATE);
        syncRef.current?.publishSettings(DEFAULT_DISPLAY_SETTINGS);
        syncRef.current?.publishFonts([]);
        pushToast('info', 'Workspace Reset', `Cleared all ${APP_NAME} data.`);
      },
    });
  };

  const projectLiveColorClass =
    activeTab === 'bible'
      ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
      : 'bg-red-600 hover:bg-red-500 text-white';

  const filteredSongsForSidebar = useMemo(() => {
    const sorted = sortSongsAlphabetically(songs);
    const q = songSidebarSearch.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.sections.some((sec) => sec.lyrics.some((l) => l.toLowerCase().includes(q)))
    );
  }, [songs, songSidebarSearch]);

  const obsDisplayUrl =
    typeof window !== 'undefined' ? `${window.location.origin}/display?view=display` : '/display';

  const liveSummaryText = useMemo(() => {
    if (!presentation.isLive || presentation.activeType === 'none') {
      return 'STANDBY · OUTPUT CLEARED';
    }
    if (presentation.activeType === 'bible' && presentation.bible) {
      const b = presentation.bible;
      return `${b.book} ${b.chapter}:${b.verse} · ${b.translationAbbr}`.toUpperCase();
    }
    if (presentation.activeType === 'song' && presentation.song) {
      const s = presentation.song;
      return `${s.songTitle} · SLIDE ${s.slideIndex + 1}/${s.totalSlides}`.toUpperCase();
    }
    return 'LIVE';
  }, [presentation]);

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col bg-[#11141a] text-slate-100 text-xs">
      {/* TOP TITLE BAR */}
      <header className="h-10 shrink-0 px-3.5 border-b border-[#252a33] bg-[#171b22] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded bg-blue-600 flex items-center justify-center shrink-0">
            <Radio className="w-3.5 h-3.5 text-white" />
          </div>
          <h1 className="font-display text-xs font-bold tracking-tight text-white whitespace-nowrap shrink-0">
            {APP_NAME}
          </h1>
          <span className="hidden sm:inline text-[11px] text-slate-400 whitespace-nowrap">
            · Broadcast Console
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div
            className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded bg-[#20242c] border border-[#2c323d] text-[11px]"
            title="Real-time BroadcastChannel & WebSocket display synchronization status"
          >
            {syncStatus.wsStatus === 'connected' ? (
              <Wifi className="w-3 h-3 text-emerald-400" />
            ) : (
              <WifiOff className="w-3 h-3 text-amber-400" />
            )}
            <span className="text-slate-300 whitespace-nowrap">
              {syncStatus.wsStatus === 'connected' ? 'Sync Ready' : 'Local Channel'}
            </span>
            <span className="text-slate-500">·</span>
            <span className="font-mono-tabular text-slate-400 whitespace-nowrap">
              {syncStatus.connectedDisplays} OBS/Display
            </span>
          </div>

          <button
            type="button"
            onClick={() => copyText(obsDisplayUrl, 'OBS Display URL')}
            className="hidden sm:flex items-center gap-1 px-2 py-1 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-[11px] font-medium text-slate-200 whitespace-nowrap shrink-0 transition-colors"
          >
            <Copy className="w-3 h-3 text-blue-400" />
            <span>Copy OBS URL</span>
          </button>

          <button
            type="button"
            onClick={openStandaloneDisplay}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white whitespace-nowrap shrink-0 transition-colors"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Open Display</span>
          </button>

          <button
            type="button"
            onClick={() => updatePreferences({ quickActionsOpen: !preferences.quickActionsOpen })}
            aria-label="Toggle quick actions panel"
            title="Toggle Quick Actions (Q)"
            className="p-1.5 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-slate-300 hover:text-white transition-colors"
          >
            {preferences.quickActionsOpen ? (
              <PanelRightClose className="w-3.5 h-3.5" />
            ) : (
              <PanelRightOpen className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
            title="Settings (Ctrl/Cmd + ,)"
            className="p-1.5 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-slate-300 hover:text-white transition-colors"
          >
            <SettingsIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* MAIN THREE-COLUMN STUDIO WORKSPACE */}
      <div className="flex-1 min-h-0 flex">
        {/* LEFT NAVIGATION & CONTEXTUAL SIDEBAR (RESIZABLE) */}
        <aside
          style={{ width: `${preferences.sidebarWidth}px` }}
          className="shrink-0 bg-[#171b22] border-r border-[#252a33] flex flex-col min-h-0"
        >
          {/* Primary 2 Navigation Tabs (Bible & Songs) */}
          <nav className="p-2 grid grid-cols-2 gap-1 border-b border-[#252a33]" aria-label="Primary modules">
            {(
              [
                { id: 'bible', label: 'Bible', icon: BookOpen },
                { id: 'songs', label: 'Songs', icon: Music2 },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded text-[11px] font-semibold transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-blue-600 text-white'
                      : 'text-slate-300 hover:text-white hover:bg-[#20242c]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Contextual Sidebar Body */}
          <div className="flex-1 overflow-y-auto p-2 flex flex-col min-h-0">
            {activeTab === 'bible' && (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="text-[11px] font-semibold text-slate-400 px-1.5 mb-1.5">
                  {activeTranslation ? `Books in ${activeTranslation.abbreviation}` : 'Bible Books'}
                </div>
                {!activeTranslation ? (
                  <div className="text-[11px] text-slate-500 px-1.5">
                    Import a Bible translation to browse books.
                  </div>
                ) : (
                  <div className="flex-1 overflow-y-auto divide-y divide-[#252a33] rounded bg-[#11141a] border border-[#252a33]">
                    {activeTranslation.books.map((b) => {
                      const active = b.name.toLowerCase() === selectedBook.toLowerCase();
                      return (
                        <button
                          key={b.name}
                          type="button"
                          onClick={() => {
                            setSelectedBook(b.name);
                            setSelectedChapter(b.chapters[0]?.number || 1);
                            setSelectedVerse(b.chapters[0]?.verses[0]?.number || 1);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 text-[11px] transition-colors flex items-center justify-between ${
                            active
                              ? 'bg-blue-600/20 text-white font-semibold'
                              : 'text-slate-300 hover:text-white hover:bg-[#20242c]'
                          }`}
                        >
                          <span className="truncate">{b.name}</span>
                          <span className="text-[10px] font-mono-tabular text-slate-500">
                            {b.chapters.length}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'songs' && (
              <div className="flex-1 min-h-0 flex flex-col gap-2">
                <div className="relative shrink-0">
                  <Search className="w-3 h-3 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={songSidebarSearch}
                    onChange={(e) => setSongSidebarSearch(e.target.value)}
                    placeholder="Filter songs..."
                    className="w-full rounded bg-[#11141a] border border-[#2c323d] pl-7 pr-2.5 py-1.5 text-[11px] text-white focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="flex-1 overflow-y-auto divide-y divide-[#252a33] rounded bg-[#11141a] border border-[#252a33]">
                  {filteredSongsForSidebar.length === 0 ? (
                    <div className="p-3 text-[11px] text-slate-500 text-center">
                      No songs found.
                    </div>
                  ) : (
                    filteredSongsForSidebar.map((song) => {
                      const active = song.id === activeSong?.id;
                      const slideCount = computeSongSlides(song).length;
                      return (
                        <button
                          key={song.id}
                          type="button"
                          onClick={() => {
                            setSelectedSongId(song.id);
                            setSelectedSongSlideIdx(0);
                          }}
                          className={`w-full text-left px-2.5 py-1.5 transition-colors flex items-center justify-between gap-2 ${
                            active
                              ? 'bg-blue-600/20 text-white font-semibold'
                              : 'text-slate-300 hover:text-white hover:bg-[#20242c]'
                          }`}
                        >
                          <span className="text-[11px] truncate">{song.title}</span>
                          <span className="text-[10px] font-mono-tabular text-slate-500 shrink-0">
                            {slideCount}
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>

        {/* SIDEBAR RESIZE HANDLE */}
        <div
          onMouseDown={() => {
            isResizingSidebar.current = true;
          }}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          className="w-1 cursor-col-resize bg-transparent hover:bg-blue-500/60 transition-colors shrink-0"
        />

        {/* CENTRAL WORKSPACE */}
        <main className="flex-1 min-w-0 p-2.5 overflow-hidden bg-[#11141a]">
          {!hydrated ? (
            <div className="h-full rounded-lg bg-[#171b22] border border-[#2c323d] flex items-center justify-center text-[11px] text-slate-400">
              Loading {APP_NAME} workspace...
            </div>
          ) : (
            <>
              {activeTab === 'bible' && (
                <BibleWorkspace
                  translations={translations}
                  selectedTranslationId={selectedTranslationId}
                  onSelectTranslation={setSelectedTranslationId}
                  selectedBook={selectedBook}
                  selectedChapter={selectedChapter}
                  selectedVerse={selectedVerse}
                  onSelectReference={(b, c, v) => {
                    setSelectedBook(b);
                    setSelectedChapter(c);
                    setSelectedVerse(v);
                  }}
                  onProjectVerse={(b, c, v) => projectBibleVerse(b, c, v)}
                  bibleDisplayMode={presentation.bibleDisplayMode}
                  onChangeBibleDisplayMode={(mode) => toggleBibleDisplayMode(mode)}
                  lowerThirdPosition={displaySettings.lowerThirdPosition}
                  onChangeLowerThirdPosition={handleChangeLowerThirdPosition}
                  presentation={presentation}
                  onOpenImportBible={() => setBibleImportOpen(true)}
                  searchInputRef={bibleSearchRef}
                />
              )}

              {activeTab === 'songs' && (
                <SongsWorkspace
                  songs={songs}
                  selectedSongId={selectedSongId}
                  selectedSlideIndex={selectedSongSlideIdx}
                  onSelectSong={(id) => {
                    setSelectedSongId(id);
                    setSelectedSongSlideIdx(0);
                  }}
                  onProjectSongSlide={projectSongSlide}
                  onClearOutput={clearOutput}
                  onUpdateSong={handleUpdateSong}
                  onCreateSong={handleCreateSong}
                  onDeleteSong={handleDeleteSong}
                  presentation={presentation}
                />
              )}
            </>
          )}
        </main>

        {/* RIGHT LIVE OUTPUT PREVIEW & COLLAPSIBLE QUICK ACTIONS PANEL */}
        <aside className="w-[330px] xl:w-[370px] shrink-0 bg-[#171b22] border-l border-[#252a33] flex flex-col min-h-0 overflow-y-auto p-3 space-y-2.5">
          {/* Live Preview Header */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <Monitor className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-[11px] font-bold text-white">Live Output Preview</span>
            </div>
            <span
              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                presentation.isLive && presentation.activeType !== 'none'
                  ? 'bg-red-600/20 text-red-400 border border-red-500/40'
                  : 'bg-[#20242c] text-slate-400 border border-[#2c323d]'
              }`}
            >
              {presentation.isLive && presentation.activeType !== 'none' ? 'ON AIR' : 'STANDBY'}
            </span>
          </div>

          {/* 16:9 Live Preview Canvas */}
          <div className="rounded-lg overflow-hidden border border-[#2c323d] bg-black shadow-lg">
            <PresentationCanvas presentation={presentation} settings={displaySettings} isPreview />
          </div>

          <div className="text-[11px] text-slate-300 font-medium truncate font-mono-tabular">
            {liveSummaryText}
          </div>

          {/* Live Output Quick Controls */}
          <div className="rounded-lg bg-[#20242c] border border-[#2c323d] p-2.5 space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                onClick={() => toggleBibleDisplayMode('fullscreen')}
                className={`py-1 px-2 rounded text-[11px] font-medium transition-colors ${
                  presentation.bibleDisplayMode === 'fullscreen'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#171b22] text-slate-300 hover:text-white'
                }`}
              >
                Full-Screen
              </button>
              <button
                type="button"
                onClick={() => toggleBibleDisplayMode('lower-third')}
                className={`py-1 px-2 rounded text-[11px] font-medium transition-colors ${
                  presentation.bibleDisplayMode === 'lower-third'
                    ? 'bg-blue-600 text-white'
                    : 'bg-[#171b22] text-slate-300 hover:text-white'
                }`}
              >
                Lower-Third
              </button>
            </div>

            {presentation.bibleDisplayMode === 'lower-third' && (
              <div className="space-y-1.5">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleChangeLowerThirdPosition('top')}
                    className={`py-1 px-2 rounded text-[11px] font-medium transition-colors ${
                      displaySettings.lowerThirdPosition === 'top'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#171b22] text-slate-300 hover:text-white'
                    }`}
                  >
                    Lower-Third: Top
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeLowerThirdPosition('bottom')}
                    className={`py-1 px-2 rounded text-[11px] font-medium transition-colors ${
                      displaySettings.lowerThirdPosition === 'bottom'
                        ? 'bg-blue-600 text-white'
                        : 'bg-[#171b22] text-slate-300 hover:text-white'
                    }`}
                  >
                    Lower-Third: Bottom
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const isCurrentlyHidden =
                      displaySettings.backgroundType === 'transparent' ||
                      displaySettings.transparentBackground ||
                      displaySettings.lowerThirdShowBackground === false ||
                      displaySettings.lowerThirdOpacity === 0;
                    if (isCurrentlyHidden) {
                      updateDisplaySettings({
                        lowerThirdShowBackground: true,
                        lowerThirdOpacity:
                          displaySettings.lowerThirdOpacity > 0
                            ? displaySettings.lowerThirdOpacity
                            : 0.9,
                        backgroundType:
                          displaySettings.backgroundType === 'transparent'
                            ? 'solid'
                            : displaySettings.backgroundType,
                        transparentBackground: false,
                      });
                    } else {
                      updateDisplaySettings({ lowerThirdShowBackground: false });
                    }
                  }}
                  className={`w-full py-1 px-2 rounded text-[11px] font-medium border transition-colors ${
                    displaySettings.backgroundType === 'transparent' ||
                    displaySettings.transparentBackground ||
                    displaySettings.lowerThirdShowBackground === false ||
                    displaySettings.lowerThirdOpacity === 0
                      ? 'bg-[#171b22] border-[#2c323d] text-slate-300 hover:text-white'
                      : 'bg-blue-600/20 border-blue-500 text-blue-200'
                  }`}
                >
                  {displaySettings.backgroundType === 'transparent' ||
                  displaySettings.transparentBackground ||
                  displaySettings.lowerThirdShowBackground === false ||
                  displaySettings.lowerThirdOpacity === 0
                    ? 'Lower-Third Box Bg: Off (Transparent)'
                    : 'Lower-Third Box Bg: On'}
                </button>
              </div>
            )}

            <div className="grid grid-cols-2 gap-1.5">
              <select
                aria-label="Quick background type"
                value={displaySettings.backgroundType}
                onChange={(e) =>
                  updateDisplaySettings({
                    backgroundType: e.target.value as DisplaySettings['backgroundType'],
                    transparentBackground: e.target.value === 'transparent',
                  })
                }
                className="rounded bg-[#11141a] border border-[#2c323d] px-2 py-1 text-[11px] text-slate-200"
              >
                <option value="solid">Bg: Solid</option>
                <option value="gradient">Bg: Gradient</option>
                <option value="transparent">Bg: Transparent</option>
              </select>

              <select
                aria-label="Quick transition type"
                value={displaySettings.transition}
                onChange={(e) =>
                  updateDisplaySettings({
                    transition: e.target.value as DisplaySettings['transition'],
                  })
                }
                className="rounded bg-[#11141a] border border-[#2c323d] px-2 py-1 text-[11px] text-slate-200"
              >
                <option value="fade">Fade</option>
                <option value="zoom">Zoom</option>
                <option value="cut">Cut</option>
                <option value="slide">Slide</option>
              </select>
            </div>
          </div>

          {/* Collapsible Quick-Actions Panel */}
          <div className="rounded-lg bg-[#20242c] border border-[#2c323d] overflow-hidden">
            <button
              type="button"
              onClick={() =>
                updatePreferences({ quickActionsOpen: !preferences.quickActionsOpen })
              }
              className="w-full px-2.5 py-2 flex items-center justify-between text-[11px] font-semibold text-white hover:bg-[#252a33]"
            >
              <span>Quick Actions</span>
              {preferences.quickActionsOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-slate-400" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>

            {preferences.quickActionsOpen && (
              <div className="p-2.5 pt-0 border-t border-[#2c323d]">
                <div className="grid grid-cols-2 gap-1.5 pt-2">
                  <button
                    type="button"
                    onClick={clearOutput}
                    className="py-1.5 px-2 rounded bg-[#171b22] hover:bg-[#252a33] border border-[#2c323d] text-[11px] font-medium text-slate-200"
                  >
                    Black / Clear
                  </button>
                  <button
                    type="button"
                    onClick={openStandaloneDisplay}
                    className="py-1.5 px-2 rounded bg-[#171b22] hover:bg-[#252a33] border border-[#2c323d] text-[11px] font-medium text-slate-200"
                  >
                    Popout Display
                  </button>
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* BOTTOM TRANSPORT & PROJECTION BAR */}
      <footer className="h-11 shrink-0 px-3.5 border-t border-[#252a33] bg-[#171b22] flex items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => stepSlide(-1)}
            className="px-2.5 py-1.5 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-[11px] font-semibold text-slate-200 flex items-center gap-1 transition-colors"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            onClick={() => stepSlide(1)}
            className="px-2.5 py-1.5 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-[11px] font-semibold text-slate-200 flex items-center gap-1 transition-colors"
          >
            <span>Next</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          <div className="hidden md:flex items-center gap-2 ml-2 text-[11px] text-slate-400 font-mono-tabular">
            {activeTab === 'bible' && activeTranslation && (
              <span>
                Selected: {selectedBook} {selectedChapter}:{selectedVerse} ({activeTranslation.abbreviation})
              </span>
            )}
            {activeTab === 'songs' && activeSong && (
              <span>
                {activeSong.title} · Slide {Math.min(selectedSongSlideIdx + 1, Math.max(1, activeSongSlides.length))}/
                {Math.max(1, activeSongSlides.length)}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-[11px] font-medium text-slate-300"
          >
            <Keyboard className="w-3 h-3" />
            <span>Shortcuts</span>
          </button>

          <button
            type="button"
            onClick={clearOutput}
            className="px-3 py-1.5 rounded bg-[#252a33] hover:bg-[#313844] border border-[#38404f] text-[11px] font-semibold text-slate-100 flex items-center gap-1.5 transition-colors"
          >
            <Square className="w-3 h-3 fill-current" />
            <span>Clear Output</span>
          </button>

          <button
            type="button"
            onClick={handleProjectCurrentSelection}
            className={`px-3.5 py-1.5 rounded text-[11px] font-bold flex items-center gap-1.5 shadow-lg transition-colors whitespace-nowrap ${projectLiveColorClass}`}
          >
            <Play className="w-3 h-3 fill-current" />
            <span>Project Live</span>
          </button>
        </div>
      </footer>

      {/* MODALS & DIALOGS */}
      <BibleImportModal
        isOpen={bibleImportOpen}
        onClose={() => setBibleImportOpen(false)}
        existingTranslations={translations}
        onConfirmImport={handleImportBibleTranslation}
      />

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        displaySettings={displaySettings}
        onUpdateDisplaySettings={updateDisplaySettings}
        themeSettings={themeSettings}
        onUpdateThemeSettings={(next) => {
          setThemeSettings(next);
          saveThemeSettings(next);
        }}
        preferences={preferences}
        onUpdatePreferences={updatePreferences}
        translations={translations}
        songs={songs}
        customFonts={customFonts}
        onAddCustomFont={handleAddCustomFont}
        onDeleteCustomFont={handleDeleteCustomFont}
        onApplyBackup={handleApplyBackup}
        onRequestResetAllData={handleResetAllData}
        onCopyUrl={copyText}
      />

      <ConfirmDialog
        isOpen={Boolean(confirmState?.open)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={() => confirmState?.onConfirm()}
        onCancel={() => setConfirmState(null)}
      />

      {/* TOAST NOTIFICATIONS */}
      <div className="fixed bottom-14 right-3.5 z-[70] space-y-1.5 pointer-events-none">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="pointer-events-auto min-w-[240px] max-w-xs rounded-lg bg-[#20242c] border border-[#38404f] px-3 py-2 shadow-2xl flex items-start justify-between gap-2.5"
          >
            <div>
              <div className="text-[11px] font-semibold text-white">{toast.title}</div>
              {toast.description && (
                <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[230px]">
                  {toast.description}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setToasts((prev) => prev.filter((t) => t.id !== toast.id))}
              className="text-slate-400 hover:text-white"
              aria-label="Dismiss notification"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
