import React, { useMemo, useState } from 'react';
import { Edit3, Music2, Plus, Save, Trash2 } from 'lucide-react';
import type { PresentationState, Song } from '../types/models';
import { computeSongSlides, parseSongTXT, songToRawText } from '../utils/songEngine';

interface SongsWorkspaceProps {
  songs: Song[];
  selectedSongId: string;
  selectedSlideIndex: number;
  onSelectSong: (songId: string) => void;
  onProjectSongSlide: (song: Song, slideIndex: number) => void;
  onClearOutput: () => void;
  onUpdateSong: (updated: Song) => void;
  onCreateSong: (song: Song) => void;
  onDeleteSong: (songId: string) => void;
  presentation: PresentationState;
}

const LYRICS_PLACEHOLDER = `[Verse 1]
Verse 1 lyrics

[Verse 2]
Verse 2 lyrics

[Chorus]
Chorus lyrics`;

export const SongsWorkspace: React.FC<SongsWorkspaceProps> = ({
  songs,
  selectedSongId,
  selectedSlideIndex,
  onSelectSong,
  onProjectSongSlide,
  onClearOutput,
  onUpdateSong,
  onCreateSong,
  onDeleteSong,
  presentation,
}) => {
  const [editorMode, setEditorMode] = useState<'none' | 'create' | 'edit'>('none');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftLyricsText, setDraftLyricsText] = useState('');
  const [draftError, setDraftError] = useState<string | null>(null);

  const activeSong = useMemo(
    () => songs.find((s) => s.id === selectedSongId) || songs[0] || null,
    [songs, selectedSongId]
  );

  const slides = useMemo(() => (activeSong ? computeSongSlides(activeSong) : []), [activeSong]);

  const draftPreview = useMemo(() => {
    if (editorMode === 'none' || !draftLyricsText.trim()) return null;
    return parseSongTXT(draftLyricsText, { title: draftTitle || 'Untitled Song' });
  }, [editorMode, draftLyricsText, draftTitle]);

  const startCreating = () => {
    setDraftTitle('');
    setDraftLyricsText('');
    setDraftError(null);
    setEditorMode('create');
  };

  const startEditing = () => {
    if (!activeSong) return;
    setDraftTitle(activeSong.title);
    setDraftLyricsText(songToRawText(activeSong));
    setDraftError(null);
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
      createdAt: editorMode === 'edit' && activeSong ? activeSong.createdAt : undefined,
    });

    if (parsed.errors.length > 0 || parsed.song.sections.length === 0) {
      setDraftError(parsed.errors[0] || 'Please enter at least one lyric line.');
      return;
    }

    if (editorMode === 'create') {
      onCreateSong(parsed.song);
      onSelectSong(parsed.song.id);
    } else if (editorMode === 'edit' && activeSong) {
      onUpdateSong(parsed.song);
    }

    setEditorMode('none');
    setDraftError(null);
  };

  if (editorMode !== 'none') {
    return (
      <div className="flex flex-col h-full gap-2">
        <div className="rounded-lg bg-[#171b22] border border-[#2c323d] px-3 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold text-white">
            {editorMode === 'create' ? 'New Song' : `Edit Song: ${activeSong?.title || ''}`}
          </span>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setEditorMode('none');
                setDraftError(null);
              }}
              className="px-2.5 py-1 rounded bg-[#252a33] text-[11px] text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white flex items-center gap-1"
            >
              <Save className="w-3 h-3" />
              <span>Save Song</span>
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 rounded-lg bg-[#171b22] border border-[#2c323d] p-3 flex flex-col gap-2.5">
          <div>
            <label className="block text-[11px] font-medium text-slate-300 mb-1">Song Title</label>
            <input
              type="text"
              value={draftTitle}
              onChange={(e) => {
                setDraftTitle(e.target.value);
                setDraftError(null);
              }}
              placeholder="Enter song title..."
              className="w-full rounded bg-[#11141a] border border-[#2c323d] px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-medium text-slate-300">
                Lyrics (Use [Verse 1], [Chorus], [Bridge], etc. — auto-split into 2 lines per slide)
              </label>
              {draftPreview && (
                <span className="text-[11px] font-mono-tabular text-slate-400">
                  {draftPreview.song.sections.length} sections
                </span>
              )}
            </div>
            <textarea
              value={draftLyricsText}
              onChange={(e) => {
                setDraftLyricsText(e.target.value);
                setDraftError(null);
              }}
              placeholder={LYRICS_PLACEHOLDER}
              className="flex-1 w-full rounded bg-[#11141a] border border-[#2c323d] p-2.5 text-xs text-slate-100 leading-relaxed focus:outline-none focus:border-blue-500 resize-none font-mono-tabular"
            />
          </div>

          {draftError && (
            <div className="rounded bg-red-950/40 border border-red-900/60 px-2.5 py-1.5 text-[11px] text-red-300">
              {draftError}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (!activeSong) {
    return (
      <div className="h-full rounded-lg bg-[#171b22] border border-[#2c323d] flex flex-col items-center justify-center p-6 text-center">
        <Music2 className="w-8 h-8 text-slate-500 mb-2.5" />
        <h3 className="text-xs font-semibold text-white">Your Song Library Is Empty</h3>
        <p className="text-[11px] text-slate-400 mt-1 max-w-sm">
          Create a song with section tags like [Verse 1] and [Chorus], or restore a backup in Settings.
        </p>
        <button
          type="button"
          onClick={startCreating}
          className="mt-3.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-[11px] font-semibold text-white flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Song</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Compact Header Toolbar */}
      <div className="rounded-lg bg-[#171b22] border border-[#2c323d] px-3 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-xs font-bold text-white truncate">{activeSong.title}</h2>
          <div className="text-[11px] text-slate-400">
            Click any lyric row to project · click again while live to hide
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={startCreating}
            className="px-2.5 py-1 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-[11px] font-medium text-slate-200 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            <span>New</span>
          </button>
          <button
            type="button"
            onClick={startEditing}
            className="px-2.5 py-1 rounded bg-[#20242c] hover:bg-[#252a33] border border-[#2c323d] text-[11px] font-medium text-slate-200 flex items-center gap-1"
          >
            <Edit3 className="w-3 h-3 text-blue-400" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            onClick={() => onDeleteSong(activeSong.id)}
            aria-label="Delete song"
            className="p-1.5 rounded bg-[#20242c] hover:bg-red-950/60 border border-[#2c323d] text-slate-400 hover:text-red-300 transition-colors"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Compact List Format with clear section dividers between adjacent cells */}
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
                  className={`px-3 py-1.5 bg-[#12161e] flex items-center gap-2 border-b border-[#252a33] ${
                    idx > 0 ? 'border-t-2 border-t-[#2c323d]' : ''
                  }`}
                >
                  <span className={`w-1 h-3 rounded-full shrink-0 ${barColorClass}`} />
                  <span className={`text-[10px] font-bold uppercase tracking-wider shrink-0 ${labelColorClass}`}>
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
                className={`w-full text-left px-3 py-2 flex items-center justify-between gap-2.5 border-b border-[#252a33] last:border-b-0 transition-colors cursor-pointer ${
                  isLiveSlide
                    ? 'bg-red-950/40 text-white border-l-2 border-l-red-500'
                    : isSelected
                    ? 'bg-[#20242c] text-white border-l-2 border-l-blue-500'
                    : 'hover:bg-[#20242c]/80 text-slate-200'
                }`}
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  {slide.lines.slice(0, 2).map((line, i) => (
                    <div key={i} className="text-xs font-medium text-slate-100 leading-snug">
                      {line}
                    </div>
                  ))}
                </div>

                {isLiveSlide && (
                  <span className="text-[10px] font-bold text-red-400 tracking-wide shrink-0">
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
