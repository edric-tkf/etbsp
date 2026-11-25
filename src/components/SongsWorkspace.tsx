import React, { useMemo, useRef, useState } from 'react';
import {
  Cloud,
  Edit3,
  GitMerge,
  Keyboard,
  Loader2,
  Music2,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import type { EtOAuthUser, PresentationState, Song, SongCategory } from '../types/models';
import { computeSongSlides, parseSongTXT, songToRawText } from '../utils/songEngine';
import { OnScreenKeyboard, type OnScreenKeyAction } from './OnScreenKeyboard';

interface SongsWorkspaceProps {
  songs: Song[];
  totalSongCount: number;
  songCategory: SongCategory;
  onChangeSongCategory: (category: SongCategory) => void;
  selectedSongId: string;
  selectedSlideIndex: number;
  onSelectSong: (songId: string) => void;
  onProjectSongSlide: (song: Song, slideIndex: number) => void;
  onClearOutput: () => void;
  onUpdateSong: (updated: Song) => void;
  onCreateSong: (song: Song) => void;
  onDeleteSong: (songId: string) => void;
  presentation: PresentationState;
  oauthUser: EtOAuthUser | null;
  isOAuthAuthorized: boolean;
  songbookAutoMerge: boolean;
  isSongbookSyncing: boolean;
  onMergeWithSongbookClick: () => void;
  onOpenOAuthModal: () => void;
}

const LYRICS_PLACEHOLDER = `[Verse 1]
Verse 1 lyrics

[Verse 2]
Verse 2 lyrics

[Chorus]
Chorus lyrics`;

export const SongsWorkspace: React.FC<SongsWorkspaceProps> = ({
  songs,
  totalSongCount,
  songCategory,
  onChangeSongCategory,
  selectedSongId,
  selectedSlideIndex,
  onSelectSong,
  onProjectSongSlide,
  onClearOutput,
  onUpdateSong,
  onCreateSong,
  onDeleteSong,
  presentation,
  oauthUser,
  isOAuthAuthorized,
  songbookAutoMerge,
  isSongbookSyncing,
  onMergeWithSongbookClick,
  onOpenOAuthModal,
}) => {
  const [editorMode, setEditorMode] = useState<'none' | 'create' | 'edit'>('none');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftArtist, setDraftArtist] = useState('');
  const [draftLyricsText, setDraftLyricsText] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [activeField, setActiveField] = useState<'title' | 'artist' | 'lyrics'>('lyrics');

  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const artistInputRef = useRef<HTMLInputElement | null>(null);
  const lyricsTextareaRef = useRef<HTMLTextAreaElement | null>(null);

  const activeSong = useMemo(
    () => songs.find((s) => s.id === selectedSongId) || songs[0] || null,
    [songs, selectedSongId]
  );

  const slides = useMemo(() => (activeSong ? computeSongSlides(activeSong) : []), [activeSong]);

  const draftPreview = useMemo(() => {
    if (editorMode === 'none' || !draftLyricsText.trim()) return null;
    return parseSongTXT(draftLyricsText, {
      title: draftTitle || 'Untitled Song',
      artist: draftArtist,
    });
  }, [editorMode, draftLyricsText, draftTitle, draftArtist]);

  const startCreating = () => {
    setDraftTitle('');
    setDraftArtist('');
    setDraftLyricsText('');
    setDraftError(null);
    setActiveField('title');
    setEditorMode('create');
  };

  const startEditing = () => {
    if (!activeSong) return;
    setDraftTitle(activeSong.title);
    setDraftArtist(activeSong.artist || '');
    setDraftLyricsText(songToRawText(activeSong));
    setDraftError(null);
    setActiveField('lyrics');
    setEditorMode('edit');
  };

  const handleSave = () => {
    const trimmedTitle = draftTitle.trim();
    if (!trimmedTitle) {
      setDraftError('Please enter a song title.');
      return;
    }

    const parsed = parseSongTXT(draftLyricsText, {
      id: editorMode === 'edit' && activeSong ? activeSong.id : undefined,
      title: trimmedTitle,
      artist: draftArtist.trim(),
      createdAt: editorMode === 'edit' && activeSong ? activeSong.createdAt : undefined,
    });

    if (parsed.errors.length > 0 || parsed.song.sections.length === 0) {
      setDraftError(parsed.errors[0] || 'Please enter at least one lyric line.');
      return;
    }

    const finalSong: Song =
      editorMode === 'edit' && activeSong
        ? {
            ...parsed.song,
            songbookDocId: activeSong.songbookDocId,
            lastSyncedHash: activeSong.lastSyncedHash,
          }
        : parsed.song;

    if (editorMode === 'create') {
      onCreateSong(finalSong);
      onSelectSong(finalSong.id);
    } else if (editorMode === 'edit' && activeSong) {
      onUpdateSong(finalSong);
    }

    setEditorMode('none');
    setKeyboardOpen(false);
    setDraftError(null);
  };

  const applyOnScreenKey = (action: OnScreenKeyAction) => {
    const el =
      activeField === 'title'
        ? titleInputRef.current
        : activeField === 'artist'
        ? artistInputRef.current
        : lyricsTextareaRef.current;
    const currentValue =
      activeField === 'title'
        ? draftTitle
        : activeField === 'artist'
        ? draftArtist
        : draftLyricsText;
    const setValue =
      activeField === 'title'
        ? setDraftTitle
        : activeField === 'artist'
        ? setDraftArtist
        : setDraftLyricsText;

    const start = el?.selectionStart ?? currentValue.length;
    const end = el?.selectionEnd ?? currentValue.length;

    const setCaretLater = (pos: number) => {
      window.requestAnimationFrame(() => {
        if (!el) return;
        el.focus();
        el.setSelectionRange(pos, pos);
      });
    };

    if (action.type === 'arrow') {
      if (action.direction === 'left') {
        const nextPos = start !== end ? start : Math.max(0, start - 1);
        setCaretLater(nextPos);
        return;
      }
      if (action.direction === 'right') {
        const nextPos = start !== end ? end : Math.min(currentValue.length, end + 1);
        setCaretLater(nextPos);
        return;
      }
      if (activeField === 'lyrics') {
        const beforeCaret = currentValue.slice(0, start);
        const linesBefore = beforeCaret.split('\n');
        const curLineIdx = linesBefore.length - 1;
        const curCol = linesBefore[curLineIdx].length;
        const allLines = currentValue.split('\n');

        const targetLineIdx =
          action.direction === 'up'
            ? Math.max(0, curLineIdx - 1)
            : Math.min(allLines.length - 1, curLineIdx + 1);

        let offset = 0;
        for (let i = 0; i < targetLineIdx; i++) {
          offset += allLines[i].length + 1;
        }
        offset += Math.min(curCol, allLines[targetLineIdx].length);
        setCaretLater(offset);
      }
      return;
    }

    if (action.type === 'backspace') {
      if (start !== end) {
        const next = currentValue.slice(0, start) + currentValue.slice(end);
        setValue(next);
        setDraftError(null);
        setCaretLater(start);
      } else if (start > 0) {
        const next = currentValue.slice(0, start - 1) + currentValue.slice(start);
        setValue(next);
        setDraftError(null);
        setCaretLater(start - 1);
      }
      return;
    }

    if (action.type === 'enter' && activeField === 'title') {
      setActiveField('artist');
      window.requestAnimationFrame(() => {
        artistInputRef.current?.focus();
      });
      return;
    }

    if (action.type === 'enter' && activeField === 'artist') {
      setActiveField('lyrics');
      window.requestAnimationFrame(() => {
        lyricsTextareaRef.current?.focus();
      });
      return;
    }

    const inserted =
      action.type === 'char'
        ? action.value
        : action.type === 'enter'
        ? '\n'
        : action.type === 'tab'
        ? '  '
        : ' ';

    const next = currentValue.slice(0, start) + inserted + currentValue.slice(end);
    const nextPos = start + inserted.length;
    setValue(next);
    setDraftError(null);
    setCaretLater(nextPos);
  };

  if (editorMode !== 'none') {
    return (
      <div className="flex flex-col h-full gap-2">
        <div className="rounded-lg bg-[#171b22] border border-[#2c323d] px-3 py-2.5 flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-white truncate">
            {editorMode === 'create' ? 'New Song' : `Edit Song: ${activeSong?.title || ''}`}
          </span>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => {
                setKeyboardOpen((prev) => !prev);
                window.requestAnimationFrame(() => {
                  const targetEl =
                    activeField === 'title'
                      ? titleInputRef.current
                      : activeField === 'artist'
                      ? artistInputRef.current
                      : lyricsTextareaRef.current;
                  targetEl?.focus();
                });
              }}
              className={`px-2.5 py-1.5 rounded border text-xs font-medium flex items-center gap-1.5 transition-colors ${
                keyboardOpen
                  ? 'bg-blue-600/20 border-blue-500 text-blue-200'
                  : 'bg-[#20242c] hover:bg-[#252a33] border-[#2c323d] text-slate-200'
              }`}
            >
              <Keyboard className="w-3.5 h-3.5 text-blue-400" />
              <span>On-Screen Keyboard</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setEditorMode('none');
                setKeyboardOpen(false);
                setDraftError(null);
              }}
              className="px-3 py-1.5 rounded bg-[#252a33] text-xs text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Song</span>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-lg bg-[#171b22] border border-[#2c323d] p-3 flex flex-col gap-2.5 overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 shrink-0">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Song Title</label>
              <input
                ref={titleInputRef}
                type="text"
                value={draftTitle}
                onFocus={() => setActiveField('title')}
                onChange={(e) => {
                  setDraftTitle(e.target.value);
                  setDraftError(null);
                }}
                placeholder="Enter song title..."
                className="w-full rounded bg-[#11141a] border border-[#2c323d] px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Artists (comma-separated)
              </label>
              <input
                ref={artistInputRef}
                type="text"
                value={draftArtist}
                onFocus={() => setActiveField('artist')}
                onChange={(e) => {
                  setDraftArtist(e.target.value);
                  setDraftError(null);
                }}
                placeholder="e.g. Elevation Worship, Brandon Lake"
                className="w-full rounded bg-[#11141a] border border-[#2c323d] px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-slate-300">
                Lyrics (Use [Verse 1], [Chorus], [Bridge], etc. — blank line starts a new slide)
              </label>
              {draftPreview && (
                <span className="text-xs font-mono-tabular text-slate-400">
                  {draftPreview.song.sections.length} sections
                </span>
              )}
            </div>
            <textarea
              ref={lyricsTextareaRef}
              value={draftLyricsText}
              onFocus={() => setActiveField('lyrics')}
              onChange={(e) => {
                setDraftLyricsText(e.target.value);
                setDraftError(null);
              }}
              placeholder={LYRICS_PLACEHOLDER}
              className="flex-1 min-h-[120px] w-full rounded bg-[#11141a] border border-[#2c323d] p-3 text-sm text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500 resize-none font-mono-tabular"
            />
          </div>

          {draftError && (
            <div className="rounded bg-red-950/40 border border-red-900/60 px-3 py-2 text-xs text-red-300 shrink-0">
              {draftError}
            </div>
          )}

          {keyboardOpen && (
            <OnScreenKeyboard
              activeTargetLabel={
                activeField === 'title'
                  ? 'Song Title'
                  : activeField === 'artist'
                  ? 'Artists'
                  : 'Lyrics'
              }
              onKeyAction={applyOnScreenKey}
              onClose={() => setKeyboardOpen(false)}
            />
          )}
        </div>
      </div>
    );
  }

  const autoMergeActive = songbookAutoMerge && isOAuthAuthorized;

  const renderSongbookSyncButton = () => (
    <button
      type="button"
      disabled={isSongbookSyncing}
      onClick={onMergeWithSongbookClick}
      title={
        autoMergeActive
          ? 'Auto Merge active — click to disable automatic cross-sync with Songbook'
          : 'Merge & cross-sync songs with Songbook (pnw-lyrics)'
      }
      className={`px-3 py-1.5 rounded border text-xs font-semibold flex items-center gap-1.5 transition-colors disabled:opacity-60 ${
        autoMergeActive
          ? 'bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/60 text-emerald-200'
          : 'bg-blue-600/20 hover:bg-blue-600/30 border-blue-500/50 text-blue-200'
      }`}
    >
      {isSongbookSyncing ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : autoMergeActive ? (
        <>
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <Cloud className="w-3.5 h-3.5 text-emerald-300" />
        </>
      ) : (
        <GitMerge className="w-3.5 h-3.5 text-blue-300" />
      )}
      <span>{autoMergeActive ? 'Auto Merge' : 'Merge with Songbook'}</span>
    </button>
  );

  if (!activeSong) {
    const isCategoryEmpty = totalSongCount > 0;
    const otherCategory: SongCategory = songCategory === 'demos' ? 'general' : 'demos';
    const otherLabel = otherCategory === 'demos' ? 'Demos' : 'General';
    return (
      <div className="h-full rounded-lg bg-[#171b22] border border-[#2c323d] flex flex-col items-center justify-center p-6 text-center">
        <Music2 className="w-9 h-9 text-slate-500 mb-3" />
        <h3 className="text-sm font-semibold text-white">
          {isCategoryEmpty
            ? songCategory === 'demos'
              ? 'No Songs in Demos'
              : 'No Songs in General'
            : 'Your Song Library Is Empty'}
        </h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          {isCategoryEmpty
            ? songCategory === 'demos'
              ? 'Songs with author Demos, Planetshakers, or planetboom are automatically grouped under Demos.'
              : 'All songs except those by Demos, Planetshakers, or planetboom appear under General.'
            : 'Create a song with section tags like [Verse 1] and [Chorus], merge with Songbook, or restore a backup in Settings.'}
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={startCreating}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-xs font-semibold text-white flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>New Song</span>
          </button>
          {isCategoryEmpty && (
            <button
              type="button"
              onClick={() => onChangeSongCategory(otherCategory)}
              className="px-3 py-2 rounded-lg bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-xs font-medium text-slate-200"
            >
              Switch to {otherLabel}
            </button>
          )}
          {renderSongbookSyncButton()}
          <button
            type="button"
            onClick={onOpenOAuthModal}
            className="px-3 py-2 rounded-lg bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-xs font-medium text-slate-200 flex items-center gap-1.5"
          >
            <ShieldCheck
              className={`w-3.5 h-3.5 ${isOAuthAuthorized ? 'text-emerald-400' : 'text-slate-400'}`}
            />
            <span>{isOAuthAuthorized && oauthUser ? oauthUser.email : 'ET OAuth'}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Header Toolbar */}
      <div className="rounded-lg bg-[#171b22] border border-[#2c323d] px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{activeSong.title}</h2>
            <span
              className={`px-1.5 py-0.5 rounded text-[11px] font-semibold border shrink-0 ${
                songCategory === 'demos'
                  ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                  : 'bg-[#20242c] border-[#2c323d] text-slate-300'
              }`}
            >
              {songCategory === 'demos' ? 'Demos' : 'General'}
            </span>
            {activeSong.artist?.trim() && (
              <span className="text-xs text-slate-400 truncate">· {activeSong.artist}</span>
            )}
          </div>
          <div className="text-xs text-slate-400">
            Click any lyric row to project · click again while live to hide
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {renderSongbookSyncButton()}
          <button
            type="button"
            onClick={onOpenOAuthModal}
            title={
              isOAuthAuthorized && oauthUser
                ? `Signed in as ${oauthUser.email}`
                : 'Sign in with ET OAuth'
            }
            className="px-2.5 py-1.5 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-xs font-medium text-slate-300 flex items-center gap-1.5"
          >
            <ShieldCheck
              className={`w-3.5 h-3.5 ${isOAuthAuthorized ? 'text-emerald-400' : 'text-slate-400'}`}
            />
            <span className="hidden xl:inline max-w-[140px] truncate">
              {isOAuthAuthorized && oauthUser ? oauthUser.email : 'ET OAuth'}
            </span>
          </button>
          <button
            type="button"
            onClick={startCreating}
            className="px-3 py-1.5 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-xs font-medium text-slate-200 flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New</span>
          </button>
          <button
            type="button"
            onClick={startEditing}
            className="px-3 py-1.5 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-xs font-medium text-slate-200 flex items-center gap-1.5"
          >
            <Edit3 className="w-3.5 h-3.5 text-blue-400" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteSong(activeSong.id)}
            aria-label="Delete song"
            className="p-2 rounded bg-[#20242c] hover:bg-red-950/60 border border-[#2c323d] text-slate-400 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Roomy List Format with clear section dividers between adjacent cells */}
      <div className="flex-1 overflow-y-auto rounded-lg bg-[#171b22] border border-[#2c323d]">
        {slides.map((slide, idx) => {
          const isNewSection = idx === 0 || slide.sectionId !== slides[idx - 1].sectionId;
          const isSelected = slide.slideIndex === selectedSlideIndex;
          const isLiveSlide =
            presentation.isLive &&
            presentation.activeType === 'song' &&
            presentation.song?.songId === activeSong.id &&
            presentation.song?.slideIndex === slide.slideIndex;

          const sectionAccentClass =
            slide.sectionType === 'chorus'
              ? 'bg-amber-400 text-amber-300'
              : slide.sectionType === 'bridge'
              ? 'bg-purple-400 text-purple-300'
              : slide.sectionType === 'pre-chorus'
              ? 'bg-sky-400 text-sky-300'
              : slide.sectionType === 'tag' || slide.sectionType === 'outro' || slide.sectionType === 'ending'
              ? 'bg-emerald-400 text-emerald-300'
              : 'bg-blue-400 text-blue-300';

          const [barColorClass, labelColorClass] = sectionAccentClass.split(' ');

          return (
            <React.Fragment key={slide.id}>
              {isNewSection && (
                <div
                  className={`px-3.5 py-2 bg-[#12161e] flex items-center gap-2 border-b border-[#252a33] ${
                    idx > 0 ? 'border-t-2 border-t-[#2c323d]' : ''
                  }`}
                >
                  <span className={`w-1.5 h-3.5 rounded-full shrink-0 ${barColorClass}`} />
                  <span className={`text-xs font-bold uppercase tracking-wider shrink-0 ${labelColorClass}`}>
                    {slide.sectionTitle}
                  </span>
                  <div className="flex-1 h-px bg-[#252a33]" />
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (isLiveSlide) {
                    onClearOutput();
                  } else {
                    onProjectSongSlide(activeSong, slide.slideIndex);
                  }
                }}
                title={isLiveSlide ? 'Click again to hide lyric' : 'Click to project lyric'}
                style={{ minHeight: 'var(--bsp-row-height-px, 54px)' }}
                className={`w-full text-left px-3.5 py-3 flex items-center justify-between gap-3 border-b border-[#252a33] last:border-b-0 transition-colors cursor-pointer ${
                  isLiveSlide
                    ? 'bg-red-950/40 text-white border-l-2 border-l-red-500'
                    : isSelected
                    ? 'bg-[#20242c] text-white border-l-2 border-l-blue-500'
                    : 'hover:bg-[#20242c]/80 text-slate-200'
                }`}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  {slide.lines.slice(0, 2).map((line, i) => (
                    <div
                      key={i}
                      style={{ fontSize: 'var(--bsp-ui-font-px, 14.5px)' }}
                      className="font-medium text-slate-100 leading-snug"
                    >
                      {line}
                    </div>
                  ))}
                </div>

                {isLiveSlide && (
                  <span className="text-xs font-bold text-red-400 tracking-wide shrink-0">
                    LIVE
                  </span>
                )}
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
